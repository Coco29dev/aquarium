import { describe, expect, it } from 'vitest';
import { cycleStartDay, firstMeasurementsLabel, journeyProgress, journeySteps, PROJECT_CHECK_ITEMS, type JourneyInput } from './journey';
import type { AquariumEvent, Measurement, Parameter, ProjectItem, Task } from '../types';

const TODAY = '2026-10-30';

const param = (id: number, key: string): Parameter => ({
	id,
	aquariumId: 1,
	key,
	name: key,
	unit: '',
	min: null,
	max: null,
	driftPerWeek: null,
	decimals: 1,
	step: 0.1,
	position: id
});
const parameters = [param(1, 'nh3'), param(2, 'no2'), param(3, 'no3'), param(4, 'ph')];
const meas = (parameterId: number, value: number, day: string): Measurement => ({
	parameterId,
	aquariumId: 1,
	value,
	measuredAt: `${day}T10:00:00.000Z`
});
const task = (kind: string): Task => ({ id: Math.random(), aquariumId: 1, title: kind, kind, everyDays: 7, nextDue: TODAY, active: true });
const event = (kind: AquariumEvent['kind'], at: string, payload: Record<string, unknown> = {}): AquariumEvent => ({ aquariumId: 1, kind, at, payload });
const item = (kind: ProjectItem['kind'], label: string, extra: Partial<ProjectItem> = {}): ProjectItem => ({
	id: Math.random(),
	kind,
	label,
	done: false,
	amount: null,
	speciesId: null,
	notes: null,
	position: 0,
	...extra
});

const input = (over: Partial<JourneyInput> & { stage: 'projet' | 'cyclage' | 'actif' }): JourneyInput => {
	const { stage, ...rest } = over;
	return {
		aquarium: { id: 1, stage, startedOn: stage === 'projet' ? null : '2026-10-12', volumeL: 60, waterType: 'recif', coverPhotoId: null },
		parameters,
		measurements: [],
		tasks: [],
		events: [],
		inhabitantsCount: 0,
		projectItems: [],
		cycling: null,
		today: TODAY,
		...rest
	};
};
const ids = (steps: ReturnType<typeof journeySteps>) => steps.map((s) => s.id);
const status = (steps: ReturnType<typeof journeySteps>, id: string) => steps.find((s) => s.id === id)?.status;

describe('parcours d’un bac en projet', () => {
	it('suit la séquence prévue', () => {
		expect(ids(journeySteps(input({ stage: 'projet' })))).toEqual(['volume', 'materiel', 'budget', 'especes', 'compatibilite', 'mise-en-eau']);
	});
	it('coche le volume et met la première étape non faite en cours', () => {
		const steps = journeySteps(input({ stage: 'projet' }));
		expect(status(steps, 'volume')).toBe('done');
		expect(status(steps, 'materiel')).toBe('current');
		expect(status(steps, 'budget')).toBe('todo');
	});
	it('coche matériel, budget et espèces d’après la liste de projet', () => {
		const steps = journeySteps(
			input({
				stage: 'projet',
				projectItems: [item('equipement', 'Filtre', { amount: 120 }), item('espece', 'Poisson-clown')]
			})
		);
		expect(['materiel', 'budget', 'especes'].map((id) => status(steps, id))).toEqual(['done', 'done', 'done']);
		expect(status(steps, 'compatibilite')).toBe('current');
		expect(steps.find((s) => s.id === 'budget')?.detail).toContain('120');
	});
	it('coche la compatibilité quand l’étape à cocher est faite', () => {
		const steps = journeySteps(
			input({ stage: 'projet', projectItems: [item('etape', PROJECT_CHECK_ITEMS.compatibility, { done: true })] })
		);
		expect(status(steps, 'compatibilite')).toBe('done');
	});
	it('propose toujours de lancer la mise en eau, mais ne la coche jamais', () => {
		const steps = journeySteps(input({ stage: 'projet' }));
		const last = steps[steps.length - 1];
		expect(last.status).not.toBe('done');
		expect(last.action?.href).toBe('?etape=mise-en-eau');
	});
	it('retire l’action des étapes à venir', () => {
		const steps = journeySteps(input({ stage: 'projet' }));
		expect(steps.find((s) => s.id === 'budget')?.action).toBeUndefined();
		expect(steps.find((s) => s.id === 'materiel')?.action).toBeDefined();
	});
});

describe('parcours d’un bac en cyclage', () => {
	it('suit la séquence prévue et coche la mise en eau avec le jour du cyclage', () => {
		const steps = journeySteps(input({ stage: 'cyclage' }));
		expect(ids(steps)).toEqual([
			'mise-en-eau',
			'source-ammoniac',
			'premiers-tests',
			'pic-ammoniac',
			'pic-nitrites',
			'nitrates',
			'changement-eau',
			'premiers-poissons'
		]);
		expect(steps[0].status).toBe('done');
		expect(steps[0].detail).toContain('Jour 18');
		expect(steps[1].status).toBe('current');
	});
	it('reconnaît le pic d’ammoniac passé et les nitrites en cours', () => {
		const steps = journeySteps(
			input({
				stage: 'cyclage',
				measurements: [meas(1, 1.5, '2026-10-14'), meas(1, 0.8, '2026-10-18'), meas(1, 0, '2026-10-24'), meas(2, 0.5, '2026-10-24')]
			})
		);
		expect(status(steps, 'source-ammoniac')).toBe('done');
		expect(status(steps, 'pic-ammoniac')).toBe('done');
		expect(status(steps, 'pic-nitrites')).not.toBe('done');
	});
	it('coche les premiers tests après trois jours de tests distincts', () => {
		const two = journeySteps(input({ stage: 'cyclage', measurements: [meas(1, 0.5, '2026-10-14'), meas(2, 0, '2026-10-16')] }));
		expect(status(two, 'premiers-tests')).not.toBe('done');
		const three = journeySteps(input({ stage: 'cyclage', measurements: [meas(1, 0.5, '2026-10-14'), meas(2, 0, '2026-10-16'), meas(3, 5, '2026-10-18')] }));
		expect(status(three, 'premiers-tests')).toBe('done');
	});
	it('ignore les mesures d’avant le début du cycle en cours (cyclage relancé)', () => {
		const events = [event('etape', '2026-10-25T10:00:00.000Z', { label: 'Cyclage relancé' })];
		expect(cycleStartDay({ startedOn: '2026-10-12' }, events)).toBe('2026-10-25');
		const steps = journeySteps(
			input({ stage: 'cyclage', events, measurements: [meas(1, 2, '2026-10-14'), meas(1, 0, '2026-10-20')] })
		);
		expect(status(steps, 'pic-ammoniac')).not.toBe('done');
	});
	it('coche le changement d’eau d’après le journal', () => {
		const steps = journeySteps(input({ stage: 'cyclage', events: [event('changement_eau', '2026-10-27T10:00:00.000Z')] }));
		expect(status(steps, 'changement-eau')).toBe('done');
	});
	it('propose de passer en bac actif seulement quand le cyclage est prêt', () => {
		const notReady = journeySteps(input({ stage: 'cyclage' }));
		expect(notReady[notReady.length - 1].action).toBeUndefined();
		const ready = journeySteps(
			input({ stage: 'cyclage', cycling: { stage: 'pret', ready: true, title: 'Cyclage terminé', advice: '' } })
		);
		expect(ready[ready.length - 1].action).toEqual({ label: 'Passer en bac actif', href: '?etape=actif' });
	});
	it('adapte les tests à l’eau de mer (densité)', () => {
		const salt = journeySteps(input({ stage: 'cyclage' }));
		expect(salt.find((s) => s.id === 'premiers-tests')?.detail).toContain('densité');
		const fresh = journeySteps({ ...input({ stage: 'cyclage' }), aquarium: { ...input({ stage: 'cyclage' }).aquarium, waterType: 'douce' } });
		expect(fresh.find((s) => s.id === 'premiers-tests')?.detail).not.toContain('densité');
	});
});

describe('parcours d’un bac actif', () => {
	it('liste la routine manquante', () => {
		const steps = journeySteps(input({ stage: 'actif', tasks: [task('eau')] }));
		expect(status(steps, 'routine')).toBe('current');
		expect(steps[0].detail).toContain('tests');
		expect(steps[0].detail).toContain('filtre');
	});
	it('coche tout quand les données sont là', () => {
		const steps = journeySteps(
			input({
				stage: 'actif',
				tasks: [task('eau'), task('test'), task('filtre')],
				measurements: [meas(1, 0, '2026-10-20'), meas(2, 0, '2026-10-20'), meas(3, 5, '2026-10-20')],
				inhabitantsCount: 4,
				events: [event('changement_eau', '2026-10-27T10:00:00.000Z')],
				aquarium: { id: 1, stage: 'actif', startedOn: '2026-10-12', volumeL: 60, waterType: 'recif', coverPhotoId: 7 }
			} as never)
		);
		expect(steps.every((s) => s.status === 'done')).toBe(true);
		expect(journeyProgress(steps)).toMatchObject({ done: 5, total: 5, next: null });
	});
	it('adapte les premières mesures au type d’eau', () => {
		expect(firstMeasurementsLabel('recif')).toContain('calcium');
		expect(firstMeasurementsLabel('douce')).not.toContain('densité');
	});
});

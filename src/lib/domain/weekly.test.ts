import { describe, expect, it } from 'vitest';
import { weeklyReport, type WeeklyView } from './weekly';
import { DAY_MS } from './dates';
import type { Aquarium, AquariumEvent, Completion, Feeding, Measurement, Parameter, Task } from '../types';

// Dimanche 1er novembre 2026, 18:00 à Paris.
const NOW = Date.parse('2026-11-01T17:00:00Z');
const ago = (days: number) => new Date(NOW - days * DAY_MS).toISOString();

const aquarium = (id: number, name: string, stage: Aquarium['stage'] = 'actif'): Aquarium => ({
	id,
	name,
	waterType: 'douce',
	volumeL: 100,
	startedOn: '2026-01-01',
	coverPhotoId: null,
	stage
});
const param = (id: number, aquariumId: number, key: string, name: string, unit: string, min: number, max: number, decimals = 0): Parameter => ({
	id,
	aquariumId,
	key,
	name,
	unit,
	min,
	max,
	driftPerWeek: null,
	decimals,
	step: 1,
	position: id
});
const m = (parameterId: number, aquariumId: number, value: number, daysAgo: number): Measurement => ({ parameterId, aquariumId, value, measuredAt: ago(daysAgo) });
const task = (id: number, aquariumId: number, nextDue: string): Task => ({ id, aquariumId, title: `t${id}`, kind: id === 1 ? 'eau' : 'autre', everyDays: 7, nextDue, active: true });

const view = (over: Partial<WeeklyView> = {}): WeeklyView => ({
	aquariums: [aquarium(1, 'Salon')],
	parameters: [param(1, 1, 'ph', 'pH', '', 6, 8, 1), param(2, 1, 'no3', 'Nitrates (NO3)', 'mg/L', 5, 25)],
	measurements: [
		m(1, 1, 7, 5), m(1, 1, 7, 3), m(1, 1, 7, 1),
		m(2, 1, 15, 6), m(2, 1, 21, 3), m(2, 1, 27, 0)
	],
	tasks: [task(1, 1, '2026-11-08'), task(2, 1, '2026-11-01')],
	completions: [{ taskId: 1, doneAt: ago(2) } as Completion, { taskId: 1, doneAt: ago(9) } as Completion],
	events: [
		{ aquariumId: 1, kind: 'changement_eau', at: ago(2), payload: {} } as AquariumEvent,
		{ aquariumId: 1, kind: 'habitant_ajout', at: ago(4), payload: { species: 'Crevette Amano', quantity: 6 } } as AquariumEvent
	],
	...over
});

describe('weeklyReport', () => {
	it('donne la période de 7 jours se terminant le jour de now', () => {
		expect(weeklyReport(view(), NOW).period).toEqual({ from: '2026-10-26', to: '2026-11-01' });
	});

	it('compte les tâches faites sur la période et celles encore dues', () => {
		const r = weeklyReport(view(), NOW);
		expect(r.tasks.done).toBe(1); // la réalisation d'il y a 9 jours est hors période
		expect(r.tasks.due).toBe(2); // 1 faite + 1 encore due (échéance aujourd'hui)
		expect(r.tasks.ratio).toBe(0.5);
	});

	it('ferme le ratio quand il n’y avait rien à faire', () => {
		const r = weeklyReport(view({ tasks: [task(1, 1, '2026-12-01')], completions: [] }), NOW);
		expect(r.tasks).toEqual({ done: 0, due: 0, ratio: 1 });
		expect(r.summary).toContain('Aucune tâche prévue');
	});

	it('compte les mesures de la semaine par bac', () => {
		const r = weeklyReport(view(), NOW);
		expect(r.measurements.count).toBe(6);
		expect(r.measurements.perTank).toEqual([{ aquariumId: 1, name: 'Salon', count: 6 }]);
	});

	it('signale la valeur hors plage actuelle avec son bac', () => {
		const r = weeklyReport(view(), NOW);
		expect(r.outOfRange).toHaveLength(1);
		expect(r.outOfRange[0]).toMatchObject({ aquariumName: 'Salon', parameterName: 'Nitrates (NO3)', value: 27, unit: 'mg/L' });
		expect(r.summary).toBe('1 tâche sur 2, 1 valeur hors plage');
	});

	it('liste les paramètres stables mesurés dans la semaine', () => {
		const r = weeklyReport(view(), NOW);
		expect(r.stable.map((s) => s.parameterName)).toEqual(['pH']);
		expect(r.stable[0].score).toBe(100);
	});

	it('relève les variations marquantes, les changements d’eau et les arrivées', () => {
		const r = weeklyReport(view(), NOW);
		expect(r.highlights).toContain('Nitrates (NO3) +12 mg/L sur la semaine');
		expect(r.highlights).toContain('1 changement d’eau');
		expect(r.highlights).toContain('Arrivée : 6 × Crevette Amano');
		expect(r.waterChanges).toBe(1);
	});

	it('ajoute le nom du bac quand il y en a plusieurs', () => {
		const two = view({
			aquariums: [aquarium(1, 'Salon'), aquarium(2, 'Nano')],
		});
		expect(weeklyReport(two, NOW).highlights.some((h) => h.includes('(Salon)'))).toBe(true);
	});

	it('ignore les bacs en projet', () => {
		const r = weeklyReport(
			view({
				aquariums: [aquarium(1, 'Salon', 'projet')],
				events: [{ aquariumId: 1, kind: 'changement_eau', at: ago(1), payload: {} } as AquariumEvent]
			}),
			NOW
		);
		expect(r.measurements.count).toBe(0);
		expect(r.tasks).toEqual({ done: 0, due: 0, ratio: 1 });
		expect(r.outOfRange).toEqual([]);
		expect(r.waterChanges).toBe(0);
	});

	it('compte les nourrissages seulement quand le cache en contient', () => {
		expect(weeklyReport(view(), NOW).feedings).toBeNull();
		const feedings: Feeding[] = [
			{ aquariumId: 1, fedAt: ago(1) },
			{ aquariumId: 1, fedAt: ago(2) },
			{ aquariumId: 1, fedAt: ago(10) }
		];
		expect(weeklyReport(view({ feedings }), NOW).feedings).toEqual({ count: 2, perTank: [{ aquariumId: 1, name: 'Salon', count: 2 }] });
	});

	it('annonce que tout va bien sans valeur hors plage', () => {
		const calm = view({ measurements: [m(1, 1, 7, 5), m(1, 1, 7, 3), m(1, 1, 7, 1)] });
		expect(weeklyReport(calm, NOW).summary).toContain('tout est dans la plage');
	});
});

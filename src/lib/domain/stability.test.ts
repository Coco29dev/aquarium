import { describe, expect, it } from 'vitest';
import { activityRings, parameterStability, tankStability, testCadenceDays, testsDue } from './stability';
import { DAY_MS } from './dates';
import type { Aquarium, Completion, Measurement, Parameter, Task } from '../types';

const NOW = Date.parse('2026-10-30T10:00:00Z');
const ago = (days: number) => new Date(NOW - days * DAY_MS).toISOString();

const param = (id: number, key: string | null, min: number | null, max: number | null, aquariumId = 1): Parameter => ({
	id,
	aquariumId,
	key,
	name: key ?? 'p',
	unit: '',
	min,
	max,
	driftPerWeek: null,
	decimals: 1,
	step: 0.1,
	position: id
});
const m = (parameterId: number, value: number, daysAgo: number, aquariumId = 1): Measurement => ({
	parameterId,
	aquariumId,
	value,
	measuredAt: ago(daysAgo)
});

describe('parameterStability', () => {
	const ph = param(1, 'ph', 6, 8);

	it('donne 100 à une série constante dans la plage', () => {
		const s = parameterStability(ph, [m(1, 7, 20), m(1, 7, 10), m(1, 7, 1)], NOW);
		expect(s.score).toBe(100);
		expect(s.reason).toContain('Très stable');
	});
	it('refuse de noter avec moins de 3 mesures dans les 30 jours', () => {
		const s = parameterStability(ph, [m(1, 7, 20), m(1, 7, 10), m(1, 7, 45)], NOW);
		expect(s.score).toBeNull();
		expect(s.reason).toContain('2 sur 3');
	});
	it('ne note pas sans plage définie', () => {
		expect(parameterStability(param(1, 'ph', null, 8), [m(1, 7, 1), m(1, 7, 2), m(1, 7, 3)], NOW).score).toBeNull();
		expect(parameterStability(param(1, 'ph', 7, 7), [m(1, 7, 1), m(1, 7, 2), m(1, 7, 3)], NOW).score).toBeNull();
	});
	it('baisse quand la valeur oscille : un écart-type d’un quart de plage tombe à 0', () => {
		// plage 6–8 (largeur 2) ; valeurs 6,5 / 7,5 : σ = 0,5 = 0,25 × 2 → variabilité 1
		const s = parameterStability(ph, [m(1, 6.5, 1), m(1, 7.5, 2), m(1, 6.5, 3), m(1, 7.5, 4)], NOW);
		expect(s.score).toBe(0);
	});
	it('pénalise la part de mesures hors plage', () => {
		// 3 mesures à 7 et une à 9 : hors plage 25 %, σ = √(0,75) ≈ 0,866 → variabilité 1 → 0
		const wild = parameterStability(ph, [m(1, 7, 1), m(1, 7, 2), m(1, 7, 3), m(1, 9, 4)], NOW);
		expect(wild.score).toBe(0);
		// variation faible mais une mesure hors plage : 4 mesures à 7,9 et une à 8,1
		const edge = parameterStability(ph, [m(1, 7.9, 1), m(1, 7.9, 2), m(1, 7.9, 3), m(1, 7.9, 4), m(1, 8.1, 5)], NOW);
		expect(edge.score).toBeGreaterThan(0);
		expect(edge.score).toBeLessThan(80);
		expect(edge.reason).toContain('1 mesure sur 5 hors plage');
	});
	it('ignore les mesures d’un autre paramètre et celles du futur', () => {
		const s = parameterStability(ph, [m(2, 1, 1), m(1, 7, 1), m(1, 7, 2), m(1, 7, -2)], NOW);
		expect(s.score).toBeNull(); // seulement 2 mesures valides
	});
	it('ignore la variabilité quand on le demande (ammoniac, nitrites)', () => {
		const nh3 = param(3, 'nh3', 0, 0.05);
		const series = [m(3, 0, 1), m(3, 0.04, 2), m(3, 0, 3), m(3, 0.02, 4)];
		expect(parameterStability(nh3, series, NOW).score).toBeLessThan(100);
		expect(parameterStability(nh3, series, NOW, { ignoreVariability: true }).score).toBe(100);
	});
});

describe('tankStability', () => {
	it('moyenne les paramètres notés et ne compte que la part hors plage pour NH3 et NO2', () => {
		const parameters = [param(1, 'ph', 6, 8), param(2, 'no2', 0, 0.1), param(3, 'gh', null, null)];
		const measurements = [
			m(1, 7, 1), m(1, 7, 2), m(1, 7, 3),
			m(2, 0, 1), m(2, 0.08, 2), m(2, 0, 3)
		];
		const s = tankStability(parameters, measurements, NOW);
		expect(s.parameters.map((p) => p.parameterId)).toEqual([1, 2]);
		expect(s.parameters.find((p) => p.parameterId === 2)?.score).toBe(100);
		expect(s.score).toBe(100);
	});
	it('renvoie null s’il n’y a rien à noter', () => {
		expect(tankStability([param(1, 'ph', 6, 8)], [m(1, 7, 1)], NOW)).toEqual({ score: null, parameters: [] });
	});
});

describe('testsDue', () => {
	const parameters = [param(1, 'ph', 6, 8), param(2, 'nh3', 0, 0.05), param(3, 'kh', 3, 8)];
	it('applique 7 jours par défaut et 2 jours à NH3 et NO2 en cyclage', () => {
		expect(testCadenceDays({ key: 'nh3' }, 'cyclage')).toBe(2);
		expect(testCadenceDays({ key: 'nh3' }, 'actif')).toBe(7);
		expect(testCadenceDays({ key: 'ph' }, 'cyclage')).toBe(7);
	});
	it('compte les paramètres jamais mesurés ou trop anciens', () => {
		const measurements = [m(1, 7, 3), m(2, 0, 3)]; // kh jamais mesuré
		const actif = testsDue(parameters, measurements, 'actif', NOW);
		expect(actif.due.map((p) => p.id)).toEqual([3]);
		expect(actif).toMatchObject({ total: 3, upToDate: 2 });
		const cyclage = testsDue(parameters, measurements, 'cyclage', NOW);
		expect(cyclage.due.map((p) => p.id)).toEqual([2, 3]); // NH3 mesuré il y a 3 jours > 2
	});
	it('n’a rien à tester pour un bac en projet', () => {
		expect(testsDue(parameters, [], 'projet', NOW)).toEqual({ due: [], total: 0, upToDate: 0 });
	});
});

describe('activityRings', () => {
	const aquarium = (id: number, stage: Aquarium['stage']): Aquarium => ({
		id,
		name: `Bac ${id}`,
		waterType: 'douce',
		volumeL: 100,
		startedOn: '2026-01-01',
		coverPhotoId: null,
		stage
	});
	const task = (id: number, aquariumId: number, nextDue: string): Task => ({ id, aquariumId, title: `t${id}`, kind: 'autre', everyDays: 7, nextDue, active: true });
	const done = (taskId: number, daysAgo: number): Completion => ({ taskId, doneAt: ago(daysAgo) });

	it('compte tâches faites aujourd’hui et encore dues, tests à jour, stabilité', () => {
		const view = {
			aquariums: [aquarium(1, 'actif')],
			parameters: [param(1, 'ph', 6, 8), param(2, 'kh', 3, 8)],
			measurements: [m(1, 7, 1), m(1, 7, 2), m(1, 7, 3)],
			tasks: [task(1, 1, '2026-10-30'), task(2, 1, '2026-11-06')],
			completions: [done(2, 0)]
		};
		const r = activityRings(view, NOW);
		expect(r.tests).toEqual({ done: 1, total: 2, ratio: 0.5 });
		expect(r.tasks).toEqual({ done: 1, total: 2, ratio: 0.5 });
		expect(r.stability.score).toBe(100);
	});
	it('ignore les bacs en projet', () => {
		const view = {
			aquariums: [aquarium(1, 'projet')],
			parameters: [param(1, 'ph', 6, 8)],
			measurements: [],
			tasks: [task(1, 1, '2026-10-01')],
			completions: []
		};
		const r = activityRings(view, NOW);
		expect(r.tests).toEqual({ done: 0, total: 0, ratio: 1 });
		expect(r.tasks).toEqual({ done: 0, total: 0, ratio: 1 });
		expect(r.stability.score).toBeNull();
	});
	it('ferme l’anneau des tâches quand rien n’était dû', () => {
		const view = { aquariums: [aquarium(1, 'actif')], parameters: [], measurements: [], tasks: [task(1, 1, '2026-12-01')], completions: undefined };
		expect(activityRings(view, NOW).tasks).toEqual({ done: 0, total: 0, ratio: 1 });
	});
});

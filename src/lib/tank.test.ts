import { describe, expect, it } from 'vitest';
import { activeTanks, isProject, stageOf, tankHealth } from './tank';
import type { Aquarium, Snapshot } from './types';

const base = (over: Partial<Aquarium>): Aquarium => ({
	id: 1,
	name: 'Salon',
	waterType: 'douce',
	volumeL: 100,
	startedOn: '2026-01-01',
	coverPhotoId: null,
	stage: 'actif',
	...over
});
const view = (aquariums: Aquarium[]): Snapshot => ({
	generatedAt: '2026-10-30T10:00:00Z',
	aquariums,
	parameters: [],
	measurements: [],
	tasks: [{ id: 1, aquariumId: 1, title: 'Eau', kind: 'eau', everyDays: 7, nextDue: '2026-10-01', active: true }]
});

describe('étapes d’un bac', () => {
	it('traite un ancien cache sans étape comme actif', () => {
		expect(stageOf({} as Aquarium)).toBe('actif');
		expect(isProject({} as Aquarium)).toBe(false);
	});
	it('ne garde que les bacs en eau', () => {
		const v = view([base({ id: 1 }), base({ id: 2, stage: 'projet' }), base({ id: 3, stage: 'cyclage' })]);
		expect(activeTanks(v).map((a) => a.id)).toEqual([1, 3]);
	});
	it('un bac en projet n’a ni alerte ni tâche due', () => {
		const a = base({ stage: 'projet', startedOn: null });
		const h = tankHealth(view([a]), a, Date.parse('2026-10-30T10:00:00Z'));
		expect(h).toMatchObject({ level: 'projet', label: 'En projet', alerts: [], due: [] });
	});
	it('un bac en cyclage sans mesure est signalé en cyclage', () => {
		const a = base({ stage: 'cyclage' });
		const h = tankHealth(view([a]), a, Date.parse('2026-10-30T10:00:00Z'));
		expect(h.level).toBe('cycle');
	});
});

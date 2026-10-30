import { describe, expect, it } from 'vitest';
import { PARAMETER_TEMPLATES, suggestedTasks } from './templates';

describe('suggestedTasks', () => {
	it('ne propose rien pour un bac en projet', () => {
		expect(suggestedTasks('douce', 'projet')).toEqual([]);
	});
	it('propose seulement des tests rapprochés en cyclage, sans changement d’eau', () => {
		const tasks = suggestedTasks('recif', 'cyclage');
		expect(tasks).toHaveLength(1);
		expect(tasks[0]).toMatchObject({ kind: 'test', everyDays: 2 });
		expect(tasks.some((t) => t.kind === 'eau')).toBe(false);
	});
	it('propose la routine d’entretien pour un bac actif', () => {
		const kinds = suggestedTasks('douce', 'actif').map((t) => t.kind);
		expect(kinds).toEqual(['eau', 'filtre', 'test']);
	});
	it('ajoute le dosage en récif et l’engrais en planté', () => {
		expect(suggestedTasks('recif', 'actif').some((t) => t.kind === 'dosage' && t.everyDays === 1)).toBe(true);
		expect(suggestedTasks('plantee', 'actif').some((t) => t.kind === 'dosage' && t.everyDays === 2)).toBe(true);
		expect(suggestedTasks('mer', 'actif').some((t) => t.kind === 'dosage')).toBe(false);
	});
});

describe('modèles de paramètres', () => {
	it('donne un temps d’attente de test à l’ammoniac, aux nitrites et aux nitrates seulement', () => {
		for (const params of Object.values(PARAMETER_TEMPLATES)) {
			for (const p of params) {
				const waits = ['nh3', 'no2', 'no3'].includes(p.key ?? '');
				expect(p.testWaitSeconds != null).toBe(waits);
			}
		}
	});
});

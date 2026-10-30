import { describe, expect, it } from 'vitest';
import { contextualAdvice, dailyPicks, dayNumber, greeting, type AdviceFacts } from './advice';

const calm: AdviceFacts = { cycling: [], waterDays: 3, staleTests: false, nitrates: false, hasFish: true };

describe('greeting', () => {
	it('suit l’heure', () => {
		expect(greeting(7)).toBe('Bonjour');
		expect(greeting(14)).toBe('Bon après-midi');
		expect(greeting(20)).toBe('Bonsoir');
		expect(greeting(2)).toBe('Bonne nuit');
	});
});

describe('contextualAdvice', () => {
	it('ne dit rien quand tout va bien', () => {
		expect(contextualAdvice(calm)).toEqual([]);
	});
	it('met les nitrates avant le reste et ne répète pas le changement d’eau', () => {
		const list = contextualAdvice({ ...calm, nitrates: true, waterDays: 20, cycling: ['Salon'] });
		expect(list[0].ref).toBe('entretien/changement-eau');
		expect(list.filter((a) => a.ref === 'entretien/changement-eau')).toHaveLength(1);
		expect(list.map((a) => a.ref)).toContain('demarrer/cycle-azote');
	});
	it('signale un changement d’eau ancien et des tests en retard', () => {
		const list = contextualAdvice({ ...calm, waterDays: 16, staleTests: true });
		expect(list.map((a) => a.ref)).toEqual(['entretien/changement-eau', 'entretien/tests']);
		expect(list[0].why).toContain('16 jours');
	});
	it('propose les premiers poissons quand il n’y en a pas', () => {
		expect(contextualAdvice({ ...calm, hasFish: false })[0].ref).toBe('demarrer/premiers-poissons');
	});
});

describe('dailyPicks', () => {
	const all = Array.from({ length: 30 }, (_, i) => i);
	it('est stable sur une journée et change d’un jour à l’autre', () => {
		expect(dailyPicks(all, '2026-10-30', 3)).toEqual(dailyPicks(all, '2026-10-30', 3));
		expect(dailyPicks(all, '2026-10-30', 3)).not.toEqual(dailyPicks(all, '2026-10-31', 3));
	});
	it('ne renvoie pas de doublon, même avec une petite liste', () => {
		const picks = dailyPicks([1, 2, 3], '2026-10-30', 5);
		expect(new Set(picks).size).toBe(picks.length);
		expect(dailyPicks([], '2026-10-30', 3)).toEqual([]);
	});
	it('dayNumber est déterministe', () => {
		expect(dayNumber('2026-10-30')).toBe(dayNumber('2026-10-30'));
	});
});

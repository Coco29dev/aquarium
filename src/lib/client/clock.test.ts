import { describe, expect, it } from 'vitest';
import { clock, daysAway, parisHour, parisHourFraction } from './clock.svelte';

describe('parisHour', () => {
	it('donne l’heure de Paris, été comme hiver', () => {
		expect(parisHour(Date.parse('2026-11-03T08:30:00Z'))).toBe(9); // heure d'hiver : UTC+1
		expect(parisHour(Date.parse('2026-07-03T08:30:00Z'))).toBe(10); // heure d'été : UTC+2
		expect(parisHour(Date.parse('2026-11-03T22:59:00Z'))).toBe(23);
		expect(parisHour(Date.parse('2026-11-03T23:00:00Z'))).toBe(0);
	});
});

describe('parisHourFraction', () => {
	it('ajoute les minutes en fraction d’heure', () => {
		expect(parisHourFraction(Date.parse('2026-11-03T16:30:00Z'))).toBe(17.5);
		expect(parisHourFraction(Date.parse('2026-11-03T08:15:00Z'))).toBe(9.25);
		expect(parisHourFraction(Date.parse('2026-11-03T23:00:00Z'))).toBe(0);
		expect(parisHourFraction(Date.parse('2026-07-03T21:59:00Z'))).toBeCloseTo(23 + 59 / 60, 5);
	});
});

describe('daysAway', () => {
	it('compte les jours depuis la dernière ouverture', () => {
		expect(daysAway(null, '2026-11-03')).toBe(0);
		expect(daysAway('2026-11-03', '2026-11-03')).toBe(0);
		expect(daysAway('2026-10-29', '2026-11-03')).toBe(5);
		// Horloge de l'appareil en arrière : jamais négatif.
		expect(daysAway('2026-11-10', '2026-11-03')).toBe(0);
	});
});

describe('horloge', () => {
	it('suit l’instant posé, le jour et l’heure de Paris', () => {
		clock.set(Date.parse('2026-11-03T08:30:00Z'));
		expect(clock.today).toBe('2026-11-03');
		expect(clock.hour).toBe(9);
		expect(clock.hourFraction).toBe(9.5);
		clock.set(Date.parse('2026-11-03T21:30:00Z'));
		expect(clock.hour).toBe(22);
		// Après minuit à Paris, c'est déjà le jour suivant.
		clock.set(Date.parse('2026-11-03T23:30:00Z'));
		expect(clock.today).toBe('2026-11-04');
		expect(clock.hour).toBe(0);
	});
	it('note l’absence quand l’appli est reprise plusieurs jours plus tard', () => {
		clock.set(Date.parse('2026-11-10T09:00:00Z'));
		const before = clock.away;
		clock.set(Date.parse('2026-11-17T09:00:00Z'));
		expect(clock.away).toBe(7);
		expect(before).toBeLessThan(7);
		// Même jour : l'absence ne bouge pas.
		clock.set(Date.parse('2026-11-17T15:00:00Z'));
		expect(clock.away).toBe(7);
		// Le lendemain, on n'est plus « de retour ».
		clock.set(Date.parse('2026-11-18T09:00:00Z'));
		expect(clock.away).toBe(1);
	});
});

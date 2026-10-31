import { describe, expect, it } from 'vitest';
import { collectForecasts, forecastParameter } from './forecast';
import type { Measurement, Parameter, Task } from '../types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-30T10:00:00Z');
const at = (daysBefore: number) => new Date(NOW - daysBefore * DAY).toISOString();

const param = (id: number, key: string, min: number | null, max: number | null, driftPerWeek: number | null = 10): Parameter => ({
	id, aquariumId: 1, key, name: key === 'no3' ? 'Nitrates (NO3)' : key, unit: 'mg/L', min, max, driftPerWeek, decimals: 0, step: 1, position: id
});
const m = (parameterId: number, value: number, daysBefore: number): Measurement => ({
	parameterId, aquariumId: 1, value, measuredAt: at(daysBefore)
});

describe('prévision de sortie de plage', () => {
	const no3 = param(1, 'no3', 5, 40);

	it('annonce la sortie de plage au rythme actuel', () => {
		// +2 mg/L par jour, 30 aujourd'hui : 40 dans 5 jours.
		const f = forecastParameter(no3, [m(1, 20, 5), m(1, 24, 3), m(1, 28, 1), m(1, 30, 0)], NOW);
		expect(f?.direction).toBe('monte');
		expect(f?.days).toBe(5);
		expect(f?.message).toContain('dans 5 jours');
	});
	it('reste muette quand la valeur est stable', () => {
		expect(forecastParameter(no3, [m(1, 20, 6), m(1, 20.2, 3), m(1, 20, 0)], NOW)).toBeNull();
	});
	it('reste muette quand la sortie est lointaine', () => {
		expect(forecastParameter(no3, [m(1, 10, 6), m(1, 10.5, 3), m(1, 11, 0)], NOW)).toBeNull();
	});
	it('laisse l’alerte s’en charger quand la valeur est déjà hors plage', () => {
		expect(forecastParameter(no3, [m(1, 40, 4), m(1, 45, 2), m(1, 50, 0)], NOW)).toBeNull();
	});
	it('demande assez de mesures étalées dans le temps', () => {
		expect(forecastParameter(no3, [m(1, 20, 1), m(1, 30, 0.5), m(1, 35, 0)], NOW)).toBeNull();
		expect(forecastParameter(no3, [m(1, 20, 4), m(1, 35, 0)], NOW)).toBeNull();
	});
	it('ne regarde que ce qui suit le dernier changement d’eau', () => {
		const data = [m(1, 20, 6), m(1, 30, 4), m(1, 12, 2), m(1, 12.1, 1), m(1, 12, 0)];
		expect(forecastParameter(no3, data, NOW, NOW - 2.5 * DAY)).toBeNull();
	});
	it('annonce une baisse vers un plancher, sauf plancher nul', () => {
		const kh = param(2, 'kh', 4, 12, 2);
		const down = forecastParameter(kh, [m(2, 8, 6), m(2, 7, 4), m(2, 6, 2), m(2, 5, 0)], NOW);
		expect(down?.direction).toBe('baisse');
		expect(down?.days).toBe(2);
		const nh3 = param(3, 'nh3', 0, 0.25, 0.25);
		expect(forecastParameter(nh3, [m(3, 0.2, 6), m(3, 0.1, 3), m(3, 0.05, 0)], NOW)).toBeNull();
	});
});

describe('prévisions d’un bac', () => {
	const task: Task = { id: 7, aquariumId: 1, title: 'Eau', kind: 'eau', everyDays: 7, nextDue: '2026-11-01', active: true };
	it('trie par échéance et écarte l’ammoniac pendant le cyclage', () => {
		const parameters = [param(1, 'no3', 5, 40), param(2, 'kh', 4, 12, 2), param(3, 'nh3', 0, 0.25, 0.25)];
		const measurements = [
			m(1, 20, 5), m(1, 24, 3), m(1, 28, 1), m(1, 30, 0),
			m(2, 8, 6), m(2, 7, 4), m(2, 6, 2), m(2, 5, 0)
		];
		const list = collectForecasts({ parameters, measurements, tasks: [task] }, NOW);
		expect(list.map((f) => f.parameterId)).toEqual([2, 1]);
	});
});

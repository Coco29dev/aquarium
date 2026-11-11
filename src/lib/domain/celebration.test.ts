import { describe, expect, it } from 'vitest';
import { ACTION_WINDOW_MS, dayClosed, isClosed, shouldCelebrate, type RingsSnapshot } from './celebration';

const snap = (tasks: [number, number], tests: [number, number], day = '2026-11-03'): RingsSnapshot => ({
	day,
	tasks: { done: tasks[0], total: tasks[1] },
	tests: { done: tests[0], total: tests[1] }
});
const NOW = 1_800_000_000_000;
const base = { celebratedDay: null, lastActionAt: NOW - 2_000, nowMs: NOW };

describe('anneaux fermés', () => {
	it('un anneau sans rien à faire n’est jamais fermé', () => {
		expect(isClosed({ done: 0, total: 0 })).toBe(false);
		expect(isClosed({ done: 2, total: 3 })).toBe(false);
		expect(isClosed({ done: 3, total: 3 })).toBe(true);
	});
	it('la journée est bouclée quand tout ce qui avait du travail est fait', () => {
		expect(dayClosed(snap([2, 2], [0, 0]))).toBe(true);
		expect(dayClosed(snap([2, 2], [5, 5]))).toBe(true);
		expect(dayClosed(snap([2, 2], [3, 5]))).toBe(false);
		expect(dayClosed(snap([0, 0], [0, 0]))).toBe(false);
	});
});

describe('célébration', () => {
	it('célèbre la fermeture du dernier anneau, par un geste récent', () => {
		expect(shouldCelebrate({ ...base, before: snap([1, 2], [5, 5]), now: snap([2, 2], [5, 5]) })).toBe(true);
		expect(shouldCelebrate({ ...base, before: snap([2, 2], [3, 5]), now: snap([2, 2], [5, 5]) })).toBe(true);
	});
	it('ne célèbre jamais un faux positif (total à 0, rien à faire avant)', () => {
		expect(shouldCelebrate({ ...base, before: snap([0, 0], [0, 0]), now: snap([0, 0], [0, 0]) })).toBe(false);
		// Un total qui apparaît déjà complet n'est pas une réussite.
		expect(shouldCelebrate({ ...base, before: snap([0, 0], [0, 0]), now: snap([1, 1], [0, 0]) })).toBe(false);
		expect(shouldCelebrate({ ...base, before: snap([0, 0], [4, 4]), now: snap([0, 0], [4, 4]) })).toBe(false);
	});
	it('ne célèbre qu’une fois par jour', () => {
		expect(shouldCelebrate({ ...base, celebratedDay: '2026-11-03', before: snap([1, 2], [5, 5]), now: snap([2, 2], [5, 5]) })).toBe(false);
		expect(shouldCelebrate({ ...base, celebratedDay: '2026-11-02', before: snap([1, 2], [5, 5]), now: snap([2, 2], [5, 5]) })).toBe(true);
	});
	it('ne célèbre pas sans point de comparaison, ni d’un jour à l’autre', () => {
		expect(shouldCelebrate({ ...base, before: null, now: snap([2, 2], [5, 5]) })).toBe(false);
		expect(shouldCelebrate({ ...base, before: snap([1, 2], [5, 5], '2026-11-02'), now: snap([2, 2], [5, 5]) })).toBe(false);
	});
	it('ne célèbre pas un changement venu d’ailleurs (aucun geste récent)', () => {
		expect(shouldCelebrate({ ...base, lastActionAt: 0, before: snap([1, 2], [5, 5]), now: snap([2, 2], [5, 5]) })).toBe(false);
		expect(shouldCelebrate({ ...base, lastActionAt: NOW - ACTION_WINDOW_MS - 1, before: snap([1, 2], [5, 5]), now: snap([2, 2], [5, 5]) })).toBe(false);
	});
	it('ne célèbre pas tant qu’un anneau reste ouvert', () => {
		expect(shouldCelebrate({ ...base, before: snap([0, 2], [5, 5]), now: snap([1, 2], [5, 5]) })).toBe(false);
	});
});

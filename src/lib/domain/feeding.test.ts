import { describe, expect, it } from 'vitest';
import { feedingStatus, feedingsToday } from './feeding';
import type { Feeding } from '../types';

const f = (aquariumId: number, fedAt: string): Feeding => ({ aquariumId, fedAt });
const NOW = Date.parse('2026-10-30T10:00:00Z'); // 11 h à Paris (heure d'hiver : UTC+1 depuis le 25/10)

describe('feedingsToday', () => {
	it('compte les repas du jour du bac et renvoie le dernier', () => {
		const list = [
			f(1, '2026-10-30T06:30:00Z'),
			f(1, '2026-10-30T09:00:00Z'),
			f(2, '2026-10-30T08:00:00Z'),
			f(1, '2026-10-29T17:00:00Z')
		];
		expect(feedingsToday(list, 1, NOW)).toEqual({ count: 2, last: '2026-10-30T09:00:00Z' });
		expect(feedingsToday(list, 3, NOW)).toEqual({ count: 0, last: null });
	});
	it('utilise le jour calendaire de Paris, pas celui d’UTC', () => {
		// 23 h 30 UTC le 29 = 00 h 30 le 30 à Paris : compte pour aujourd'hui.
		const list = [f(1, '2026-10-29T23:30:00Z'), f(1, '2026-10-29T22:30:00Z')];
		expect(feedingsToday(list, 1, NOW).count).toBe(1);
	});
	it('gère l’heure d’été (UTC+2)', () => {
		const summer = Date.parse('2026-07-15T21:30:00Z'); // 23 h 30 à Paris le 15
		expect(feedingsToday([f(1, '2026-07-15T22:30:00Z')], 1, summer).count).toBe(0); // 00 h 30 le 16
		expect(feedingsToday([f(1, '2026-07-15T08:00:00Z')], 1, summer).count).toBe(1);
	});
});

describe('feedingStatus', () => {
	it('sans consigne, reste libre', () => {
		expect(feedingStatus(5, null)).toBe('libre');
		expect(feedingStatus(0, undefined)).toBe('libre');
	});
	it('suit la consigne', () => {
		expect(feedingStatus(0, 2)).toBe('ok');
		expect(feedingStatus(1, 2)).toBe('ok');
		expect(feedingStatus(2, 2)).toBe('complet');
		expect(feedingStatus(3, 2)).toBe('trop');
	});
});

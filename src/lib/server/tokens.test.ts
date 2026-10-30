import { describe, expect, it } from 'vitest';
import { lockDelaySeconds, recordTokenFailure, recordTokenSuccess, tokenLockRemaining } from './tokens';

describe('freinage des jetons invalides', () => {
	it('laisse 5 essais puis double le délai jusqu’au plafond', () => {
		expect([1, 4, 5, 6, 7, 8].map(lockDelaySeconds)).toEqual([0, 0, 30, 60, 120, 240]);
		expect(lockDelaySeconds(30)).toBe(900);
	});
	it('bloque une adresse après 5 échecs sans gêner les autres', () => {
		const now = 1_000_000;
		for (let i = 0; i < 4; i++) recordTokenFailure('1.1.1.1', now);
		expect(tokenLockRemaining('1.1.1.1', now)).toBe(0);
		recordTokenFailure('1.1.1.1', now);
		expect(tokenLockRemaining('1.1.1.1', now)).toBe(30);
		expect(tokenLockRemaining('2.2.2.2', now)).toBe(0);
		expect(tokenLockRemaining('1.1.1.1', now + 31_000)).toBe(0);
		recordTokenSuccess('1.1.1.1');
		recordTokenFailure('1.1.1.1', now);
		expect(tokenLockRemaining('1.1.1.1', now)).toBe(0);
	});
});

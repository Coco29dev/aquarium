import { describe, expect, it } from 'vitest';
import { backupDay, retainBackups } from './backups';

const key = (day: string) => `backups/aquarium-${day}.json`;
const days = (from: string, n: number) =>
	Array.from({ length: n }, (_, i) => new Date(Date.parse(`${from}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));

describe('rotation des sauvegardes', () => {
	it('lit la date dans la clé', () => {
		expect(backupDay(key('2026-10-31'))).toBe('2026-10-31');
		expect(backupDay('backups/autre.json')).toBeNull();
	});
	it('garde tout tant qu’il y en a peu', () => {
		const keys = days('2026-10-25', 7).map(key);
		expect(retainBackups(keys)).toEqual(keys);
	});
	it('garde 7 quotidiennes puis une par semaine, 4 semaines au plus', () => {
		const keys = days('2026-08-01', 92).map(key); // 1er août au 31 octobre
		const kept = retainBackups(keys);
		expect(kept.length).toBe(11);
		expect(kept.slice(-7)).toEqual(keys.slice(-7));
		const weekly = kept.slice(0, 4).map((k) => backupDay(k)!);
		expect(new Set(weekly.map((d) => Math.floor(Date.parse(`${d}T12:00:00Z`) / (7 * 86_400_000)))).size).toBe(4);
		expect(weekly.every((d) => d < '2026-10-25')).toBe(true);
	});
	it('garde une clé au format inconnu', () => {
		const keys = ['backups/ancienne.json', ...days('2026-10-01', 30).map(key)];
		expect(retainBackups(keys)).toContain('backups/ancienne.json');
	});
});

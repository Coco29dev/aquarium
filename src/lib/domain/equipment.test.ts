import { describe, expect, it } from 'vitest';
import { IDEAS } from '$lib/content/ideas';
import { equipmentFor, fold, isOwned, midPrice, totalOf } from './equipment';

const idea = (slug: string) => IDEAS.find((i) => i.slug === slug)!;

describe('matériel conseillé', () => {
	it('chaque idée, à chaque volume et pour chaque choix de plantes, donne une liste cohérente', () => {
		for (const i of IDEAS) {
			for (const planting of ['strict', 'mixte'] as const) {
				for (const volume of [i.volume[0], i.ref, i.volume[1]]) {
					const list = equipmentFor(i, volume, planting);
					const ids = list.map((s) => s.id);
					expect(new Set(ids).size, `${i.slug} doublons`).toBe(ids.length);
					expect(list.filter((s) => s.essential).length, `${i.slug} indispensables`).toBeGreaterThanOrEqual(5);
					for (const s of list) {
						expect(s.price[0], `${i.slug} ${s.id}`).toBeGreaterThan(0);
						expect(s.price[1], `${i.slug} ${s.id}`).toBeGreaterThan(s.price[0]);
						expect(s.keywords.length, `${i.slug} ${s.id}`).toBeGreaterThan(0);
					}
				}
			}
		}
	});

	it('les prix croissent avec le volume', () => {
		const i = idea('amazonie-claire');
		const small = totalOf(equipmentFor(i, 100, 'strict'));
		const big = totalOf(equipmentFor(i, 200, 'strict'));
		expect(big[0]).toBeGreaterThan(small[0]);
	});

	it('le choix de plantes change le matériel', () => {
		const strict = equipmentFor(idea('tanganyika-juliens'), 180, 'strict').map((s) => s.id);
		const mixed = equipmentFor(idea('tanganyika-juliens'), 180, 'mixte').map((s) => s.id);
		expect(strict).not.toContain('engrais');
		expect(mixed.length).toBeGreaterThanOrEqual(strict.length);
		expect(equipmentFor(idea('bac-neerlandais'), 150, 'strict').map((s) => s.id)).toEqual(expect.arrayContaining(['co2', 'engrais', 'sol-nutritif']));
	});

	it('adapte le matériel au milieu', () => {
		const ids = (slug: string, v: number) => equipmentFor(idea(slug), v, 'strict').map((s) => s.id);
		expect(ids('rio-negro-150', 150)).toEqual(expect.arrayContaining(['osmoseur', 'feuilles']));
		expect(ids('malawi-mbuna', 350)).toContain('durete');
		expect(ids('eau-fraiche-sans-chauffage', 80)).not.toContain('chauffage');
		expect(ids('recif-lps', 350)).toEqual(expect.arrayContaining(['ecumeur', 'osmoseur', 'refractometre', 'dosage']));
		expect(ids('hippocampes', 180)).toContain('refroidisseur');
	});

	it('reconnaît ce qui est déjà dans le projet', () => {
		const filtre = equipmentFor(idea('amazonie-claire'), 150, 'strict').find((s) => s.id === 'filtre')!;
		expect(isOwned(filtre, [{ label: 'Filtre extérieur Eheim 2217' }])).toBe(true);
		expect(isOwned(filtre, [{ label: 'Éclairage LED' }])).toBe(false);
		const lumiere = equipmentFor(idea('amazonie-claire'), 150, 'strict').find((s) => s.id === 'eclairage')!;
		expect(isOwned(lumiere, [{ label: 'Rampe ÉCLAIRAGE 90 cm' }])).toBe(true);
		expect(fold('Éclairage')).toBe('eclairage');
	});

	it('totalise une sélection et retient le milieu de fourchette', () => {
		expect(totalOf([{ price: [10, 20] }, { price: [5, 15] }])).toEqual([15, 35]);
		expect(midPrice({ price: [40, 90] })).toBe(65);
	});
});

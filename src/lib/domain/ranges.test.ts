import { describe, expect, it } from 'vitest';
import { compareWithTank, stockRanges } from './ranges';
import type { Parameter, Species } from '../types';

let nextId = 1;
const species = (name: string, tempMin: number | null, tempMax: number | null, phMin: number | null, phMax: number | null): Species =>
	({
		id: nextId++,
		source: 'noyau',
		scientificName: name,
		nameFr: name,
		nameEn: null,
		kind: 'poisson',
		fresh: true,
		brackish: false,
		salt: false,
		maxLengthCm: 5,
		lifespanYears: null,
		tempMin,
		tempMax,
		phMin,
		phMax,
		minTankL: null,
		temperament: null,
		diet: null,
		zone: null,
		groupMin: null,
		reefSafe: null,
		bioloadG: null,
		notes: null,
		estimated: [],
		description: null,
		origin: null,
		difficulty: null,
		care: null,
		light: null,
		co2: null,
		curated: true,
		dataQuality: null,
		hasPhoto: false,
		photoAuthor: null,
		photoLicense: null,
		photoSource: null
	}) as Species;

const param = (id: number, key: string, min: number | null, max: number | null): Parameter => ({
	id,
	aquariumId: 1,
	key,
	name: key,
	unit: '',
	min,
	max,
	driftPerWeek: null,
	decimals: 1,
	step: 0.1,
	position: id
});

describe('stockRanges', () => {
	it('fait l’intersection des plages de température et de pH', () => {
		const neon = species('Néon', 22, 26, 5.5, 7.5);
		const crevette = species('Crevette', 20, 25, 6.5, 8);
		const r = stockRanges([
			{ species: neon, quantity: 10 },
			{ species: crevette, quantity: 6 }
		]);
		expect(r.temp).toEqual({ min: 22, max: 25 });
		expect(r.ph).toEqual({ min: 6.5, max: 7.5 });
		expect(r.conflicts).toEqual([]);
		expect(r.contributors).toHaveLength(2);
	});
	it('ignore les espèces sans donnée et les quantités nulles', () => {
		const r = stockRanges([
			{ species: species('Sans fiche', null, null, null, null), quantity: 3 },
			{ species: species('Parti', 30, 32, null, null), quantity: 0 },
			{ species: species('Guppy', 22, 28, null, null), quantity: 4 }
		]);
		expect(r.temp).toEqual({ min: 22, max: 28 });
		expect(r.ph).toBeNull();
		expect(r.contributors.map((c) => c.name)).toEqual(['Guppy']);
	});
	it('nomme les espèces en conflit quand l’intersection est vide', () => {
		const r = stockRanges([
			{ species: species('Discus', 28, 31, 5, 6.5), quantity: 2 },
			{ species: species('Poisson rouge', 15, 24, 7, 8), quantity: 2 }
		]);
		expect(r.temp).toBeNull();
		expect(r.ph).toBeNull();
		expect(r.conflicts).toHaveLength(2);
		expect(r.conflicts[0]).toContain('Discus');
		expect(r.conflicts[0]).toContain('Poisson rouge');
		expect(r.conflicts[0]).toContain('aucune température');
		expect(r.conflicts[1]).toContain('aucun pH');
	});
	it('ne compte pas deux fois la même espèce', () => {
		const a = species('Néon', 22, 26, null, null);
		expect(stockRanges([{ species: a, quantity: 5 }, { species: a, quantity: 3 }]).contributors).toHaveLength(1);
	});
	it('renvoie tout vide sans stock', () => {
		expect(stockRanges([])).toEqual({ temp: null, ph: null, conflicts: [], contributors: [] });
	});
});

describe('compareWithTank', () => {
	const ranges = stockRanges([
		{ species: species('Néon', 22, 26, 5.5, 7.5), quantity: 10 },
		{ species: species('Crevette', 20, 25, 6.5, 8), quantity: 6 }
	]); // temp 22–25, pH 6.5–7.5

	it('dit ok quand la plage du bac est contenue dans celle des habitants', () => {
		const [t] = compareWithTank(ranges, [param(1, 'temp', 23, 24)]);
		expect(t).toMatchObject({ key: 'temp', level: 'ok', suggested: { min: 22, max: 25 } });
	});
	it('propose d’ajuster quand la plage du bac déborde', () => {
		const [t] = compareWithTank(ranges, [param(1, 'temp', 22, 27)]);
		expect(t.level).toBe('ajustable');
		expect(t.message).toContain('dépasse');
	});
	it('propose une plage quand le bac n’en a pas', () => {
		const [p] = compareWithTank(ranges, [param(2, 'ph', null, null)]);
		expect(p.level).toBe('ajustable');
		expect(p.message).toContain('Aucune plage');
	});
	it('signale un conflit quand les plages ne se recoupent pas', () => {
		const [t] = compareWithTank(ranges, [param(1, 'temp', 28, 30)]);
		expect(t.level).toBe('conflit');
	});
	it('signale le conflit des habitants quand ils n’ont rien en commun', () => {
		const conflict = stockRanges([
			{ species: species('Discus', 28, 31, null, null), quantity: 2 },
			{ species: species('Poisson rouge', 15, 24, null, null), quantity: 2 }
		]);
		const [t] = compareWithTank(conflict, [param(1, 'temp', 22, 26)]);
		expect(t).toMatchObject({ level: 'conflit', suggested: null });
		expect(t.message).toContain('Discus');
	});
	it('ne compare que les paramètres existants', () => {
		expect(compareWithTank(ranges, [param(3, 'kh', 3, 8)])).toEqual([]);
	});
});

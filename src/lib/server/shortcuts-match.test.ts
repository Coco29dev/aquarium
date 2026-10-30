import { describe, expect, it } from 'vitest';
import { ShortcutError, matchByName, normalize, ordinal, parseValue, pickAquarium, pickParameter, speakable } from './shortcuts-match';

const tanks = [
	{ id: 1, name: 'Salon' },
	{ id: 2, name: 'Nano récif' },
	{ id: 3, name: 'Nano plantée' }
];

describe('normalize', () => {
	it('retire accents, casse et ponctuation', () => {
		expect(normalize('  Nano-Récif !')).toBe('nano recif');
		expect(normalize('Température')).toBe('temperature');
	});
});

describe('pickAquarium', () => {
	it('prend le seul bac quand le nom est absent', () => {
		expect(pickAquarium([tanks[0]], undefined).id).toBe(1);
		expect(pickAquarium([tanks[0]], '').id).toBe(1);
	});
	it('exige un nom quand il y a plusieurs bacs, et les liste', () => {
		expect(() => pickAquarium(tanks)).toThrow(/Salon, Nano récif, Nano plantée/);
	});
	it('trouve par nom exact, sans accent, avec articles', () => {
		expect(pickAquarium(tanks, 'le salon').id).toBe(1);
		expect(pickAquarium(tanks, 'Nano recif').id).toBe(2);
		expect(pickAquarium(tanks, 'mon bac salon').id).toBe(1);
	});
	it('signale l’ambiguïté et l’inconnu avec le bon code', () => {
		expect(() => pickAquarium(tanks, 'nano')).toThrow(/Plusieurs aquariums/);
		try {
			pickAquarium(tanks, 'cuisine');
			throw new Error('attendu');
		} catch (e) {
			expect(e).toBeInstanceOf(ShortcutError);
			expect((e as ShortcutError).status).toBe(404);
		}
	});
	it('refuse quand il n’y a aucun aquarium', () => {
		expect(() => pickAquarium([], 'salon')).toThrow(/Aucun aquarium/);
	});
});

describe('matchByName', () => {
	it('préfère l’égalité exacte à l’inclusion', () => {
		const items = [{ id: 1, name: 'Filtre' }, { id: 2, name: 'Filtre externe' }];
		expect(matchByName(items, 'filtre', 'tâche').id).toBe(1);
	});
});

describe('pickParameter', () => {
	const params = [
		{ id: 1, key: 'temp', name: 'Température' },
		{ id: 2, key: 'ph', name: 'pH' },
		{ id: 3, key: 'kh', name: 'KH' },
		{ id: 4, key: 'no3', name: 'Nitrates (NO3)' },
		{ id: 5, key: 'nh3', name: 'Ammoniac (NH3/NH4)' }
	];
	it('trouve par clé, alias et nom', () => {
		expect(pickParameter(params, 'NO3', 'Salon').id).toBe(4);
		expect(pickParameter(params, 'nitrates', 'Salon').id).toBe(4);
		expect(pickParameter(params, 'pH', 'Salon').id).toBe(2);
		expect(pickParameter(params, 'température', 'Salon').id).toBe(1);
		expect(pickParameter(params, 'ammoniaque', 'Salon').id).toBe(5);
		expect(pickParameter(params, 'kh', 'Salon').id).toBe(3);
	});
	it('signale un paramètre inconnu en listant les autres', () => {
		expect(() => pickParameter(params, 'cuivre', 'Salon')).toThrow(/Je ne trouve pas le paramètre « cuivre » pour Salon/);
		expect(() => pickParameter(params, '', 'Salon')).toThrow(/Quel paramètre/);
	});
});

describe('parseValue', () => {
	it('lit les nombres à la française et avec unité', () => {
		expect(parseValue(25)).toBe(25);
		expect(parseValue('25')).toBe(25);
		expect(parseValue('7,2')).toBe(7.2);
		expect(parseValue(' 25.5 mg/L ')).toBe(25.5);
		expect(parseValue('-1,5')).toBe(-1.5);
	});
	it('refuse le reste', () => {
		expect(() => parseValue('beaucoup')).toThrow(ShortcutError);
		expect(() => parseValue(undefined)).toThrow(/Valeur manquante/);
		expect(() => parseValue(NaN)).toThrow(ShortcutError);
	});
});

describe('ordinal', () => {
	it('écrit 1er, 2e, 3e', () => {
		expect([1, 2, 3].map(ordinal)).toEqual(['1er', '2e', '3e']);
	});
});

describe('speakable', () => {
	it('retire les parenthèses lues de travers par la synthèse vocale', () => {
		expect(speakable('Nitrates (NO3)')).toBe('Nitrates');
		expect(speakable('Ammoniac (NH3/NH4)')).toBe('Ammoniac');
		expect(speakable('Nitrates (NO3) à 26 mg/L : au-dessus de 25')).toBe('Nitrates à 26 mg/L : au-dessus de 25');
		expect(speakable('pH')).toBe('pH');
	});
});

describe('formulation des erreurs', () => {
	it('élide devant une voyelle', () => {
		expect(() => pickAquarium(tanks, 'cuisine')).toThrow(/Je ne trouve pas d'aquarium/);
		expect(() => matchByName([{ id: 1, name: 'Filtre' }], 'zzz', 'tâche')).toThrow(/Je ne trouve pas de tâche/);
	});
});

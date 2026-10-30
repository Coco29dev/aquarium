import { describe, expect, it } from 'vitest';
import { bioload, checkCompatibility, estimateMinTankL, speciesBioloadG, type TankContext } from './species';
import { consumableLife } from './consumables';
import type { Species } from '../types';

let nextId = 1;
const species = (over: Partial<Species>): Species => ({
	id: nextId++,
	source: 'maison',
	scientificName: 'Test test',
	nameFr: null,
	nameEn: null,
	kind: 'poisson',
	fresh: true,
	brackish: false,
	salt: false,
	maxLengthCm: 5,
	lifespanYears: null,
	tempMin: null,
	tempMax: null,
	phMin: null,
	phMax: null,
	minTankL: null,
	temperament: 'paisible',
	diet: 'omnivore',
	zone: null,
	groupMin: null,
	reefSafe: null,
	bioloadG: null,
	notes: null,
	estimated: [],
	description: null,
	curated: true,
	dataQuality: null,
	hasPhoto: false,
	photoAuthor: null,
	photoLicense: null,
	photoSource: null,
	...over
});

const fresh100: TankContext = { waterType: 'douce', volumeL: 100, tempMin: 22, tempMax: 26 };
const reef200: TankContext = { waterType: 'recif', volumeL: 200 };
const messages = (tank: TankContext, ...items: [Species, number][]) =>
	checkCompatibility(tank, items.map(([s, quantity]) => ({ species: s, quantity })));

describe('compatibilité', () => {
	it('bloque une espèce marine en eau douce, avec explication', () => {
		const clown = species({ nameFr: 'Poisson-clown', fresh: false, salt: true });
		const issues = messages(fresh100, [clown, 2]);
		expect(issues[0].severity).toBe('bloquant');
		expect(issues[0].message).toContain('eau de mer');
	});

	it('signale l’eau saumâtre comme un avertissement', () => {
		const molly = species({ nameFr: 'Molly', fresh: false, brackish: true });
		expect(messages(fresh100, [molly, 3])[0].severity).toBe('attention');
	});

	it('compare le volume du bac au minimum (explicite = bloquant, estimé = attention)', () => {
		const explicit = species({ nameFr: 'Scalaire', minTankL: 200 });
		expect(messages(fresh100, [explicit, 2]).find((i) => i.message.includes('200 L'))?.severity).toBe('bloquant');
		const big = species({ nameFr: 'Grand', maxLengthCm: 40 });
		const issue = messages(fresh100, [big, 1]).find((i) => i.message.includes('estimation'));
		expect(issue?.severity).toBe('attention');
	});

	it('détecte l’absence de température commune entre deux espèces et avec le bac', () => {
		const cold = species({ nameFr: 'Poisson rouge', tempMin: 15, tempMax: 21 });
		const warm = species({ nameFr: 'Discus', tempMin: 28, tempMax: 31 });
		const pair = messages({ waterType: 'douce', volumeL: 500 }, [cold, 3], [warm, 4]);
		expect(pair.some((i) => i.severity === 'bloquant' && i.message.includes('aucune température'))).toBe(true);
		const withTank = messages(fresh100, [cold, 3]);
		expect(withTank.some((i) => i.severity === 'bloquant' && i.message.includes('le bac vise'))).toBe(true);
	});

	it('exige un groupe minimal', () => {
		const neon = species({ nameFr: 'Néon', groupMin: 6, maxLengthCm: 3 });
		expect(messages(fresh100, [neon, 3]).some((i) => i.message.includes('au moins 6'))).toBe(true);
		expect(messages(fresh100, [neon, 8]).some((i) => i.message.includes('au moins 6'))).toBe(false);
	});

	it('signale la prédation selon la taille et le régime', () => {
		const oscar = species({ nameFr: 'Oscar', diet: 'carnivore', maxLengthCm: 30, temperament: 'semi-agressif' });
		const neon = species({ nameFr: 'Néon', maxLengthCm: 3 });
		const issue = messages({ waterType: 'douce', volumeL: 1000 }, [oscar, 1], [neon, 10]).find((i) => i.message.includes('peut manger'));
		expect(issue?.severity).toBe('attention');
		const aggressive = { ...oscar, id: 999, temperament: 'agressif' as const };
		const bloquant = messages({ waterType: 'douce', volumeL: 1000 }, [aggressive, 1], [neon, 10]).find((i) => i.message.includes('peut manger'));
		expect(bloquant?.severity).toBe('bloquant');
	});

	it('ne signale pas de prédation entre poissons de tailles proches', () => {
		const a = species({ diet: 'carnivore', maxLengthCm: 10 });
		const b = species({ maxLengthCm: 8 });
		expect(messages({ waterType: 'douce', volumeL: 500 }, [a, 1], [b, 1]).some((i) => i.message.includes('peut manger'))).toBe(false);
	});

	it('tempérament : agressif avec paisible, et espèce agressive en nombre', () => {
		const bully = species({ nameFr: 'Cichlidé', temperament: 'agressif' });
		const calm = species({ nameFr: 'Guppy', temperament: 'paisible' });
		const issues = messages({ waterType: 'douce', volumeL: 500 }, [bully, 2], [calm, 5]);
		expect(issues.some((i) => i.message.includes('harceler'))).toBe(true);
		expect(issues.some((i) => i.message.includes('plusieurs individus'))).toBe(true);
	});

	it('récif : bloque une espèce non reef safe, signale herbivore en bac planté', () => {
		const bad = species({ nameFr: 'Poisson papillon', fresh: false, salt: true, reefSafe: false, maxLengthCm: 15 });
		expect(messages(reef200, [bad, 1]).some((i) => i.severity === 'bloquant' && i.message.includes('reef safe'))).toBe(true);
		const plec = species({ nameFr: 'Silver dollar', diet: 'herbivore' });
		expect(messages({ waterType: 'plantee', volumeL: 300 }, [plec, 6]).some((i) => i.message.includes('brouter'))).toBe(true);
	});

	it('signale les fiches incomplètes en info, après les problèmes', () => {
		const sparse = species({ nameFr: 'Inconnu', temperament: null, maxLengthCm: null });
		const issues = messages(fresh100, [sparse, 1]);
		expect(issues.at(-1)?.severity).toBe('info');
		expect(issues.at(-1)?.message).toContain('incomplète');
	});

	it('ordonne bloquant, attention, info', () => {
		const sparse = species({ nameFr: 'X', temperament: null, fresh: false, salt: true });
		const issues = messages(fresh100, [sparse, 1]);
		const order = issues.map((i) => i.severity);
		expect(order).toEqual([...order].sort((a, b) => ['bloquant', 'attention', 'info'].indexOf(a) - ['bloquant', 'attention', 'info'].indexOf(b)));
	});
});

describe('volume minimal estimé', () => {
	it('croît avec la taille et reste nul sans taille', () => {
		expect(estimateMinTankL(null)).toBeNull();
		expect(estimateMinTankL(5)!).toBeLessThan(estimateMinTankL(20)!);
		expect(estimateMinTankL(10)).toBe(80);
		expect(estimateMinTankL(2)).toBe(20);
		expect(estimateMinTankL(30)).toBe(720);
	});
});

describe('charge biologique', () => {
	it('estime la masse adulte et la compare à la capacité', () => {
		const tang = species({ maxLengthCm: 20 });
		expect(speciesBioloadG(tang)).toBeCloseTo(96, 0);
		const result = bioload({ waterType: 'recif', volumeL: 300 }, [{ species: tang, quantity: 1 }]);
		expect(result.capacityG).toBe(105);
		expect(result.level).toBe('limite'); // 96 g sur 105 g
		expect(bioload({ waterType: 'recif', volumeL: 1000 }, [{ species: tang, quantity: 1 }]).level).toBe('ok');
	});

	it('passe en surcharge', () => {
		const angel = species({ maxLengthCm: 15 });
		const result = bioload({ waterType: 'douce', volumeL: 100 }, [{ species: angel, quantity: 6 }]);
		expect(result.level).toBe('surcharge');
		expect(result.ratio!).toBeGreaterThan(1);
	});

	it('ne compte ni coraux ni plantes, et liste les tailles inconnues', () => {
		const coral = species({ kind: 'corail', maxLengthCm: 30 });
		const unknown = species({ nameFr: 'Mystère', maxLengthCm: null });
		const result = bioload({ waterType: 'recif', volumeL: 100 }, [
			{ species: coral, quantity: 3 },
			{ species: unknown, quantity: 1 }
		]);
		expect(result.loadG).toBe(0);
		expect(result.unknown).toEqual(['Mystère']);
	});

	it('utilise la valeur saisie à la main en priorité', () => {
		expect(speciesBioloadG(species({ maxLengthCm: 20, bioloadG: 10 }))).toBe(10);
	});

	it('sans volume, pas de ratio', () => {
		const result = bioload({ waterType: 'douce', volumeL: null }, [{ species: species({}), quantity: 1 }]);
		expect(result.ratio).toBeNull();
		expect(result.level).toBeNull();
	});
});

describe('durée de vie des consommables', () => {
	const c = { installedOn: '2026-10-01', replaceEveryDays: 30, unitPrice: 12 };

	it('utilise la fréquence prévue sans historique', () => {
		const life = consumableLife(c, [], '2026-10-10');
		expect(life.dueOn).toBe('2026-10-31');
		expect(life.daysLeft).toBe(21);
		expect(life.status).toBe('ok');
		expect(life.costPerMonth).toBeCloseTo(12.16, 1);
	});

	it('passe à « bientôt » puis « en retard »', () => {
		expect(consumableLife(c, [], '2026-10-20').status).toBe('bientot');
		expect(consumableLife(c, [], '2026-11-05').status).toBe('en_retard');
	});

	it('mesure la durée réelle dès deux remplacements et propose d’ajuster', () => {
		const history = [
			{ installedOn: '2026-06-01', replacedOn: '2026-07-01' }, // 30 j
			{ installedOn: '2026-07-01', replacedOn: '2026-08-30' }, // 60 j
			{ installedOn: '2026-08-30', replacedOn: '2026-10-29' } // 60 j
		];
		const life = consumableLife({ installedOn: '2026-10-29', replaceEveryDays: 30, unitPrice: null }, history, '2026-11-01');
		expect(life.observedDays).toBe(50);
		expect(life.effectiveDays).toBe(50);
		expect(life.dueOn).toBe('2026-12-18');
		expect(life.suggestion).toContain('50 j');
		expect(life.costPerMonth).toBeNull();
	});

	it('ne propose rien quand la durée mesurée colle au prévu', () => {
		const history = [
			{ installedOn: '2026-08-01', replacedOn: '2026-08-31' },
			{ installedOn: '2026-08-31', replacedOn: '2026-09-30' }
		];
		expect(consumableLife(c, history, '2026-10-02').suggestion).toBeNull();
	});

	it('statut inconnu sans date ni fréquence', () => {
		expect(consumableLife({ installedOn: null, replaceEveryDays: null, unitPrice: null }, [], '2026-10-30').status).toBe('inconnu');
	});
});

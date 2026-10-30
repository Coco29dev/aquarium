import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { IDEAS, speciesNamesOf } from './index';
import { VOLUME_CLASSES, fitOf, ideasFor, ideasWithSpecies, planIdea, volumeClassOf } from '$lib/domain/ideas';
import type { Species } from '$lib/types';

// Les idées citent des espèces par leur nom latin : chacune doit exister dans le noyau (data/core).

interface Core {
	s: string; fr?: string; en?: string; k: Species['kind']; w: 'd' | 'm' | 'sd'; L?: number; v?: number;
	t?: [number, number]; p?: [number, number]; b?: number; m?: Species['temperament']; r?: Species['diet'];
	z?: Species['zone']; g?: number; rf?: boolean; bl?: number;
}

const core = new Map<string, Core>();
for (const file of readdirSync('data/core').filter((f) => f.endsWith('.jsonl'))) {
	for (const line of readFileSync(`data/core/${file}`, 'utf8').split('\n')) {
		if (line.trim()) {
			const e = JSON.parse(line) as Core;
			core.set(e.s.toLowerCase(), e);
		}
	}
}

let nextId = 1;
const ids = new Map<string, number>();
function speciesOf(latin: string): Species | null {
	const e = core.get(latin.toLowerCase());
	if (!e) return null;
	if (!ids.has(e.s)) ids.set(e.s, nextId++);
	return {
		id: ids.get(e.s) as number, source: 'noyau', scientificName: e.s, nameFr: e.fr ?? null, nameEn: e.en ?? null, kind: e.k,
		fresh: e.w === 'd' || e.w === 'sd', brackish: e.w === 'sd', salt: e.w === 'm', maxLengthCm: e.L ?? null, lifespanYears: e.v ?? null,
		tempMin: e.t?.[0] ?? null, tempMax: e.t?.[1] ?? null, phMin: e.p?.[0] ?? null, phMax: e.p?.[1] ?? null, minTankL: e.b ?? null,
		temperament: e.m ?? null, diet: e.r ?? null, zone: e.z ?? null, groupMin: e.g ?? null, reefSafe: e.rf ?? null, bioloadG: e.bl ?? null,
		notes: null, estimated: [], description: null, origin: null, difficulty: null, care: null, light: null, co2: null, curated: true,
		dataQuality: 'claude', hasPhoto: false, photoAuthor: null, photoLicense: null, photoSource: null
	};
}

describe('catalogue d’idées', () => {
	it('chaque identifiant est unique', () => {
		const slugs = IDEAS.map((i) => i.slug);
		expect(new Set(slugs).size).toBe(slugs.length);
	});

	it('chaque espèce citée existe dans le noyau', () => {
		const missing = IDEAS.flatMap((i) => speciesNamesOf(i).filter((n) => !core.has(n.toLowerCase())).map((n) => `${i.slug} : ${n}`));
		expect(missing).toEqual([]);
	});

	it('les fiches sont complètes et cohérentes', () => {
		for (const i of IDEAS) {
			expect(i.volume[0], i.slug).toBeLessThan(i.volume[1]);
			expect(i.ref, i.slug).toBeGreaterThanOrEqual(i.volume[0]);
			expect(i.ref, i.slug).toBeLessThanOrEqual(i.volume[1]);
			expect(i.conditions.temp[0], i.slug).toBeLessThan(i.conditions.temp[1]);
			expect(i.stock.length, i.slug).toBeGreaterThanOrEqual(1);
			expect(i.summary.length, i.slug).toBeGreaterThan(40);
			expect(i.decor.length, i.slug).toBeGreaterThan(40);
		}
	});

	it('couvre toutes les tailles de bac, en eau douce comme en mer', () => {
		for (const c of VOLUME_CLASSES) {
			const mid = Math.min(c.to === Infinity ? 600 : c.to - 1, Math.max(c.from, 1) + 20);
			expect(ideasFor(IDEAS, mid, 'plantee').length, `douce ${c.label}`).toBeGreaterThanOrEqual(c.id === 'tres-grand' ? 2 : 4);
		}
		expect(ideasFor(IDEAS, 60, 'recif').length).toBeGreaterThanOrEqual(2);
		expect(ideasFor(IDEAS, 150, 'recif').length).toBeGreaterThanOrEqual(3);
		expect(ideasFor(IDEAS, 300, 'mer').length).toBeGreaterThanOrEqual(1);
	});

	it('propose plusieurs idées différentes pour 150 L', () => {
		const list = ideasFor(IDEAS, 150, 'plantee');
		expect(list.length).toBeGreaterThanOrEqual(8);
		expect(list.slice(0, 6).filter((i) => i.volume[0] <= 150 && i.volume[1] >= 150).length).toBe(6);
	});
});

describe('plantes des idées', () => {
	it('chaque idée a une liste, le strict est inclus dans le mixte', () => {
		for (const i of IDEAS) {
			expect(i.plants.mixed.length >= i.plants.strict.length, i.slug).toBe(true);
			for (const p of i.plants.strict) expect(i.plants.mixed, `${i.slug} ${p}`).toContain(p);
			expect(new Set(i.plants.mixed).size, `${i.slug} doublons`).toBe(i.plants.mixed.length);
		}
	});

	it('chaque plante existe dans le noyau, du bon type et du bon milieu', () => {
		for (const i of IDEAS) {
			const salt = i.water === 'mer' || i.water === 'recif';
			for (const name of i.plants.mixed) {
				const e = core.get(name.toLowerCase());
				expect(e, `${i.slug} : ${name}`).toBeTruthy();
				expect(e!.k, `${i.slug} : ${name}`).toBe('plante');
				expect(salt ? e!.w === 'm' : e!.w !== 'm', `${i.slug} : ${name} (eau)`).toBe(true);
			}
		}
	});

	it('les plantes tolèrent la température de l’idée', () => {
		for (const i of IDEAS) {
			for (const name of i.plants.strict) {
				const t = core.get(name.toLowerCase())?.t;
				if (!t) continue;
				expect(Math.min(t[1], i.conditions.temp[1]) - Math.max(t[0], i.conditions.temp[0]), `${i.slug} : ${name}`).toBeGreaterThan(0);
			}
		}
	});

	it('les biotopes sans plantes existent (lacs rocheux, récif) et le strict est plus court que le mixte ailleurs', () => {
		expect(IDEAS.find((i) => i.slug === 'malawi-mbuna')!.plants.strict).toEqual([]);
		expect(IDEAS.find((i) => i.slug === 'recif-lps')!.plants.strict).toEqual([]);
		expect(IDEAS.find((i) => i.slug === 'amazonie-claire')!.plants.strict.length).toBeGreaterThan(2);
	});
});

describe('quantités et charge', () => {
	const samples = (i: (typeof IDEAS)[number]) => [i.volume[0], i.ref, i.volume[1]];

	for (const idea of IDEAS) {
		it(`${idea.slug} : pas de conflit bloquant ni de surcharge dans sa fourchette`, () => {
			for (const volume of samples(idea)) {
				const plan = planIdea(idea, volume, speciesOf);
				expect(plan.analysed, idea.slug).toBe(true);
				const blocking = plan.issues.filter((x) => x.severity === 'bloquant').map((x) => `${volume} L : ${x.message}`);
				expect(blocking, idea.slug).toEqual([]);
				expect(plan.bioload?.level, `${idea.slug} à ${volume} L`).not.toBe('surcharge');
				for (const line of plan.lines) {
					expect(line.quantity, `${idea.slug} ${line.latin}`).toBeGreaterThanOrEqual(1);
				}
			}
		});
	}

	it('les quantités des bancs suivent le volume', () => {
		const idea = IDEAS.find((i) => i.slug === 'amazonie-claire')!;
		const small = planIdea(idea, 100, speciesOf).lines.find((l) => l.latin === 'Paracheirodon innesi')!;
		const big = planIdea(idea, 200, speciesOf).lines.find((l) => l.latin === 'Paracheirodon innesi')!;
		expect(big.quantity).toBeGreaterThan(small.quantity);
	});

	it('un bac trop petit est signalé', () => {
		const idea = IDEAS.find((i) => i.slug === 'discus-amazonie')!;
		expect(planIdea(idea, 120, speciesOf).tooSmall).toBe(true);
		expect(planIdea(idea, 300, speciesOf).tooSmall).toBe(false);
	});

	it('sans fiches chargées, renvoie seulement les quantités', () => {
		const plan = planIdea(IDEAS[0], 20);
		expect(plan.analysed).toBe(false);
		expect(plan.bioload).toBeNull();
	});
});

describe('sélection', () => {
	it('classe les tailles', () => {
		expect(volumeClassOf(20).id).toBe('nano');
		expect(volumeClassOf(150).id).toBe('moyen');
		expect(volumeClassOf(1000).id).toBe('tres-grand');
	});

	it('une fourchette n’est pas stricte', () => {
		const idea = IDEAS.find((i) => i.slug === 'amazonie-claire')!;
		expect(fitOf(idea, 150)).toBe('ideal');
		expect(fitOf(idea, 95)).toBe('proche');
		expect(fitOf(idea, 30)).toBeNull();
	});

	it('sépare l’eau douce de la mer', () => {
		expect(ideasFor(IDEAS, 150, 'douce').every((i) => i.water === 'douce' || i.water === 'plantee')).toBe(true);
		expect(ideasFor(IDEAS, 150, 'recif').every((i) => i.water === 'recif')).toBe(true);
	});

	it('retrouve les idées d’une espèce', () => {
		expect(ideasWithSpecies(IDEAS, 'paracheirodon axelrodi').length).toBeGreaterThanOrEqual(2);
	});
});

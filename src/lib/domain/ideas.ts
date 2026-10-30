import type { Species, WaterType } from '../types';
import { bioload, checkCompatibility, speciesBioloadG, type Bioload, type Issue, type StockItem } from './species';

// Idées de peuplement : un biotope, un volume, une liste d'espèces avec des quantités qui s'adaptent au bac.

export type StockRole = 'banc' | 'vedette' | 'fond' | 'surface' | 'nettoyeur' | 'invertebre' | 'corail';

/** [nom latin, quantité conseillée au volume de référence, rôle, minimum, maximum] */
export type StockLine = [latin: string, n: number, role: StockRole, min?: number, max?: number];

export interface Idea {
	slug: string;
	title: string;
	summary: string;
	/** Provenance ou style (« Amazonie », « Bac néerlandais »…). */
	region: string;
	water: WaterType;
	/** Fourchette de volume où l'idée fonctionne bien, en litres. Indicative, pas stricte. */
	volume: [min: number, max: number];
	/** Volume pour lequel les quantités de `stock` sont écrites. */
	ref: number;
	/** 1 facile, 2 intermédiaire, 3 exigeant. */
	level: 1 | 2 | 3;
	tags: string[];
	conditions: { temp: [number, number]; ph: [number, number]; dgh?: [number, number] };
	decor: string;
	/** Plantes (ou macro-algues) conseillées : noms latins de l'encyclopédie, hors calcul de charge. */
	plants?: string[];
	stock: StockLine[];
	/**
	 * Bac volontairement dense (mbuna, Tanganyika) : on y entasse les poissons territoriaux pour disperser leur hargne,
	 * avec une filtration très puissante. La capacité biologique est multipliée par ce facteur (défaut 1).
	 */
	dense?: number;
	tip?: string;
	warn?: string;
	/** Guide de l'encyclopédie sur le même milieu, « thème/guide ». */
	guide?: string;
}

export const LEVEL_NAMES: Record<Idea['level'], string> = { 1: 'Facile', 2: 'Intermédiaire', 3: 'Exigeant' };

export interface VolumeClass {
	id: 'nano' | 'petit' | 'moyen' | 'grand' | 'tres-grand';
	label: string;
	range: string;
	/** Bornes en litres : de `from` inclus à `to` exclu. */
	from: number;
	to: number;
}

export const VOLUME_CLASSES: VolumeClass[] = [
	{ id: 'nano', label: 'Nano', range: 'moins de 50 L', from: 0, to: 50 },
	{ id: 'petit', label: 'Petit bac', range: '50 à 120 L', from: 50, to: 120 },
	{ id: 'moyen', label: 'Bac moyen', range: '120 à 250 L', from: 120, to: 250 },
	{ id: 'grand', label: 'Grand bac', range: '250 à 500 L', from: 250, to: 500 },
	{ id: 'tres-grand', label: 'Très grand bac', range: '500 L et plus', from: 500, to: Infinity }
];

export const volumeClassOf = (volumeL: number): VolumeClass =>
	VOLUME_CLASSES.find((c) => volumeL >= c.from && volumeL < c.to) ?? VOLUME_CLASSES[VOLUME_CLASSES.length - 1];

export const volumeLabel = (idea: Pick<Idea, 'volume'>) => `${idea.volume[0]} à ${idea.volume[1]} L`;

/** Les fourchettes sont indicatives : un bac un peu plus petit ou plus grand reste proposé. */
const TOLERANCE_BELOW = 0.9;
const TOLERANCE_ABOVE = 1.35;

export type Fit = 'ideal' | 'proche';

/** « ideal » dans la fourchette ; « proche » dans la marge ; null au-delà. */
export function fitOf(idea: Pick<Idea, 'volume'>, volumeL: number): Fit | null {
	const [min, max] = idea.volume;
	if (volumeL >= min && volumeL <= max) return 'ideal';
	if (volumeL >= min * TOLERANCE_BELOW && volumeL <= max * TOLERANCE_ABOVE) return 'proche';
	return null;
}

/** Distance relative au milieu de la fourchette (0 = au centre) : sert à classer les idées. */
function centerDistance(idea: Pick<Idea, 'volume'>, volumeL: number): number {
	const [min, max] = idea.volume;
	return Math.abs(Math.log(volumeL / Math.sqrt(min * max)));
}

const isSalt = (w: WaterType) => w === 'mer' || w === 'recif';

/** Eau douce et plantée partagent leurs idées ; la mer et le récif restent séparés (coraux ou non). */
const compatibleWater = (idea: WaterType, tank: WaterType) => (isSalt(tank) ? idea === tank : !isSalt(idea));

/** Idées qui conviennent à un volume et à un type d'eau, les mieux adaptées d'abord. */
export function ideasFor<T extends Idea>(ideas: T[], volumeL: number | null, water?: WaterType | null): T[] {
	const pool = water ? ideas.filter((i) => compatibleWater(i.water, water)) : ideas;
	if (volumeL == null) return [...pool].sort((a, b) => a.volume[0] - b.volume[0]);
	return pool
		.filter((i) => fitOf(i, volumeL) !== null)
		.sort((a, b) => {
			const fa = fitOf(a, volumeL) === 'ideal' ? 0 : 1;
			const fb = fitOf(b, volumeL) === 'ideal' ? 0 : 1;
			return fa - fb || centerDistance(a, volumeL) - centerDistance(b, volumeL) || a.level - b.level;
		});
}

// --- Quantités et charge biologique ----------------------------------------------------------

/** Les bancs suivent le volume ; les poissons vedettes beaucoup moins (on n'ajoute pas un scalaire par 50 L). */
const EXPONENT: Record<StockRole, number> = {
	banc: 1,
	invertebre: 1,
	fond: 0.85,
	surface: 0.85,
	nettoyeur: 0.7,
	corail: 0.7,
	vedette: 0.55
};

/** Part de la capacité biologique visée : on propose un bac confortable, pas rempli à ras bord. */
export const TARGET_RATIO = 0.7;

export interface PlannedLine {
	latin: string;
	role: StockRole;
	quantity: number;
	/** Plancher en dessous duquel la ligne n'a plus de sens (groupe, couple). */
	floor: number;
	species: Species | null;
}

export interface IdeaPlan {
	volumeL: number;
	fit: Fit | null;
	lines: PlannedLine[];
	/** Faux tant que les fiches ne sont pas chargées : pas de charge, pas de contrôle. */
	analysed: boolean;
	bioload: Bioload | null;
	issues: Issue[];
	/** Des quantités ont été réduites pour tenir dans la capacité du bac. */
	reduced: boolean;
	/** Le bac est plus petit que la fourchette : lignes au plancher, la charge peut rester élevée. */
	tooSmall: boolean;
}

export function planIdea(idea: Idea, volumeL: number, speciesOf?: (latin: string) => Species | null | undefined): IdeaPlan {
	const lines: PlannedLine[] = idea.stock.map(([latin, n, role, min, max]) => {
		const species = speciesOf?.(latin) ?? null;
		// Un groupe garde au moins l'effectif conseillé par la fiche (coraux exclus).
		const group = role === 'corail' ? 1 : (species?.groupMin ?? 1);
		const floor = Math.max(min ?? 1, group, 1);
		const scaled = Math.round(n * (volumeL / idea.ref) ** EXPONENT[role]);
		return { latin, role, quantity: Math.max(floor, Math.min(max ?? Infinity, scaled)), floor, species };
	});

	const known = lines.every((l) => l.species);
	if (!known) {
		return { volumeL, fit: fitOf(idea, volumeL), lines, analysed: false, bioload: null, issues: [], reduced: false, tooSmall: volumeL < idea.volume[0] * TOLERANCE_BELOW };
	}

	const stockOf = (): StockItem[] => lines.map((l) => ({ species: l.species as Species, quantity: l.quantity }));
	const tank = { waterType: idea.water, volumeL: volumeL * (idea.dense ?? 1) };
	let load = bioload(tank, stockOf());
	let reduced = false;
	// On retire un individu à la ligne la plus lourde tant que la charge dépasse la cible.
	for (let guard = 0; guard < 200 && load.ratio != null && load.ratio > TARGET_RATIO; guard++) {
		const candidate = lines
			.filter((l) => l.quantity > l.floor)
			.sort((a, b) => speciesBioloadG(b.species as Species) * b.quantity - speciesBioloadG(a.species as Species) * a.quantity)[0];
		if (!candidate) break;
		candidate.quantity -= 1;
		reduced = true;
		load = bioload(tank, stockOf());
	}

	const issues = checkCompatibility(
		{
			waterType: idea.water,
			volumeL,
			tempMin: idea.conditions.temp[0],
			tempMax: idea.conditions.temp[1],
			phMin: idea.conditions.ph[0],
			phMax: idea.conditions.ph[1]
		},
		stockOf()
	).filter((i) => i.severity !== 'info' && !i.message.includes('brouter les plantes'));

	return {
		volumeL,
		fit: fitOf(idea, volumeL),
		lines,
		analysed: true,
		bioload: load,
		issues,
		reduced,
		tooSmall: volumeL < idea.volume[0] * TOLERANCE_BELOW
	};
}

/** Nombre total d'animaux d'un plan (coraux et plantes exclus). */
export function animalCount(plan: IdeaPlan): number {
	return plan.lines.filter((l) => l.role !== 'corail').reduce((n, l) => n + l.quantity, 0);
}

/** Idées qui mentionnent une espèce : pour la fiche d'espèce (« Où la trouver »). */
export function ideasWithSpecies<T extends Idea>(ideas: T[], latin: string): T[] {
	const wanted = latin.toLowerCase();
	return ideas.filter(
		(i) => i.stock.some(([s]) => s.toLowerCase() === wanted) || (i.plants ?? []).some((p) => p.toLowerCase() === wanted)
	);
}

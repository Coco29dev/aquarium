import type { Species, WaterType } from '../types';

export const speciesName = (s: Pick<Species, 'nameFr' | 'nameEn' | 'scientificName'>) =>
	s.nameFr ?? s.nameEn ?? s.scientificName;

export interface StockItem {
	species: Species;
	quantity: number;
}

export interface TankContext {
	waterType: WaterType;
	volumeL: number | null;
	tempMin?: number | null;
	tempMax?: number | null;
	phMin?: number | null;
	phMax?: number | null;
}

export type Severity = 'bloquant' | 'attention' | 'info';

export interface Issue {
	severity: Severity;
	message: string;
	speciesIds: number[];
}

const isSaltTank = (w: WaterType) => w === 'mer' || w === 'recif';

/**
 * Volume minimal indicatif quand la fiche n'en donne pas : 0,8 × longueur adulte² (cm → L), plancher 20 L.
 * Ordres de grandeur : 11 cm ≈ 100 L, 20 cm ≈ 320 L, 30 cm ≈ 720 L.
 */
export function estimateMinTankL(maxLengthCm: number | null): number | null {
	if (!maxLengthCm || maxLengthCm <= 0) return null;
	return Math.max(20, Math.round((0.8 * maxLengthCm ** 2) / 10) * 10);
}

const overlap = (aMin: number, aMax: number, bMin: number, bMax: number) => Math.min(aMax, bMax) - Math.max(aMin, bMin);

function range(min: number | null | undefined, max: number | null | undefined): [number, number] | null {
	return min != null && max != null ? [min, max] : null;
}

const SEVERITY_ORDER: Record<Severity, number> = { bloquant: 0, attention: 1, info: 2 };

/** Règles de compatibilité par attributs. Chaque avertissement explique pourquoi. */
export function checkCompatibility(tank: TankContext, stock: StockItem[]): Issue[] {
	const issues: Issue[] = [];
	const add = (severity: Severity, message: string, ...ids: number[]) => issues.push({ severity, message, speciesIds: ids });
	const salt = isSaltTank(tank.waterType);
	const tankTemp = range(tank.tempMin, tank.tempMax);
	const tankPh = range(tank.phMin, tank.phMax);

	for (const { species: s, quantity } of stock) {
		const name = speciesName(s);

		// Eau
		const known = s.fresh || s.brackish || s.salt;
		if (known) {
			const fits = salt ? s.salt : s.fresh;
			if (!fits && s.brackish) {
				add('attention', `${name} vit en eau saumâtre : ni eau douce ni eau de mer ne lui convient vraiment.`, s.id);
			} else if (!fits) {
				add('bloquant', `${name} vit en ${s.salt ? 'eau de mer' : 'eau douce'}, pas en ${salt ? 'eau de mer' : 'eau douce'}.`, s.id);
			}
		}

		// Volume
		const explicit = s.minTankL;
		const minTank = explicit ?? estimateMinTankL(s.maxLengthCm);
		if (tank.volumeL != null && minTank != null && tank.volumeL < minTank) {
			add(
				explicit != null ? 'bloquant' : 'attention',
				`${name} demande au moins ${minTank} L${explicit == null ? ' (estimation d’après sa taille adulte)' : ''} ; le bac fait ${tank.volumeL} L.`,
				s.id
			);
		}

		// Température et pH du bac
		const t = range(s.tempMin, s.tempMax);
		if (t && tankTemp && overlap(...t, ...tankTemp) < 0) {
			add('bloquant', `${name} se plaît à ${t[0]}–${t[1]} °C, le bac vise ${tankTemp[0]}–${tankTemp[1]} °C.`, s.id);
		}
		const p = range(s.phMin, s.phMax);
		if (p && tankPh && overlap(...p, ...tankPh) < 0) {
			add('attention', `${name} préfère un pH de ${p[0]}–${p[1]}, le bac vise ${tankPh[0]}–${tankPh[1]}.`, s.id);
		}

		// Groupe
		if (s.groupMin != null && s.groupMin > 1 && quantity < s.groupMin) {
			add('attention', `${name} vit en groupe d’au moins ${s.groupMin} individus (tu en as ${quantity}).`, s.id);
		}

		// Territorialité entre individus de la même espèce
		if (s.temperament === 'agressif' && quantity > 1) {
			add('attention', `${name} est agressif : plusieurs individus risquent de se battre, surtout dans un petit bac.`, s.id);
		}

		// Plantes et récif
		if (tank.waterType === 'plantee' && s.kind === 'poisson' && s.diet === 'herbivore') {
			add('attention', `${name} est herbivore${s.estimated.includes('diet') ? ' (estimé)' : ''} : il peut brouter les plantes.`, s.id);
		}
		if (tank.waterType === 'recif' && s.kind !== 'corail' && s.reefSafe === false) {
			add('bloquant', `${name} n’est pas « reef safe » : il peut s’attaquer aux coraux ou aux invertébrés.`, s.id);
		}
	}

	// Paires
	for (let i = 0; i < stock.length; i++) {
		for (let j = i + 1; j < stock.length; j++) {
			const a = stock[i].species;
			const b = stock[j].species;
			const an = speciesName(a);
			const bn = speciesName(b);

			const ta = range(a.tempMin, a.tempMax);
			const tb = range(b.tempMin, b.tempMax);
			if (ta && tb && overlap(...ta, ...tb) < 0) {
				add('bloquant', `${an} (${ta[0]}–${ta[1]} °C) et ${bn} (${tb[0]}–${tb[1]} °C) n’ont aucune température en commun.`, a.id, b.id);
			}
			const pa = range(a.phMin, a.phMax);
			const pb = range(b.phMin, b.phMax);
			if (pa && pb && overlap(...pa, ...pb) < 0) {
				add('attention', `${an} et ${bn} n’ont aucun pH en commun (${pa[0]}–${pa[1]} contre ${pb[0]}–${pb[1]}).`, a.id, b.id);
			}

			// Prédation : le plus grand carnivore peut avaler le plus petit.
			for (const [pred, prey] of [[a, b], [b, a]] as const) {
				if (pred.kind !== 'poisson' || pred.diet !== 'carnivore') continue;
				if (!pred.maxLengthCm || !prey.maxLengthCm || pred.maxLengthCm < 8) continue;
				if (prey.kind === 'corail') continue;
				if (prey.maxLengthCm <= pred.maxLengthCm * 0.35) {
					const severity: Severity = pred.temperament === 'agressif' ? 'bloquant' : 'attention';
					add(
						severity,
						`${speciesName(pred)} (${pred.maxLengthCm} cm, carnivore${pred.estimated.includes('diet') ? ' estimé' : ''}) peut manger ${speciesName(prey)} (${prey.maxLengthCm} cm).`,
						pred.id,
						prey.id
					);
				}
			}

			// Tempéraments
			const aggressive = [a, b].filter((x) => x.temperament === 'agressif');
			const peaceful = [a, b].filter((x) => x.temperament === 'paisible');
			if (aggressive.length === 1 && peaceful.length === 1) {
				add('attention', `${speciesName(aggressive[0])} (agressif) peut harceler ${speciesName(peaceful[0])} (paisible).`, a.id, b.id);
			}
		}
	}

	// Fiches incomplètes : l'analyse est moins fiable
	for (const { species: s } of stock) {
		const missing: string[] = [];
		if (s.temperament == null) missing.push('tempérament');
		if (s.tempMin == null || s.tempMax == null) missing.push('température');
		if (s.maxLengthCm == null) missing.push('taille adulte');
		if (tank.waterType === 'recif' && s.kind !== 'corail' && s.reefSafe == null) missing.push('compatibilité récif');
		if (missing.length) add('info', `Fiche de ${speciesName(s)} incomplète (${missing.join(', ')}) : certaines règles ne peuvent pas s’appliquer.`, s.id);
	}

	return issues.sort((x, y) => SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity]);
}

// --- Charge biologique -----------------------------------------------------

/** Masse adulte estimée en grammes : forme × longueur³ (poisson 0,012 ; autres mobiles 0,02). */
export function speciesBioloadG(s: Species): number {
	if (s.bioloadG != null) return s.bioloadG;
	if (s.kind === 'corail' || s.kind === 'plante') return 0;
	if (!s.maxLengthCm) return 0;
	return (s.kind === 'poisson' ? 0.012 : 0.02) * s.maxLengthCm ** 3;
}

/** Capacité indicative en grammes de biomasse adulte par litre d'eau. */
const CAPACITY_G_PER_L: Record<WaterType, number> = { douce: 0.8, plantee: 1.0, mer: 0.45, recif: 0.35 };

export type BioloadLevel = 'ok' | 'elevee' | 'limite' | 'surcharge';

export interface Bioload {
	loadG: number;
	capacityG: number | null;
	ratio: number | null;
	level: BioloadLevel | null;
	/** Espèces dont la taille est inconnue : leur charge n'est pas comptée. */
	unknown: string[];
}

export function bioload(tank: Pick<TankContext, 'waterType' | 'volumeL'>, stock: StockItem[]): Bioload {
	let loadG = 0;
	const unknown: string[] = [];
	for (const { species, quantity } of stock) {
		const one = speciesBioloadG(species);
		if (one === 0 && species.bioloadG == null && species.kind !== 'corail' && species.kind !== 'plante') {
			unknown.push(speciesName(species));
		}
		loadG += one * quantity;
	}
	const capacityG = tank.volumeL ? tank.volumeL * CAPACITY_G_PER_L[tank.waterType] : null;
	const ratio = capacityG ? loadG / capacityG : null;
	const level: BioloadLevel | null =
		ratio == null ? null : ratio < 0.6 ? 'ok' : ratio < 0.9 ? 'elevee' : ratio < 1 ? 'limite' : 'surcharge';
	return { loadG: Math.round(loadG), capacityG: capacityG ? Math.round(capacityG) : null, ratio, level, unknown };
}

export const BIOLOAD_LABELS: Record<BioloadLevel, string> = {
	ok: 'Confortable',
	elevee: 'Élevée',
	limite: 'À la limite',
	surcharge: 'Surcharge'
};

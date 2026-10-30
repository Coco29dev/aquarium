// Plages conseillées par le peuplement : ce que supportent tous les habitants à la fois.
// Réutilise les fiches d'espèces (température et pH tolérés) et les types de species.ts.

import { speciesName, type StockItem } from './species';
import type { Parameter, Species } from '../types';

export interface Interval {
	min: number;
	max: number;
}

export interface StockRanges {
	/** Intersection des températures tolérées, ou null (aucune donnée ou conflit : voir `conflicts`). */
	temp: Interval | null;
	/** Intersection des pH tolérés, ou null. */
	ph: Interval | null;
	/** Messages de conflit : quand deux espèces n'ont aucune valeur en commun. */
	conflicts: string[];
	contributors: { speciesId: number; name: string; temp?: [number, number]; ph?: [number, number] }[];
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const fmt = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

interface Entry {
	id: number;
	name: string;
	min: number;
	max: number;
}

/** Intersection d'intervalles ; en cas d'intersection vide, nomme l'espèce la plus exigeante de chaque côté. */
function intersect(entries: Entry[], what: string, unit: string): { interval: Interval | null; conflict: string | null } {
	if (!entries.length) return { interval: null, conflict: null };
	const lowest = entries.reduce((best, e) => (e.min > best.min ? e : best));
	const highest = entries.reduce((best, e) => (e.max < best.max ? e : best));
	if (lowest.min <= highest.max) return { interval: { min: round1(lowest.min), max: round1(highest.max) }, conflict: null };
	const suffix = unit ? ` ${unit}` : '';
	return {
		interval: null,
		conflict: `${lowest.name} (${fmt(lowest.min)}–${fmt(lowest.max)}${suffix}) et ${highest.name} (${fmt(highest.min)}–${fmt(highest.max)}${suffix}) n’ont ${what} en commun.`
	};
}

const rangeOf = (min: number | null, max: number | null): [number, number] | null =>
	min != null && max != null && max >= min ? [min, max] : null;

/** Plages de température et de pH acceptables pour tous les habitants du bac (espèces renseignées seulement). */
export function stockRanges(stock: StockItem[]): StockRanges {
	const temps: Entry[] = [];
	const phs: Entry[] = [];
	const contributors: StockRanges['contributors'] = [];
	const seen = new Set<number>();

	for (const { species: s, quantity } of stock) {
		if (quantity <= 0 || seen.has(s.id)) continue;
		seen.add(s.id);
		const name = speciesName(s as Pick<Species, 'nameFr' | 'nameEn' | 'scientificName'>);
		const t = rangeOf(s.tempMin, s.tempMax);
		const p = rangeOf(s.phMin, s.phMax);
		if (t) temps.push({ id: s.id, name, min: t[0], max: t[1] });
		if (p) phs.push({ id: s.id, name, min: p[0], max: p[1] });
		if (t || p) contributors.push({ speciesId: s.id, name, ...(t ? { temp: t } : {}), ...(p ? { ph: p } : {}) });
	}

	const temp = intersect(temps, 'aucune température', '°C');
	const ph = intersect(phs, 'aucun pH', '');
	return {
		temp: temp.interval,
		ph: ph.interval,
		conflicts: [temp.conflict, ph.conflict].filter((c): c is string => Boolean(c)),
		contributors
	};
}

export interface RangeComparison {
	parameterId: number;
	key: 'temp' | 'ph';
	current: { min: number | null; max: number | null };
	suggested: Interval | null;
	level: 'ok' | 'ajustable' | 'conflit';
	message: string;
}

const LABEL = { temp: 'température', ph: 'pH' } as const;
const UNIT = { temp: ' °C', ph: '' } as const;

/**
 * Compare les plages du bac avec celles du peuplement, pour la température et le pH.
 * - ok        : tout ce que le bac accepte convient aux habitants ;
 * - ajustable : la plage du bac déborde de ce que les habitants supportent (ou n'est pas définie) : on propose la plage commune ;
 * - conflit   : les habitants n'ont aucune valeur en commun, ou la plage du bac ne recoupe pas la leur.
 * Seuls les paramètres existants du bac sont comparés.
 */
export function compareWithTank(ranges: StockRanges, parameters: Parameter[]): RangeComparison[] {
	const out: RangeComparison[] = [];
	for (const key of ['temp', 'ph'] as const) {
		const parameter = parameters.find((p) => p.key === key);
		if (!parameter) continue;
		const suggested = ranges[key];
		const current = { min: parameter.min, max: parameter.max };
		const label = LABEL[key];
		const unit = UNIT[key];

		if (!suggested) {
			const conflict = ranges.conflicts.find((c) => (key === 'temp' ? c.includes('température') : c.includes('pH')));
			if (conflict) out.push({ parameterId: parameter.id, key, current, suggested: null, level: 'conflit', message: conflict });
			continue;
		}

		const shown = `${fmt(suggested.min)}–${fmt(suggested.max)}${unit}`;
		const hasCurrent = current.min != null && current.max != null;
		if (!hasCurrent) {
			out.push({
				parameterId: parameter.id,
				key,
				current,
				suggested,
				level: 'ajustable',
				message: `Aucune plage de ${label} définie : tes habitants s’accordent sur ${shown}.`
			});
			continue;
		}
		const cMin = current.min as number;
		const cMax = current.max as number;
		const tank = `${fmt(cMin)}–${fmt(cMax)}${unit}`;
		if (cMax < suggested.min || cMin > suggested.max) {
			out.push({
				parameterId: parameter.id,
				key,
				current,
				suggested,
				level: 'conflit',
				message: `La plage de ${label} du bac (${tank}) n’a rien en commun avec celle de tes habitants (${shown}).`
			});
		} else if (cMin >= suggested.min && cMax <= suggested.max) {
			out.push({
				parameterId: parameter.id,
				key,
				current,
				suggested,
				level: 'ok',
				message: `La plage de ${label} du bac (${tank}) convient à tous tes habitants (${shown}).`
			});
		} else {
			out.push({
				parameterId: parameter.id,
				key,
				current,
				suggested,
				level: 'ajustable',
				message: `La plage de ${label} du bac (${tank}) dépasse ce que tes habitants supportent (${shown}).`
			});
		}
	}
	return out;
}

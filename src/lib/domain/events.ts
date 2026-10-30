// Journal d'événements d'un bac : métadonnées d'affichage, validation, résumés et requêtes.
// Fonctions pures (aucun accès réseau ni base), partagées par le serveur et les écrans.
//
// Schéma de `payload` par type d'événement (tous les champs sont validés par validateEventPayload) :
//   changement_eau   { percent?: number /* 0–100 */; litres?: number; source?: 'robinet' | 'osmose' | 'melange' | 'mer';
//                      tempDiffC?: number /* écart avec l'eau du bac, °C */; conditioner?: boolean }
//   appoint          { litres?: number }
//   dosage           { product: string; amount: number; unit: 'mL' | 'g' | 'gouttes' | 'pastilles' }
//   eclairage        { photoperiodH?: number; startTime?: 'HH:MM'; endTime?: 'HH:MM'; intensityPct?: number }  (≥ 1 champ)
//   co2              { bubblesPerSecond?: number; onTime?: 'HH:MM'; offTime?: 'HH:MM' }                         (≥ 1 champ)
//   maintenance      { what: string }
//   habitant_ajout   { species: string; quantity: number }
//   habitant_depart  { species: string; quantity: number; cause?: 'mort' | 'don' | 'vente' | 'deplacement' | 'autre' }
//   etape            { label: string }
//   note             { }   (le texte est dans `note`)
// Un champ inconnu est refusé : le schéma reste fermé, pour qu'on puisse s'y fier.

import { dayInParis, daysBetween } from './dates';
import type { IconName } from '../components/Icon.svelte';
import type { AquariumEvent, EventKind } from '../types';

export const EVENT_KINDS: EventKind[] = [
	'changement_eau',
	'appoint',
	'dosage',
	'eclairage',
	'co2',
	'maintenance',
	'habitant_ajout',
	'habitant_depart',
	'etape',
	'note'
];

export const EVENT_META: Record<EventKind, { label: string; icon: IconName; color: string }> = {
	changement_eau: { label: "Changement d'eau", icon: 'drop', color: 'var(--cyan)' },
	appoint: { label: 'Appoint', icon: 'drop', color: 'var(--teal)' },
	dosage: { label: 'Dosage', icon: 'flask', color: 'var(--purple)' },
	eclairage: { label: 'Éclairage', icon: 'sun', color: 'var(--yellow)' },
	co2: { label: 'CO₂', icon: 'bubbles', color: 'var(--mint)' },
	maintenance: { label: 'Entretien', icon: 'outils', color: 'var(--gray)' },
	habitant_ajout: { label: 'Arrivée', icon: 'fish', color: 'var(--green)' },
	habitant_depart: { label: 'Départ', icon: 'fish', color: 'var(--orange)' },
	etape: { label: 'Étape', icon: 'cycle', color: 'var(--indigo)' },
	note: { label: 'Note', icon: 'note', color: 'var(--brown)' }
};

export const WATER_SOURCES = ['robinet', 'osmose', 'melange', 'mer'] as const;
export const DOSE_UNITS = ['mL', 'g', 'gouttes', 'pastilles'] as const;
export const DEPARTURE_CAUSES = ['mort', 'don', 'vente', 'deplacement', 'autre'] as const;

const SOURCE_LABELS: Record<(typeof WATER_SOURCES)[number], string> = {
	robinet: 'eau du robinet',
	osmose: "eau d'osmose",
	melange: 'mélange robinet et osmose',
	mer: 'eau de mer reconstituée'
};
const CAUSE_LABELS: Record<(typeof DEPARTURE_CAUSES)[number], string> = {
	mort: 'mort',
	don: 'don',
	vente: 'vente',
	deplacement: 'déplacé',
	autre: 'autre cause'
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

type Payload = Record<string, unknown>;
interface FieldRule {
	/** Renvoie un message d'erreur, ou null si la valeur est valable. */
	check: (value: unknown) => string | null;
	required?: boolean;
}

const num = (label: string, min: number, max: number, minExclusive = false): FieldRule['check'] => (v) => {
	if (v === undefined) return `${label} est obligatoire.`;
	if (typeof v !== 'number' || !Number.isFinite(v)) return `${label} doit être un nombre.`;
	if (minExclusive ? v <= min : v < min) return `${label} : saisis une valeur ${minExclusive ? 'supérieure à' : "d'au moins"} ${min}.`;
	if (v > max) return `${label} ne peut pas dépasser ${max}.`;
	return null;
};
const str = (label: string, max: number): FieldRule['check'] => (v) => {
	if (typeof v !== 'string' || v.trim() === '') return `${label} est obligatoire.`;
	if (v.length > max) return `${label} est trop long (${max} caractères au plus).`;
	return null;
};
const oneOf = (label: string, values: readonly string[]): FieldRule['check'] => (v) =>
	v === undefined
		? `${label} est obligatoire.`
		: typeof v === 'string' && values.includes(v)
			? null
			: `${label} : valeur inconnue.`;
const time = (label: string): FieldRule['check'] => (v) =>
	typeof v === 'string' && TIME.test(v) ? null : `${label} doit être une heure au format HH:MM.`;
const bool = (label: string): FieldRule['check'] => (v) => (typeof v === 'boolean' ? null : `${label} doit être vrai ou faux.`);
const integer = (label: string, min: number, max: number): FieldRule['check'] => (v) =>
	v === undefined
		? `${label} est obligatoire.`
		: typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? null : `${label} doit être un entier entre ${min} et ${max}.`;

const SCHEMAS: Record<EventKind, { fields: Record<string, FieldRule>; atLeastOne?: string }> = {
	changement_eau: {
		fields: {
			percent: { check: num('Le pourcentage', 0, 100, true) },
			litres: { check: num('Le volume', 0, 100_000, true) },
			source: { check: oneOf("L'origine de l'eau", WATER_SOURCES) },
			tempDiffC: { check: num("L'écart de température", -30, 30) },
			conditioner: { check: bool('Le conditionneur') }
		}
	},
	appoint: { fields: { litres: { check: num('Le volume', 0, 100_000, true) } } },
	dosage: {
		fields: {
			product: { check: str('Le produit', 80), required: true },
			amount: { check: num('La dose', 0, 100_000, true), required: true },
			unit: { check: oneOf("L'unité", DOSE_UNITS), required: true }
		}
	},
	eclairage: {
		fields: {
			photoperiodH: { check: num('La photopériode', 0, 24) },
			startTime: { check: time("L'heure d'allumage") },
			endTime: { check: time("L'heure d'extinction") },
			intensityPct: { check: num("L'intensité", 0, 100) }
		},
		atLeastOne: 'Renseigne au moins un réglage d’éclairage.'
	},
	co2: {
		fields: {
			bubblesPerSecond: { check: num('Le débit de bulles', 0, 20) },
			onTime: { check: time("L'heure de mise en route") },
			offTime: { check: time("L'heure d'arrêt") }
		},
		atLeastOne: 'Renseigne au moins un réglage de CO₂.'
	},
	maintenance: { fields: { what: { check: str("L'intervention", 200), required: true } } },
	habitant_ajout: {
		fields: {
			species: { check: str("L'espèce", 120), required: true },
			quantity: { check: integer('La quantité', 1, 10_000), required: true }
		}
	},
	habitant_depart: {
		fields: {
			species: { check: str("L'espèce", 120), required: true },
			quantity: { check: integer('La quantité', 1, 10_000), required: true },
			cause: { check: oneOf('La cause', DEPARTURE_CAUSES) }
		}
	},
	etape: { fields: { label: { check: str("L'étape", 200), required: true } } },
	note: { fields: {} }
};

/** Message d'erreur en français si le payload ne respecte pas le schéma du type, sinon null. */
export function validateEventPayload(kind: EventKind, payload: unknown): string | null {
	const schema = SCHEMAS[kind];
	if (!schema) return "Type d'événement inconnu.";
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'Les détails de l’événement sont invalides.';
	if (JSON.stringify(payload).length > 2000) return 'Les détails de l’événement sont trop volumineux.';
	const data = payload as Payload;
	for (const key of Object.keys(data)) {
		if (!(key in schema.fields)) return `Champ inconnu : ${key}.`;
	}
	let present = 0;
	for (const [key, rule] of Object.entries(schema.fields)) {
		const value = data[key];
		if (value === undefined || value === null) {
			if (rule.required) return rule.check(undefined);
			continue;
		}
		present += 1;
		const problem = rule.check(value);
		if (problem) return problem;
	}
	if (schema.atLeastOne && present === 0) return schema.atLeastOne;
	return null;
}

const nf = (value: number, max = 1) => value.toLocaleString('fr-FR', { maximumFractionDigits: max });
const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

/** Résumé d'une ligne, ex. « Changement d'eau · 30 % (72 L) · eau d'osmose ». La note n'y figure pas. */
export function eventSummary(e: Pick<AquariumEvent, 'kind' | 'payload' | 'note'>): string {
	const p = (e.payload ?? {}) as Payload;
	const label = EVENT_META[e.kind]?.label ?? 'Événement';
	const parts: string[] = [];
	const n = (k: string) => (typeof p[k] === 'number' ? (p[k] as number) : null);
	const s = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : null);

	switch (e.kind) {
		case 'changement_eau': {
			const percent = n('percent');
			const litres = n('litres');
			if (percent != null && litres != null) parts.push(`${nf(percent)} % (${nf(litres)} L)`);
			else if (percent != null) parts.push(`${nf(percent)} %`);
			else if (litres != null) parts.push(`${nf(litres)} L`);
			const source = s('source') as keyof typeof SOURCE_LABELS | null;
			if (source && SOURCE_LABELS[source]) parts.push(SOURCE_LABELS[source]);
			const diff = n('tempDiffC');
			if (diff != null && diff !== 0) parts.push(`écart de ${nf(Math.abs(diff))} °C${diff > 0 ? ' en plus' : ' en moins'}`);
			if (p.conditioner === true) parts.push('conditionneur ajouté');
			break;
		}
		case 'appoint': {
			const litres = n('litres');
			if (litres != null) parts.push(`${nf(litres)} L`);
			break;
		}
		case 'dosage': {
			const product = s('product');
			const amount = n('amount');
			if (product) parts.push(product);
			if (amount != null) parts.push(`${nf(amount, 2)} ${s('unit') ?? ''}`.trim());
			break;
		}
		case 'eclairage': {
			const h = n('photoperiodH');
			if (h != null) parts.push(`${nf(h)} h`);
			if (s('startTime') && s('endTime')) parts.push(`${s('startTime')}–${s('endTime')}`);
			else if (s('startTime')) parts.push(`allumage ${s('startTime')}`);
			else if (s('endTime')) parts.push(`extinction ${s('endTime')}`);
			const pct = n('intensityPct');
			if (pct != null) parts.push(`${nf(pct)} %`);
			break;
		}
		case 'co2': {
			const bps = n('bubblesPerSecond');
			if (bps != null) parts.push(`${nf(bps)} ${plural(bps, 'bulle', 'bulles')} par s`);
			if (s('onTime') && s('offTime')) parts.push(`${s('onTime')}–${s('offTime')}`);
			else if (s('onTime')) parts.push(`marche ${s('onTime')}`);
			else if (s('offTime')) parts.push(`arrêt ${s('offTime')}`);
			break;
		}
		case 'maintenance':
			if (s('what')) parts.push(s('what')!);
			break;
		case 'habitant_ajout':
		case 'habitant_depart': {
			const qty = n('quantity');
			const species = s('species');
			if (species) parts.push(qty != null ? `${nf(qty, 0)} × ${species}` : species);
			const cause = s('cause') as keyof typeof CAUSE_LABELS | null;
			if (e.kind === 'habitant_depart' && cause && CAUSE_LABELS[cause]) parts.push(CAUSE_LABELS[cause]);
			break;
		}
		case 'etape':
			if (s('label')) parts.push(s('label')!);
			break;
		case 'note': {
			const text = (e.note ?? '').trim();
			if (text) parts.push(text.length > 60 ? `${text.slice(0, 59)}…` : text);
			break;
		}
	}
	return [label, ...parts].join(' · ');
}

/**
 * Midi, heure de Paris, d'un jour calendaire (YYYY-MM-DD), en ISO avec son décalage. Sert aux événements
 * dont on ne connaît que le jour (arrivée ou départ d'un habitant).
 */
export function noonParisIso(day: string): string {
	const probe = new Date(`${day}T12:00:00Z`); // les changements d'heure ont lieu à 01:00 UTC : midi est sans ambiguïté
	const part = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', timeZoneName: 'shortOffset' })
		.formatToParts(probe)
		.find((p) => p.type === 'timeZoneName')?.value; // « GMT+1 » ou « GMT+2 »
	const hours = Number(/GMT([+-]\d+)/.exec(part ?? '')?.[1] ?? 1);
	const sign = hours < 0 ? '-' : '+';
	return `${day}T12:00:00${sign}${String(Math.abs(hours)).padStart(2, '0')}:00`;
}

const ts = (iso: string) => new Date(iso).getTime();

interface Filter {
	aquariumId?: number;
	kinds?: EventKind[];
}
const matches = (e: AquariumEvent, f: Filter) =>
	(f.aquariumId === undefined || e.aquariumId === f.aquariumId) && (!f.kinds || f.kinds.includes(e.kind));

/** Événements dont la date est dans [from, to] (millisecondes, bornes incluses), du plus ancien au plus récent. */
export function eventsBetween(
	events: AquariumEvent[],
	from: number,
	to: number,
	filter: Filter = {}
): AquariumEvent[] {
	return events
		.filter((e) => matches(e, filter) && ts(e.at) >= from && ts(e.at) <= to)
		.sort((a, b) => ts(a.at) - ts(b.at));
}

/** Dernier événement d'un type pour un bac, ou null. */
export function lastEvent(events: AquariumEvent[], aquariumId: number, kind: EventKind): AquariumEvent | null {
	let best: AquariumEvent | null = null;
	for (const e of events) {
		if (e.aquariumId === aquariumId && e.kind === kind && (!best || ts(e.at) > ts(best.at))) best = e;
	}
	return best;
}

/** Jours calendaires (Europe/Paris) depuis le dernier événement de ce type, ou null s'il n'y en a pas. */
export function daysSinceEvent(
	events: AquariumEvent[],
	aquariumId: number,
	kind: EventKind,
	now: Date | number = Date.now()
): number | null {
	const last = lastEvent(events, aquariumId, kind);
	if (!last) return null;
	return Math.max(0, daysBetween(dayInParis(last.at), dayInParis(now)));
}

export interface ChartMarker {
	t: number;
	label: string;
	kind: EventKind;
}

/**
 * Repères verticaux pour un graphe : un par événement, avec son résumé comme libellé.
 * `kinds` filtre les types, `from`/`to` bornent la période (ms), `aquariumId` limite à un bac.
 */
export function chartMarkers(
	events: AquariumEvent[],
	opts: { kinds?: EventKind[]; from?: number; to?: number; aquariumId?: number } = {}
): ChartMarker[] {
	const from = opts.from ?? -Infinity;
	const to = opts.to ?? Infinity;
	return eventsBetween(events, from, to, { kinds: opts.kinds, aquariumId: opts.aquariumId }).map((e) => ({
		t: ts(e.at),
		label: eventSummary(e),
		kind: e.kind
	}));
}

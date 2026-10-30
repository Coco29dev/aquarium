// Bilan de la semaine : ce qui s'est passé sur les 7 derniers jours dans les bacs en eau.
// Fonction pure, utilisée par l'écran « Bilan » et par la notification du dimanche.
//
// - Période : 7 jours calendaires (Europe/Paris) se terminant à `now` (jour de `now` inclus).
// - Tâches : faites = réalisations de la période ; attendues = faites + tâches encore dues ou en retard
//   à `now` ; ratio = faites / attendues (1 s'il n'y avait rien à faire).
// - Paramètres stables : score de stabilité ≥ 80 (voir stability.ts) et au moins une mesure dans la période.
// - Points marquants : un paramètre dont la valeur a varié, sur la période, d'au moins un quart de sa
//   plage acceptable (3 au plus, les plus marqués d'abord), puis changements d'eau, arrivées et départs.
// - Les bacs en projet sont ignorés.

import { collectAlerts } from './drift';
import { addDays, dayInParis } from './dates';
import { parameterStability } from './stability';
import { dueTasks } from './tasks';
import type { Snapshot } from '../types';

export type WeeklyView = Pick<Snapshot, 'aquariums' | 'parameters' | 'measurements' | 'tasks'> &
	Partial<Pick<Snapshot, 'completions' | 'events' | 'feedings'>>;

export interface WeeklyReport {
	period: { from: string; to: string };
	tasks: { done: number; due: number; ratio: number };
	measurements: { count: number; perTank: { aquariumId: number; name: string; count: number }[] };
	outOfRange: {
		aquariumId: number;
		aquariumName: string;
		parameterId: number;
		parameterName: string;
		value: number;
		unit: string;
		decimals: number;
		message: string;
	}[];
	stable: { aquariumId: number; aquariumName: string; parameterId: number; parameterName: string; score: number }[];
	highlights: string[];
	waterChanges: number;
	/** Nourrissages de la période ; null quand le cache local n'en contient pas. */
	feedings: { count: number; perTank: { aquariumId: number; name: string; count: number }[] } | null;
	/** Une phrase pour la notification : « 5 tâches sur 6, 1 valeur hors plage ». */
	summary: string;
}

const STABLE_SCORE = 80;
const HIGHLIGHT_SHARE_OF_RANGE = 0.25;
const MAX_HIGHLIGHTS_FROM_VALUES = 3;

const nf = (v: number, d: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

export function weeklyReport(view: WeeklyView, now: number = Date.now()): WeeklyReport {
	const to = dayInParis(now);
	const from = addDays(to, -6);
	const inPeriod = (iso: string) => {
		const d = dayInParis(iso);
		return d >= from && d <= to;
	};

	const tanks = view.aquariums.filter((a) => (a.stage ?? 'actif') !== 'projet');
	const tankIds = new Set(tanks.map((a) => a.id));
	const nameOf = new Map(tanks.map((a) => [a.id, a.name]));
	const parameters = view.parameters.filter((p) => tankIds.has(p.aquariumId));
	const measurements = view.measurements.filter((m) => tankIds.has(m.aquariumId));

	// Tâches
	const tasks = view.tasks.filter((t) => tankIds.has(t.aquariumId));
	const taskIds = new Set(tasks.map((t) => t.id));
	const done = (view.completions ?? []).filter((c) => taskIds.has(c.taskId) && inPeriod(c.doneAt)).length;
	const stillDue = dueTasks(tasks, now).length;
	const expected = done + stillDue;

	// Mesures
	const weekMeasures = measurements.filter((m) => inPeriod(m.measuredAt));
	const perTank = tanks
		.map((a) => ({ aquariumId: a.id, name: a.name, count: weekMeasures.filter((m) => m.aquariumId === a.id).length }))
		.filter((t) => t.count > 0);

	// Valeurs hors plage (état actuel)
	const outOfRange = collectAlerts(parameters, measurements, now)
		.filter((a) => a.level === 'hors_plage')
		.map((a) => {
			const p = parameters.find((x) => x.id === a.parameterId)!;
			const last = measurements.filter((m) => m.parameterId === p.id).sort((x, y) => x.measuredAt.localeCompare(y.measuredAt)).pop();
			return {
				aquariumId: a.aquariumId,
				aquariumName: nameOf.get(a.aquariumId) ?? '',
				parameterId: p.id,
				parameterName: p.name,
				value: last?.value ?? 0,
				unit: p.unit,
				decimals: p.decimals,
				message: a.message
			};
		});

	// Paramètres stables et variations marquantes
	const stable: WeeklyReport['stable'] = [];
	const moves: { text: string; weight: number }[] = [];
	for (const p of parameters) {
		const list = measurements.filter((m) => m.parameterId === p.id).sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
		const week = list.filter((m) => inPeriod(m.measuredAt));
		if (!week.length) continue;
		const s = parameterStability(p, list, now, { ignoreVariability: p.key === 'nh3' || p.key === 'no2' });
		if (s.score != null && s.score >= STABLE_SCORE) {
			stable.push({ aquariumId: p.aquariumId, aquariumName: nameOf.get(p.aquariumId) ?? '', parameterId: p.id, parameterName: p.name, score: s.score });
		}
		if (week.length >= 2 && p.min != null && p.max != null && p.max > p.min) {
			const delta = week[week.length - 1].value - week[0].value;
			const weight = Math.abs(delta) / (p.max - p.min);
			if (weight >= HIGHLIGHT_SHARE_OF_RANGE) {
				const tank = tanks.length > 1 ? ` (${nameOf.get(p.aquariumId)})` : '';
				moves.push({ text: `${p.name} ${delta > 0 ? '+' : '−'}${nf(Math.abs(delta), p.decimals)}${p.unit ? ` ${p.unit}` : ''} sur la semaine${tank}`, weight });
			}
		}
	}
	stable.sort((a, b) => b.score - a.score);

	const highlights = moves
		.sort((a, b) => b.weight - a.weight)
		.slice(0, MAX_HIGHLIGHTS_FROM_VALUES)
		.map((m) => m.text);

	// Journal : changements d'eau, arrivées, départs
	const events = (view.events ?? []).filter((e) => tankIds.has(e.aquariumId) && inPeriod(e.at));
	const waterChanges = events.filter((e) => e.kind === 'changement_eau').length;
	if (waterChanges) highlights.push(`${waterChanges} ${plural(waterChanges, 'changement', 'changements')} d’eau`);
	const people = (kind: 'habitant_ajout' | 'habitant_depart') =>
		events
			.filter((e) => e.kind === kind)
			.map((e) => {
				const p = e.payload as { species?: string; quantity?: number };
				return `${p.quantity && p.quantity > 1 ? `${p.quantity} × ` : ''}${p.species ?? 'habitant'}`;
			});
	const arrivals = people('habitant_ajout');
	const departures = people('habitant_depart');
	if (arrivals.length) highlights.push(`${plural(arrivals.length, 'Arrivée', 'Arrivées')} : ${arrivals.join(', ')}`);
	if (departures.length) highlights.push(`${plural(departures.length, 'Départ', 'Départs')} : ${departures.join(', ')}`);

	// Nourrissages
	let feedings: WeeklyReport['feedings'] = null;
	if (view.feedings) {
		const week = view.feedings.filter((f) => tankIds.has(f.aquariumId) && inPeriod(f.fedAt));
		feedings = {
			count: week.length,
			perTank: tanks.map((a) => ({ aquariumId: a.id, name: a.name, count: week.filter((f) => f.aquariumId === a.id).length })).filter((t) => t.count > 0)
		};
	}

	const parts: string[] = [];
	parts.push(expected ? `${done} ${plural(done, 'tâche', 'tâches')} sur ${expected}` : 'Aucune tâche prévue');
	parts.push(
		outOfRange.length ? `${outOfRange.length} ${plural(outOfRange.length, 'valeur', 'valeurs')} hors plage` : 'tout est dans la plage'
	);

	return {
		period: { from, to },
		tasks: { done, due: expected, ratio: expected > 0 ? Math.min(1, done / expected) : 1 },
		measurements: { count: weekMeasures.length, perTank },
		outOfRange,
		stable,
		highlights,
		waterChanges,
		feedings,
		summary: parts.join(', ')
	};
}

// Stabilité d'un bac et anneaux du jour. Fonctions pures, testées.
//
// FORMULE DE STABILITÉ D'UN PARAMÈTRE (fenêtre de 30 jours glissants, mesures de ce paramètre) :
//   n       = nombre de mesures dans la fenêtre (minimum 3, sinon pas de score)
//   largeur = max − min de la plage acceptable (obligatoire : min et max définis, max > min)
//   σ       = écart-type des valeurs (population)
//   variabilité = clamp(σ / (0,25 × largeur), 0, 1)     // un écart-type d'un quart de plage = instable
//   horsPlage   = (mesures hors de [min, max]) / n
//   score = 100 × (1 − variabilité) × (1 − horsPlage), arrondi à l'entier
// Pourquoi : en récif surtout, la stabilité compte plus que la valeur exacte. Un paramètre qui reste
// quasi constant dans sa plage vaut 100 ; un paramètre qui oscille d'un quart de plage ou qui sort
// souvent de sa plage tombe vers 0.
//
// AMMONIAC ET NITRITES : leur valeur attendue est zéro, un écart-type n'a pas de sens. On ignore la
// variabilité et on ne compte que la part de mesures hors plage : score = 100 × (1 − horsPlage).
//
// SCORE D'UN BAC : moyenne (arrondie) des scores des paramètres notés, ou null s'il n'y en a aucun.

import { dayInParis, daysBetween, DAY_MS } from './dates';
import { dueTasks } from './tasks';
import type { AquariumStage, Measurement, Parameter, Snapshot } from '../types';

const WINDOW_DAYS = 30;
const MIN_POINTS = 3;
const VARIABILITY_SHARE_OF_RANGE = 0.25;

export interface ParameterStability {
	score: number | null;
	reason: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function stdev(values: number[]): number {
	const mean = values.reduce((a, b) => a + b, 0) / values.length;
	return Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
}

function label(score: number): string {
	if (score >= 85) return 'Très stable';
	if (score >= 70) return 'Stable';
	if (score >= 50) return 'Variable';
	return 'Instable';
}

export function parameterStability(
	parameter: Pick<Parameter, 'id' | 'min' | 'max'>,
	measurements: Pick<Measurement, 'parameterId' | 'value' | 'measuredAt'>[],
	now: number = Date.now(),
	opts: { ignoreVariability?: boolean } = {}
): ParameterStability {
	const { min, max } = parameter;
	if (min == null || max == null || !(max > min)) return { score: null, reason: 'Plage acceptable non définie.' };

	const since = now - WINDOW_DAYS * DAY_MS;
	const values = measurements
		.filter((m) => m.parameterId === parameter.id)
		.map((m) => ({ t: new Date(m.measuredAt).getTime(), v: m.value }))
		.filter((p) => p.t >= since && p.t <= now && Number.isFinite(p.v))
		.map((p) => p.v);
	if (values.length < MIN_POINTS) {
		return { score: null, reason: `Pas assez de mesures (${values.length} sur ${MIN_POINTS} minimum en 30 jours).` };
	}

	const out = values.filter((v) => v < min || v > max).length;
	const outShare = out / values.length;
	const variability = opts.ignoreVariability ? 0 : clamp(stdev(values) / (VARIABILITY_SHARE_OF_RANGE * (max - min)), 0, 1);
	const score = Math.round(100 * (1 - variability) * (1 - outShare));

	const outText = out ? ` · ${out} mesure${out > 1 ? 's' : ''} sur ${values.length} hors plage` : '';
	return { score, reason: `${label(score)}${outText}` };
}

const NO_VARIABILITY = new Set(['nh3', 'no2']);

export interface TankStability {
	score: number | null;
	parameters: { parameterId: number; score: number; reason: string }[];
}

/** Stabilité d'un bac à partir de ses paramètres et de ses mesures (les autres bacs sont ignorés). */
export function tankStability(
	parameters: Parameter[],
	measurements: Measurement[],
	now: number = Date.now()
): TankStability {
	const scored: TankStability['parameters'] = [];
	for (const p of parameters) {
		const s = parameterStability(p, measurements, now, { ignoreVariability: NO_VARIABILITY.has(p.key ?? '') });
		if (s.score != null) scored.push({ parameterId: p.id, score: s.score, reason: s.reason });
	}
	if (!scored.length) return { score: null, parameters: [] };
	return { score: Math.round(scored.reduce((a, p) => a + p.score, 0) / scored.length), parameters: scored };
}

// --- Tests à jour --------------------------------------------------------------------------

const DEFAULT_CADENCE_DAYS = 7;
const CYCLING_CADENCE_DAYS = 2;

/** Cadence de test d'un paramètre : 7 jours, ou 2 jours pour l'ammoniac et les nitrites d'un bac en cyclage. */
export function testCadenceDays(parameter: Pick<Parameter, 'key'>, stage: AquariumStage): number {
	return stage === 'cyclage' && (parameter.key === 'nh3' || parameter.key === 'no2') ? CYCLING_CADENCE_DAYS : DEFAULT_CADENCE_DAYS;
}

export interface TestsDue {
	/** Paramètres jamais mesurés ou mesurés il y a plus que leur cadence. */
	due: Parameter[];
	total: number;
	upToDate: number;
}

/** Paramètres à tester d'un bac. Un bac en projet n'a rien à tester. */
export function testsDue(
	parameters: Parameter[],
	measurements: Pick<Measurement, 'parameterId' | 'measuredAt'>[],
	stage: AquariumStage,
	now: number = Date.now()
): TestsDue {
	if (stage === 'projet') return { due: [], total: 0, upToDate: 0 };
	const today = dayInParis(now);
	const last = new Map<number, string>();
	for (const m of measurements) {
		const day = dayInParis(m.measuredAt);
		const previous = last.get(m.parameterId);
		if (!previous || day > previous) last.set(m.parameterId, day);
	}
	const due = parameters.filter((p) => {
		const day = last.get(p.id);
		return !day || daysBetween(day, today) > testCadenceDays(p, stage);
	});
	return { due, total: parameters.length, upToDate: parameters.length - due.length };
}

// --- Anneaux du jour -------------------------------------------------------------------------

export interface Ring {
	done: number;
	total: number;
	/** 0 à 1 ; 1 quand il n'y a rien à faire (anneau fermé). */
	ratio: number;
}

export interface ActivityRings {
	tests: Ring;
	tasks: Ring;
	stability: { score: number | null };
}

const ring = (done: number, total: number): Ring => ({ done, total, ratio: total > 0 ? clamp(done / total, 0, 1) : 1 });

/**
 * Les trois anneaux d'Aujourd'hui, sur les bacs en eau (les bacs en projet sont ignorés) :
 * - tests : paramètres à jour / paramètres suivis (cadence : voir testCadenceDays) ;
 * - tâches : tâches faites aujourd'hui / (tâches encore dues + tâches faites aujourd'hui) ;
 * - stabilité : moyenne des scores de stabilité des bacs notés.
 */
export function activityRings(
	view: Pick<Snapshot, 'aquariums' | 'parameters' | 'measurements' | 'tasks' | 'completions'>,
	now: number = Date.now()
): ActivityRings {
	const tanks = view.aquariums.filter((a) => (a.stage ?? 'actif') !== 'projet');
	const ids = new Set(tanks.map((a) => a.id));
	const today = dayInParis(now);

	let testsDone = 0;
	let testsTotal = 0;
	const stabilities: number[] = [];
	for (const a of tanks) {
		const parameters = view.parameters.filter((p) => p.aquariumId === a.id);
		const measurements = view.measurements.filter((m) => m.aquariumId === a.id);
		const t = testsDue(parameters, measurements, a.stage ?? 'actif', now);
		testsDone += t.upToDate;
		testsTotal += t.total;
		const s = tankStability(parameters, measurements, now);
		if (s.score != null) stabilities.push(s.score);
	}

	const tasks = view.tasks.filter((t) => ids.has(t.aquariumId));
	const taskIds = new Set(tasks.map((t) => t.id));
	const stillDue = dueTasks(tasks, now).length;
	const doneToday = (view.completions ?? []).filter((c) => taskIds.has(c.taskId) && dayInParis(c.doneAt) === today).length;

	return {
		tests: ring(testsDone, testsTotal),
		tasks: ring(doneToday, stillDue + doneToday),
		stability: { score: stabilities.length ? Math.round(stabilities.reduce((a, b) => a + b, 0) / stabilities.length) : null }
	};
}

import { DAY_MS } from './dates';
import { cyclingForAquarium, hasCycled } from './cycling';
import type { Completion, Measurement, Parameter, Task } from '../types';

export type AlertLevel = 'hors_plage' | 'derive';

export interface DriftAlert {
	level: AlertLevel;
	parameterId: number;
	aquariumId: number;
	message: string;
	/** Variation estimée sur 7 jours (pour 'derive'). */
	change7d?: number;
}

const WINDOW_DAYS = 7;
const MIN_POINTS = 3;
const MIN_SPAN_DAYS = 2;

/** Pente (unité par jour) d'une régression linéaire, ou null si pas calculable. */
export function slopePerDay(points: { t: number; v: number }[]): number | null {
	if (points.length < 2) return null;
	const t0 = points[0].t;
	const xs = points.map((p) => (p.t - t0) / DAY_MS);
	const n = points.length;
	const meanX = xs.reduce((a, b) => a + b, 0) / n;
	const meanY = points.reduce((a, p) => a + p.v, 0) / n;
	let num = 0;
	let den = 0;
	for (let i = 0; i < n; i++) {
		num += (xs[i] - meanX) * (points[i].v - meanY);
		den += (xs[i] - meanX) ** 2;
	}
	return den === 0 ? null : num / den;
}

function fmt(value: number, decimals: number): string {
	return value.toLocaleString('fr-FR', {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	});
}

/** Seuil de dérive : celui du paramètre, sinon 25 % de la largeur de la plage. */
export function driftThreshold(p: Pick<Parameter, 'driftPerWeek' | 'min' | 'max'>): number | null {
	if (p.driftPerWeek != null) return p.driftPerWeek;
	if (p.min != null && p.max != null && p.max > p.min) return 0.25 * (p.max - p.min);
	return null;
}

/**
 * Une variation rapide n'inquiète pas quand elle va dans le bon sens :
 * - paramètre « le moins possible » (plancher nul ou absent, ex. ammoniac, nitrites) qui baisse ;
 * - valeur dans la plage qui revient vers le milieu de la plage.
 */
export function isReassuring(
	p: Pick<Parameter, 'min' | 'max'>,
	latest: number,
	change7d: number
): boolean {
	if (change7d < 0 && (p.min == null || p.min <= 0)) return true;
	if (p.min == null || p.max == null) return false;
	if (latest < p.min || latest > p.max) return false;
	const center = (p.min + p.max) / 2;
	return Math.sign(change7d) === Math.sign(center - latest);
}

export function analyzeParameter(
	parameter: Parameter,
	measurements: Pick<Measurement, 'value' | 'measuredAt'>[],
	now = Date.now(),
	/** Instant du dernier changement d'eau : la pente ne regarde que ce qui suit (évite la dent de scie). */
	since?: number
): DriftAlert | null {
	const points = measurements
		.map((m) => ({ t: new Date(m.measuredAt).getTime(), v: m.value }))
		.filter((p) => p.t <= now)
		.sort((a, b) => a.t - b.t);
	if (points.length === 0) return null;

	const latest = points[points.length - 1];
	const unit = parameter.unit ? ` ${parameter.unit}` : '';
	const base = { parameterId: parameter.id, aquariumId: parameter.aquariumId };

	if (parameter.max != null && latest.v > parameter.max) {
		return {
			...base,
			level: 'hors_plage',
			message: `${parameter.name} à ${fmt(latest.v, parameter.decimals)}${unit} : au-dessus de ${fmt(parameter.max, parameter.decimals)}`
		};
	}
	if (parameter.min != null && latest.v < parameter.min) {
		return {
			...base,
			level: 'hors_plage',
			message: `${parameter.name} à ${fmt(latest.v, parameter.decimals)}${unit} : en dessous de ${fmt(parameter.min, parameter.decimals)}`
		};
	}

	const recent = points.filter((p) => p.t >= Math.max(now - WINDOW_DAYS * DAY_MS, since ?? 0));
	if (recent.length < MIN_POINTS) return null;
	if (recent[recent.length - 1].t - recent[0].t < MIN_SPAN_DAYS * DAY_MS) return null;

	const slope = slopePerDay(recent);
	const threshold = driftThreshold(parameter);
	if (slope == null || threshold == null) return null;

	const change7d = slope * WINDOW_DAYS;
	if (Math.abs(change7d) < threshold) return null;
	if (isReassuring(parameter, latest.v, change7d)) return null;

	const direction = change7d > 0 ? 'monte' : 'baisse';
	return {
		...base,
		level: 'derive',
		change7d,
		message: `${parameter.name} ${direction} de ${fmt(Math.abs(change7d), parameter.decimals)}${unit} sur 7 jours`
	};
}

/** Alertes de tous les paramètres : hors plage d'abord, puis dérives. */
export function collectAlerts(
	parameters: Parameter[],
	measurements: Measurement[],
	now = Date.now(),
	sinceOf?: (aquariumId: number) => number | undefined
): DriftAlert[] {
	const byParameter = new Map<number, Measurement[]>();
	for (const m of measurements) {
		const list = byParameter.get(m.parameterId);
		if (list) list.push(m);
		else byParameter.set(m.parameterId, [m]);
	}
	const alerts: DriftAlert[] = [];
	for (const p of parameters) {
		const alert = analyzeParameter(p, byParameter.get(p.id) ?? [], now, sinceOf?.(p.aquariumId));
		if (alert) alerts.push(alert);
	}
	return alerts.sort((a, b) => (a.level === b.level ? 0 : a.level === 'hors_plage' ? -1 : 1));
}

/** Dernier changement d'eau de chaque bac (réalisations des tâches de type « eau »), en ms. */
export function lastWaterChanges(tasks: Task[], completions: Completion[]): Map<number, number> {
	const tankOf = new Map(tasks.filter((t) => t.kind === 'eau').map((t) => [t.id, t.aquariumId]));
	const last = new Map<number, number>();
	for (const c of completions) {
		const aquariumId = tankOf.get(c.taskId);
		if (aquariumId == null) continue;
		const t = new Date(c.doneAt).getTime();
		if (t > (last.get(aquariumId) ?? 0)) last.set(aquariumId, t);
	}
	return last;
}

/**
 * Alertes à montrer vraiment : la dérive repart de zéro après un changement d'eau, et pendant le
 * cyclage d'un bac, l'ammoniac et les nitrites hors plage sont attendus (le coach en parle déjà).
 */
export function collectTankAlerts(
	data: { parameters: Parameter[]; measurements: Measurement[]; tasks: Task[]; completions?: Completion[] },
	now = Date.now()
): DriftAlert[] {
	const changes = lastWaterChanges(data.tasks, data.completions ?? []);
	const alerts = collectAlerts(data.parameters, data.measurements, now, (id) => changes.get(id));

	const cycling = new Set<number>();
	for (const aquariumId of new Set(data.parameters.map((p) => p.aquariumId))) {
		const parameters = data.parameters.filter((p) => p.aquariumId === aquariumId);
		const measurements = data.measurements.filter((m) => m.aquariumId === aquariumId);
		const status = cyclingForAquarium(parameters, measurements);
		if (status && status.stage !== 'pret' && status.stage !== 'aucune_mesure' && !hasCycled(parameters, measurements)) {
			cycling.add(aquariumId);
		}
	}
	const keyOf = new Map(data.parameters.map((p) => [p.id, p.key]));
	return alerts.filter((a) => !(cycling.has(a.aquariumId) && ['nh3', 'no2'].includes(keyOf.get(a.parameterId) ?? '')));
}

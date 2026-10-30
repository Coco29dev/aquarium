import { DAY_MS } from './dates';
import type { Measurement, Parameter } from '../types';

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

export function analyzeParameter(
	parameter: Parameter,
	measurements: Pick<Measurement, 'value' | 'measuredAt'>[],
	now = Date.now()
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

	const recent = points.filter((p) => p.t >= now - WINDOW_DAYS * DAY_MS);
	if (recent.length < MIN_POINTS) return null;
	if (recent[recent.length - 1].t - recent[0].t < MIN_SPAN_DAYS * DAY_MS) return null;

	const slope = slopePerDay(recent);
	const threshold = driftThreshold(parameter);
	if (slope == null || threshold == null) return null;

	const change7d = slope * WINDOW_DAYS;
	if (Math.abs(change7d) < threshold) return null;

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
	now = Date.now()
): DriftAlert[] {
	const byParameter = new Map<number, Measurement[]>();
	for (const m of measurements) {
		const list = byParameter.get(m.parameterId);
		if (list) list.push(m);
		else byParameter.set(m.parameterId, [m]);
	}
	const alerts: DriftAlert[] = [];
	for (const p of parameters) {
		const alert = analyzeParameter(p, byParameter.get(p.id) ?? [], now);
		if (alert) alerts.push(alert);
	}
	return alerts.sort((a, b) => (a.level === b.level ? 0 : a.level === 'hors_plage' ? -1 : 1));
}

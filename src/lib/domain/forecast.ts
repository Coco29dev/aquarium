import { DAY_MS } from './dates';
import { cyclingForAquarium, hasCycled } from './cycling';
import { driftThreshold, lastWaterChanges, slopePerDay } from './drift';
import type { AquariumEvent, Completion, Measurement, Parameter, Task } from '../types';

/** Valeur encore dans la plage, mais qui devrait en sortir bientôt au rythme actuel. */
export interface Forecast {
	parameterId: number;
	aquariumId: number;
	/** Borne que la valeur va franchir. */
	bound: number;
	direction: 'monte' | 'baisse';
	/** Jours (entiers, au moins 1) avant la sortie de plage. */
	days: number;
	slopePerDay: number;
	message: string;
}

const WINDOW_DAYS = 14;
const HORIZON_DAYS = 21;
const MIN_POINTS = 3;
const MIN_SPAN_DAYS = 3;
/** Pente ignorée sous cette fraction du seuil de dérive hebdomadaire : c'est du bruit de mesure. */
const NOISE_RATIO = 0.3;

function fmt(value: number, decimals: number): string {
	return value.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function forecastParameter(
	parameter: Parameter,
	measurements: Pick<Measurement, 'value' | 'measuredAt'>[],
	now = Date.now(),
	/** Dernier changement d'eau : la pente ne regarde que ce qui le suit. */
	since?: number
): Forecast | null {
	const points = measurements
		.map((m) => ({ t: new Date(m.measuredAt).getTime(), v: m.value }))
		.filter((p) => p.t <= now && p.t >= Math.max(now - WINDOW_DAYS * DAY_MS, since ?? 0))
		.sort((a, b) => a.t - b.t);
	if (points.length < MIN_POINTS) return null;
	if (points[points.length - 1].t - points[0].t < MIN_SPAN_DAYS * DAY_MS) return null;

	const latest = points[points.length - 1].v;
	const { min, max } = parameter;
	if ((max != null && latest > max) || (min != null && latest < min)) return null; // déjà couvert par l'alerte

	const slope = slopePerDay(points);
	const threshold = driftThreshold(parameter);
	if (slope == null || threshold == null) return null;
	if (Math.abs(slope) * 7 < NOISE_RATIO * threshold) return null;

	const up = slope > 0;
	const bound = up ? max : min;
	// Une valeur « le moins possible » (plancher nul) qui baisse ne pose pas de problème.
	if (bound == null || (!up && bound <= 0)) return null;

	const days = Math.max(1, Math.ceil((bound - latest) / slope));
	if (days > HORIZON_DAYS) return null;

	const unit = parameter.unit ? ` ${parameter.unit}` : '';
	const when = days === 1 ? 'demain' : `dans ${days} jours`;
	return {
		parameterId: parameter.id,
		aquariumId: parameter.aquariumId,
		bound,
		direction: up ? 'monte' : 'baisse',
		days,
		slopePerDay: slope,
		message: `${parameter.name} ${up ? 'atteindra' : 'descendra à'} ${fmt(bound, parameter.decimals)}${unit} ${when}`
	};
}

/** Prévisions de tous les paramètres, la plus proche d'abord. Mêmes exclusions que les alertes. */
export function collectForecasts(
	data: { parameters: Parameter[]; measurements: Measurement[]; tasks: Task[]; completions?: Completion[]; events?: AquariumEvent[] },
	now = Date.now()
): Forecast[] {
	const changes = lastWaterChanges(data.tasks, data.completions ?? [], data.events ?? []);
	const cycling = new Set<number>();
	for (const aquariumId of new Set(data.parameters.map((p) => p.aquariumId))) {
		const parameters = data.parameters.filter((p) => p.aquariumId === aquariumId);
		const measurements = data.measurements.filter((m) => m.aquariumId === aquariumId);
		const status = cyclingForAquarium(parameters, measurements);
		if (status && status.stage !== 'pret' && status.stage !== 'aucune_mesure' && !hasCycled(parameters, measurements)) cycling.add(aquariumId);
	}
	const byParameter = new Map<number, Measurement[]>();
	for (const m of data.measurements) {
		const list = byParameter.get(m.parameterId);
		if (list) list.push(m);
		else byParameter.set(m.parameterId, [m]);
	}
	const out: Forecast[] = [];
	for (const p of data.parameters) {
		if (cycling.has(p.aquariumId) && ['nh3', 'no2'].includes(p.key ?? '')) continue;
		const f = forecastParameter(p, byParameter.get(p.id) ?? [], now, changes.get(p.aquariumId));
		if (f) out.push(f);
	}
	return out.sort((a, b) => a.days - b.days);
}

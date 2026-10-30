import { collectTankAlerts, type DriftAlert } from '$lib/domain/drift';
import { cyclingForAquarium, hasCycled, type CyclingStatus } from '$lib/domain/cycling';
import { dueTasks } from '$lib/domain/tasks';
import { dayInParis } from '$lib/domain/dates';
import { daysSinceWaterChange } from '$lib/ui';
import type { Aquarium, Snapshot, Task } from '$lib/types';

export type HealthLevel = 'ok' | 'warn' | 'bad' | 'cycle';

export interface TankHealth {
	level: HealthLevel;
	label: string;
	alerts: DriftAlert[];
	due: Task[];
	coach: CyclingStatus | null;
	waterDays: number | null;
	lastMeasuredAt: string | null;
}

/** Résumé de l'état d'un bac pour les cartes : alertes, tâches dues, cyclage, dernier changement d'eau. */
export function tankHealth(view: Snapshot, aquarium: Aquarium, now = Date.now()): TankHealth {
	const parameters = view.parameters.filter((p) => p.aquariumId === aquarium.id);
	const measurements = view.measurements.filter((m) => m.aquariumId === aquarium.id);
	const alerts = collectTankAlerts({ ...view, parameters, measurements }, now);
	const due = dueTasks(view.tasks.filter((t) => t.aquariumId === aquarium.id), now);
	const status = cyclingForAquarium(parameters, measurements);
	// Un bac qui a déjà cyclé et qui revoit de l'ammoniaque est en alerte, pas en cyclage.
	const coach =
		status && status.stage !== 'pret' && status.stage !== 'aucune_mesure' && !hasCycled(parameters, measurements) ? status : null;
	const waterDays = daysSinceWaterChange(aquarium, view.tasks, view.completions ?? [], dayInParis(now));
	const lastMeasuredAt = measurements.length ? measurements[measurements.length - 1].measuredAt : null;

	const outOfRange = alerts.filter((a) => a.level === 'hors_plage').length;
	let level: HealthLevel = 'ok';
	let label = 'Tout est dans la plage';
	if (coach) {
		level = 'cycle';
		label = 'En cyclage';
	} else if (outOfRange) {
		level = 'bad';
		label = `${outOfRange} valeur${outOfRange > 1 ? 's' : ''} hors plage`;
	} else if (alerts.length) {
		level = 'warn';
		label = `${alerts.length} dérive${alerts.length > 1 ? 's' : ''} à surveiller`;
	} else if (!measurements.length) {
		label = 'Pas encore de mesure';
	}
	return { level, label, alerts, due, coach, waterDays, lastMeasuredAt };
}

export const HEALTH_STYLE: Record<HealthLevel, string> = {
	ok: 'text-ok',
	warn: 'text-warn',
	bad: 'text-bad',
	cycle: 'text-ink'
};

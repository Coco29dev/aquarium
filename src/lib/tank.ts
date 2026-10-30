import { collectAlerts, type DriftAlert } from '$lib/domain/drift';
import { cyclingForAquarium, type CyclingStatus } from '$lib/domain/cycling';
import { dueTasks } from '$lib/domain/tasks';
import { dayInParis } from '$lib/domain/dates';
import { daysSinceEvent } from '$lib/domain/events';
import { daysSinceWaterChange } from '$lib/ui';
import type { Aquarium, AquariumStage, Snapshot, Task } from '$lib/types';

export type HealthLevel = 'ok' | 'warn' | 'bad' | 'cycle' | 'projet';

/** Étape d'un bac ; un ancien cache sans le champ vaut « actif ». */
export const stageOf = (aquarium: Pick<Aquarium, 'stage'>): AquariumStage => aquarium.stage ?? 'actif';

/** Bac pas encore en eau : ni alertes, ni tâches dues, ni rappels. */
export const isProject = (aquarium: Pick<Aquarium, 'stage'>): boolean => stageOf(aquarium) === 'projet';

/** Bacs en eau (cyclage ou actifs) : ceux qui comptent pour les alertes, tâches, anneaux et rappels. */
export const activeTanks = (view: Pick<Snapshot, 'aquariums'>): Aquarium[] => view.aquariums.filter((a) => !isProject(a));

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
	if (isProject(aquarium)) {
		return { level: 'projet', label: 'En projet', alerts: [], due: [], coach: null, waterDays: null, lastMeasuredAt: null };
	}
	const parameters = view.parameters.filter((p) => p.aquariumId === aquarium.id);
	const measurements = view.measurements.filter((m) => m.aquariumId === aquarium.id);
	const alerts = collectAlerts(parameters, measurements, now);
	const due = dueTasks(view.tasks.filter((t) => t.aquariumId === aquarium.id), now);
	const status = cyclingForAquarium(parameters, measurements);
	const coach = status && status.stage !== 'pret' && status.stage !== 'aucune_mesure' ? status : null;
	// Le journal d'événements (changements d'eau cochés ou saisis à la main) prime ; repli sur les réalisations de tâches.
	const waterDays =
		daysSinceEvent(view.events ?? [], aquarium.id, 'changement_eau', now) ??
		daysSinceWaterChange(aquarium, view.tasks, view.completions ?? [], dayInParis(now));
	const lastMeasuredAt = measurements.length ? measurements[measurements.length - 1].measuredAt : null;

	const outOfRange = alerts.filter((a) => a.level === 'hors_plage').length;
	let level: HealthLevel = 'ok';
	let label = 'Tout est dans la plage';
	if (stageOf(aquarium) === 'cyclage' && status?.ready) {
		label = 'Cyclage terminé';
	} else if (coach || stageOf(aquarium) === 'cyclage') {
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
	cycle: 'text-ink',
	projet: 'text-ink'
};

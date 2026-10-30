import { addDays, daysBetween } from './dates';

export interface ConsumableInput {
	installedOn: string | null;
	replaceEveryDays: number | null;
	unitPrice: number | null;
}

export interface ReplacementRecord {
	installedOn: string;
	replacedOn: string;
}

export type LifeStatus = 'ok' | 'bientot' | 'en_retard' | 'inconnu';

export interface ConsumableLife {
	plannedDays: number | null;
	/** Durée moyenne mesurée sur les 3 derniers remplacements. */
	observedDays: number | null;
	/** Durée retenue : mesurée dès 2 remplacements, sinon prévue. */
	effectiveDays: number | null;
	dueOn: string | null;
	daysLeft: number | null;
	status: LifeStatus;
	costPerMonth: number | null;
	suggestion: string | null;
}

const SOON_DAYS = 14;
const DEVIATION = 0.25;

export function consumableLife(c: ConsumableInput, history: ReplacementRecord[], today: string): ConsumableLife {
	const recent = [...history].sort((a, b) => b.replacedOn.localeCompare(a.replacedOn)).slice(0, 3);
	const durations = recent.map((r) => daysBetween(r.installedOn, r.replacedOn)).filter((d) => d > 0);
	const observedDays = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
	const plannedDays = c.replaceEveryDays;
	const effectiveDays = history.length >= 2 && observedDays != null ? observedDays : plannedDays;

	const dueOn = c.installedOn && effectiveDays ? addDays(c.installedOn, effectiveDays) : null;
	const daysLeft = dueOn ? daysBetween(today, dueOn) : null;
	const status: LifeStatus =
		daysLeft == null ? 'inconnu' : daysLeft < 0 ? 'en_retard' : daysLeft <= SOON_DAYS ? 'bientot' : 'ok';

	const costPerMonth = c.unitPrice != null && effectiveDays ? Math.round(((c.unitPrice / effectiveDays) * 30.4) * 100) / 100 : null;

	let suggestion: string | null = null;
	if (history.length >= 2 && observedDays != null && plannedDays) {
		const gap = (observedDays - plannedDays) / plannedDays;
		if (Math.abs(gap) >= DEVIATION) {
			suggestion = `Tu le remplaces en moyenne tous les ${observedDays} j au lieu de ${plannedDays} j prévus : ajuste la fréquence si c'est voulu.`;
		}
	}

	return { plannedDays, observedDays, effectiveDays, dueOn, daysLeft, status, costPerMonth, suggestion };
}

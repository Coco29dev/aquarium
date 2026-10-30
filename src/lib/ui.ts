import { daysBetween, dayInParis } from '$lib/domain/dates';
import type { Aquarium, Completion, Task, WaterType } from '$lib/types';

/** Couleur système d'un bac (variable CSS), selon son type d'eau. */
export const TANK_TONE: Record<WaterType, string> = {
	douce: 'var(--cyan)',
	plantee: 'var(--green)',
	mer: 'var(--indigo)',
	recif: 'var(--orange)'
};

/** Icône associée au type d'eau. */
export const TANK_ICON: Record<WaterType, 'drop' | 'leaf' | 'bacs' | 'coral'> = {
	douce: 'drop',
	plantee: 'leaf',
	mer: 'bacs',
	recif: 'coral'
};

export const SHORT_WATER: Record<WaterType, string> = {
	douce: 'Eau douce',
	plantee: 'Planté',
	mer: 'Eau de mer',
	recif: 'Récif'
};

/** Nombre à la française avec un nombre fixe de décimales. */
export function fmt(value: number | null | undefined, decimals = 1): string {
	if (value == null || !Number.isFinite(value)) return '—';
	return value.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** « aujourd'hui », « hier », « il y a 3 j », « demain », « dans 4 j ». */
export function relativeDay(day: string, today = dayInParis()): string {
	const d = daysBetween(today, day);
	if (d === 0) return "aujourd'hui";
	if (d === -1) return 'hier';
	if (d === 1) return 'demain';
	return d < 0 ? `il y a ${-d} j` : `dans ${d} j`;
}

/** Retard d'une tâche, en jours (0 si à faire aujourd'hui ou plus tard). */
export function lateBy(task: Pick<Task, 'nextDue'>, today = dayInParis()): number {
	return Math.max(0, daysBetween(task.nextDue, today));
}

/** Dernière réalisation d'une tâche, ou null. */
export function lastDone(taskId: number, completions: Completion[]): Completion | null {
	for (let i = completions.length - 1; i >= 0; i--) if (completions[i].taskId === taskId) return completions[i];
	return null;
}

/** Jours depuis le dernier changement d'eau du bac (tâches de type « eau »), ou null. */
export function daysSinceWaterChange(
	aquarium: Pick<Aquarium, 'id'>,
	tasks: Task[],
	completions: Completion[],
	today = dayInParis()
): number | null {
	const ids = new Set(tasks.filter((t) => t.aquariumId === aquarium.id && t.kind === 'eau').map((t) => t.id));
	let latest: string | null = null;
	for (const c of completions) if (ids.has(c.taskId) && (!latest || c.doneAt > latest)) latest = c.doneAt;
	return latest ? daysBetween(dayInParis(latest), today) : null;
}

/** Âge du bac en jours depuis sa mise en eau, ou null. */
export function tankAge(aquarium: Pick<Aquarium, 'startedOn'>, today = dayInParis()): number | null {
	return aquarium.startedOn ? daysBetween(aquarium.startedOn, today) : null;
}

/** Date courte : « ven. 30 oct. ». */
export function shortDate(value: string | Date): string {
	return new Date(value).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' });
}

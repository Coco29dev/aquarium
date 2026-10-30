import { addDays, dayInParis } from './dates';
import type { Task } from '../types';

/** Tâches actives à faire aujourd'hui ou en retard, les plus en retard d'abord. */
export function dueTasks(tasks: Task[], now: Date | number = Date.now()): Task[] {
	const today = dayInParis(now);
	return tasks
		.filter((t) => t.active && t.nextDue <= today)
		.sort((a, b) => a.nextDue.localeCompare(b.nextDue));
}

/** Prochaine échéance après réalisation : comptée depuis le jour de réalisation. */
export function nextDueAfter(doneAt: Date | string | number, everyDays: number): string {
	return addDays(dayInParis(doneAt), everyDays);
}

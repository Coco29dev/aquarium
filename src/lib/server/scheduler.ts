import cron from 'node-cron';
import { env } from '$env/dynamic/private';
import { db } from './db';
import { loadSnapshot } from './data';
import { sendToAll } from './push';
import { collectAlerts } from '$lib/domain/drift';
import { dayInParis, TIMEZONE } from '$lib/domain/dates';
import { dueTasks } from '$lib/domain/tasks';
import { consumableLife } from '$lib/domain/consumables';

let started = false;

/** Rappel quotidien : tâches du jour, alertes et cyclage en cours. Une seule fois par jour. */
export async function sendDailyReminder(now = new Date()): Promise<boolean> {
	const today = dayInParis(now);
	const last = await db().query<{ value: string }>(`SELECT value FROM app_state WHERE key = 'last_reminder_day'`);
	if (last.rows[0]?.value === today) return false;

	const snapshot = await loadSnapshot();
	const due = dueTasks(snapshot.tasks, now);
	const alerts = collectAlerts(snapshot.parameters, snapshot.measurements, now.getTime());

	const lapsed = (snapshot.consumables ?? []).filter((c) => {
		const life = consumableLife(c, c.history, today);
		return life.daysLeft != null && life.daysLeft <= 0;
	});

	const parts: string[] = [];
	if (due.length) parts.push(`${due.length} tâche${due.length > 1 ? 's' : ''} à faire`);
	if (alerts.length) parts.push(`${alerts.length} alerte${alerts.length > 1 ? 's' : ''}`);
	if (lapsed.length) parts.push(`${lapsed.length} consommable${lapsed.length > 1 ? 's' : ''} à remplacer`);
	if (!parts.length) return false;

	const first = due[0]?.title ?? alerts[0]?.message ?? lapsed[0]?.name;
	await sendToAll({ title: 'Bulle', body: `${parts.join(', ')} · ${first}`, url: '/' });
	await db().query(
		`INSERT INTO app_state (key, value) VALUES ('last_reminder_day', $1)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
		[today]
	);
	return true;
}

/**
 * Planificateur interne (pas le cron Railway : trop imprécis). Tourne chaque heure de
 * REMINDER_HOUR (8 h par défaut) à 21 h : si le service a redémarré ou raté l'heure,
 * le rappel part à l'exécution suivante, toujours une seule fois par jour.
 */
export function startScheduler(): void {
	if (started) return;
	started = true;
	const from = Number(env.REMINDER_HOUR ?? 8);
	cron.schedule(
		`0 ${from}-21 * * *`,
		() => {
			sendDailyReminder().catch((error) => console.error('[rappels]', error));
		},
		{ timezone: TIMEZONE }
	);
	console.log(`[rappels] planificateur actif (de ${from} h à 21 h, ${TIMEZONE})`);
}

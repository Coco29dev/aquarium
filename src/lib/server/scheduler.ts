import cron from 'node-cron';
import { env } from '$env/dynamic/private';
import { db } from './db';
import { loadSnapshot } from './data';
import { sendToAll } from './push';
import { getNotificationSettings } from './settings';
import { runBackup } from './backup';
import { collectAlerts } from '$lib/domain/drift';
import { dayInParis, TIMEZONE } from '$lib/domain/dates';
import { dueTasks } from '$lib/domain/tasks';
import { consumableLife } from '$lib/domain/consumables';
import { parisMinutes, parisWeekday, summaryDue, weeklyDue } from '$lib/domain/notifications';
import { weeklyReport } from '$lib/domain/weekly';
import { activeTanks } from '$lib/tank';

let started = false;

/**
 * Récapitulatif quotidien : tâches du jour, alertes et consommables des bacs choisis.
 * Part à l'heure réglée (Europe/Paris), jamais pendant les heures de silence, une fois par jour.
 * Le push porte le nombre de tâches dues pour la pastille de l'icône. Repli ntfy si aucun push n'aboutit.
 */
export async function sendDailyReminder(now = new Date()): Promise<boolean> {
	const today = dayInParis(now);
	const settings = await getNotificationSettings();
	const last = await db().query<{ value: string }>(`SELECT value FROM app_state WHERE key = 'last_reminder_day'`);
	if (!summaryDue(settings, parisMinutes(now), last.rows[0]?.value === today)) return false;

	const snapshot = await loadSnapshot();
	const chosen = settings.aquariumIds ? new Set(settings.aquariumIds) : null;
	// Les bacs en projet ne sont pas en eau : ni tâche, ni alerte, ni rappel.
	const inWater = new Set(activeTanks(snapshot).map((a) => a.id));
	const inScope = (aquariumId: number) => inWater.has(aquariumId) && (!chosen || chosen.has(aquariumId));
	const due = dueTasks(snapshot.tasks.filter((t) => inScope(t.aquariumId)), now);
	const alerts = collectAlerts(
		snapshot.parameters.filter((p) => inScope(p.aquariumId)),
		snapshot.measurements.filter((m) => inScope(m.aquariumId)),
		now.getTime()
	);
	const lapsed = (snapshot.consumables ?? []).filter((c) => {
		if (!inScope(c.aquariumId)) return false;
		const life = consumableLife(c, c.history, today);
		return life.daysLeft != null && life.daysLeft <= 0;
	});

	const parts: string[] = [];
	if (due.length) parts.push(`${due.length} tâche${due.length > 1 ? 's' : ''} à faire`);
	if (alerts.length) parts.push(`${alerts.length} alerte${alerts.length > 1 ? 's' : ''}`);
	if (lapsed.length) parts.push(`${lapsed.length} consommable${lapsed.length > 1 ? 's' : ''} à remplacer`);
	// Rien à dire : on marque quand même la journée pour ne pas réévaluer toutes les 5 minutes.
	if (parts.length) {
		const first = due[0]?.title ?? alerts[0]?.message ?? lapsed[0]?.name;
		const body = `${parts.join(', ')} · ${first}`;
		let delivered = false;
		try {
			const results = await sendToAll({ title: 'Aquarium', body, url: '/', badge: due.length });
			delivered = results.some((r) => r.ok);
		} catch (error) {
			console.error('[rappels] push impossible', error);
		}
		const topic = settings.ntfyTopic ?? env.NTFY_TOPIC;
		if (!delivered && topic) await sendNtfy(topic, body);
	}
	await db().query(
		`INSERT INTO app_state (key, value) VALUES ('last_reminder_day', $1)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
		[today]
	);
	return parts.length > 0;
}

/**
 * Bilan de la semaine : le dimanche à l'heure réglée (Europe/Paris), jamais pendant les heures de silence,
 * une seule fois par semaine (la clé `last_weekly_report` garde le dimanche déjà traité).
 * Le corps du push est une phrase calculée par weeklyReport ; il ouvre l'écran /bilan. Repli ntfy comme le récapitulatif.
 */
export async function sendWeeklyReport(now = new Date()): Promise<boolean> {
	const settings = await getNotificationSettings();
	const today = dayInParis(now);
	const last = await db().query<{ value: string }>(`SELECT value FROM app_state WHERE key = 'last_weekly_report'`);
	if (!weeklyDue(settings, parisWeekday(now), parisMinutes(now), last.rows[0]?.value === today)) return false;

	const snapshot = await loadSnapshot();
	// Seuls les bacs choisis comptent ; les bacs en projet sont ignorés par weeklyReport.
	const chosen = settings.aquariumIds ? new Set(settings.aquariumIds) : null;
	const inScope = <T extends { aquariumId: number }>(list: T[]) => (chosen ? list.filter((x) => chosen.has(x.aquariumId)) : list);
	const report = weeklyReport(
		{
			aquariums: snapshot.aquariums.filter((a) => !chosen || chosen.has(a.id)),
			parameters: inScope(snapshot.parameters),
			measurements: inScope(snapshot.measurements),
			tasks: inScope(snapshot.tasks),
			completions: snapshot.completions,
			events: snapshot.events ? inScope(snapshot.events) : undefined,
			feedings: snapshot.feedings ? inScope(snapshot.feedings) : undefined
		},
		now.getTime()
	);

	let delivered = false;
	try {
		const results = await sendToAll({ title: 'Bilan de la semaine', body: report.summary, url: '/bilan' });
		delivered = results.some((r) => r.ok);
	} catch (error) {
		console.error('[bilan] push impossible', error);
	}
	const topic = settings.ntfyTopic ?? env.NTFY_TOPIC;
	if (!delivered && topic) await sendNtfy(topic, `Bilan de la semaine : ${report.summary}`);
	await db().query(
		`INSERT INTO app_state (key, value) VALUES ('last_weekly_report', $1)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
		[today]
	);
	return true;
}

/** Repli quand le push iOS ne passe plus : notification ntfy.sh (appli ntfy sur l'iPhone). */
async function sendNtfy(topic: string, body: string): Promise<void> {
	try {
		const response = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
			method: 'POST',
			body,
			headers: { Title: 'Aquarium', Tags: 'fish' }
		});
		if (!response.ok) console.error(`[rappels] ntfy refusé (${response.status})`);
	} catch (error) {
		console.error('[rappels] ntfy injoignable', error);
	}
}

/**
 * Planificateur interne (pas le cron Railway : trop imprécis). Toutes les 5 minutes, regarde
 * si le récapitulatif doit partir ; un redémarrage ou une heure ratée est rattrapé au passage suivant.
 * Sauvegarde complète chaque dimanche à 3 h 10.
 */
export function startScheduler(): void {
	if (started) return;
	started = true;
	cron.schedule(
		'*/5 * * * *',
		() => {
			sendDailyReminder().catch((error) => console.error('[rappels]', error));
			sendWeeklyReport().catch((error) => console.error('[bilan]', error));
		},
		{ timezone: TIMEZONE }
	);
	cron.schedule(
		'10 3 * * 0',
		() => {
			runBackup().catch((error) => console.error('[sauvegarde]', error));
		},
		{ timezone: TIMEZONE }
	);
	console.log(`[rappels] planificateur actif (récapitulatif quotidien, bilan et sauvegarde le dimanche, ${TIMEZONE})`);
}

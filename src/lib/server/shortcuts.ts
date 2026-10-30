import { json } from '@sveltejs/kit';
import { db } from './db';
import { applyOps } from './data';
import { addFeedingNow } from './feedings';
import { ShortcutError, matchByName, ordinal, parseValue, pickAquarium, pickParameter, speakable } from './shortcuts-match';
import { analyzeParameter } from '$lib/domain/drift';
import { feedingStatus, feedingsToday } from '$lib/domain/feeding';
import { dayInParis, TIMEZONE } from '$lib/domain/dates';
import type { Feeding, Measurement, Parameter } from '$lib/types';

// Actions des raccourcis vocaux. Chaque route répond { ok, message } : une phrase courte, lisible à voix haute.

export { ShortcutError } from './shortcuts-match';

export interface ShortcutAquarium {
	id: number;
	name: string;
	feedingsPerDay: number | null;
}

let stageColumn: boolean | undefined;
/** Vrai si la colonne `stage` existe (bacs « en projet » exclus des raccourcis). */
async function hasStageColumn(): Promise<boolean> {
	if (stageColumn) return true;
	const { rowCount } = await db().query(
		`SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'aquariums' AND column_name = 'stage'`
	);
	stageColumn = Boolean(rowCount);
	return stageColumn;
}

/** Aquariums utilisables par un raccourci : tous, sauf ceux encore en projet. */
export async function shortcutAquariums(): Promise<ShortcutAquarium[]> {
	const where = (await hasStageColumn()) ? `WHERE stage <> 'projet'` : '';
	const { rows } = await db().query<ShortcutAquarium>(
		`SELECT id, name, feedings_per_day AS "feedingsPerDay" FROM aquariums ${where} ORDER BY id`
	);
	return rows;
}

/** Aquarium visé par son nom (insensible aux accents et à la casse) ; nom facultatif s'il n'y en a qu'un. */
export async function resolveAquarium(name?: string | null): Promise<ShortcutAquarium> {
	return pickAquarium(await shortcutAquariums(), name);
}

const PARAM_COLUMNS = `id, aquarium_id AS "aquariumId", key, name, unit, min_value AS "min", max_value AS "max",
	drift_per_week AS "driftPerWeek", decimals, step, position`;

/** Paramètre d'un aquarium par clé, alias courant (« nitrates ») ou nom. */
export async function resolveParameter(aquariumId: number, text: string, aquariumName = 'ce bac'): Promise<Parameter> {
	const { rows } = await db().query<Parameter>(`SELECT ${PARAM_COLUMNS} FROM parameter_defs WHERE aquarium_id = $1 ORDER BY position, id`, [
		aquariumId
	]);
	return pickParameter(rows, text, aquariumName);
}

const fr = (value: number, decimals = 2) => value.toLocaleString('fr-FR', { maximumFractionDigits: decimals });

/** Réponse JSON commune : { ok, message }. */
export const reply = (ok: boolean, message: string, status = 200) => json({ ok, message }, { status });

/** Exécute une action et convertit toute erreur en réponse { ok: false, message } avec le bon code. */
export async function run(action: () => Promise<string>): Promise<Response> {
	try {
		return reply(true, await action());
	} catch (e) {
		if (e instanceof ShortcutError) return reply(false, e.message, e.status);
		const status = (e as { status?: number }).status;
		const body = (e as { body?: { message?: string } }).body;
		if (typeof status === 'number' && body?.message) return reply(false, body.message, status === 404 ? 404 : 400);
		console.error('[raccourcis]', e);
		return reply(false, 'Une erreur est survenue côté serveur. Réessaie dans un instant.', 500);
	}
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ShortcutError('Corps JSON attendu, par exemple {"parameter":"nitrates","value":25}.');
	return body as Record<string, unknown>;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

// --- Mesure --------------------------------------------------------------------

export async function shortcutMeasure(body: Record<string, unknown>): Promise<string> {
	const aquarium = await resolveAquarium(str(body.aquarium));
	if (typeof body.parameter !== 'string') throw new ShortcutError('Quel paramètre ? Par exemple nitrates, pH ou KH.');
	const parameter = await resolveParameter(aquarium.id, body.parameter, aquarium.name);
	const value = parseValue(body.value);

	let measuredAt = new Date();
	if (body.at !== undefined && body.at !== null && body.at !== '') {
		const parsed = typeof body.at === 'string' ? Date.parse(body.at) : NaN;
		if (Number.isNaN(parsed)) throw new ShortcutError('Date invalide : utilise le format 2026-10-30T18:30:00Z.');
		if (parsed > Date.now() + 5 * 60 * 1000) throw new ShortcutError('Cette date est dans le futur.');
		measuredAt = new Date(parsed);
	}

	await applyOps([
		{
			type: 'measurement',
			clientId: crypto.randomUUID(),
			aquariumId: aquarium.id,
			parameterId: parameter.id,
			value,
			measuredAt: measuredAt.toISOString()
		}
	]);

	const unit = parameter.unit ? ` ${parameter.unit}` : '';
	let message = `${speakable(parameter.name)} du ${aquarium.name} : ${fr(value, Math.max(parameter.decimals, 2))}${unit}, c'est noté.`;
	const { rows } = await db().query<Pick<Measurement, 'value' | 'measuredAt'>>(
		`SELECT value, to_char(measured_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "measuredAt"
		 FROM measurements WHERE parameter_id = $1 AND measured_at >= now() - interval '30 days' ORDER BY measured_at`,
		[parameter.id]
	);
	const alert = analyzeParameter(parameter, rows);
	if (alert) message += ` Attention : ${speakable(alert.message)}.`;
	return message;
}

// --- Tâche ---------------------------------------------------------------------

export async function shortcutTask(body: Record<string, unknown>): Promise<string> {
	if (typeof body.title !== 'string' || !body.title.trim()) throw new ShortcutError('Quelle tâche ? Par exemple « changement d’eau ».');
	const aquariums = await shortcutAquariums();
	const named = str(body.aquarium)?.trim();
	const scope = named ? [pickAquarium(aquariums, named)] : aquariums;
	if (!scope.length) throw new ShortcutError("Aucun aquarium en eau n'est enregistré.", 404);

	const { rows } = await db().query<{ id: number; name: string; aquariumId: number; nextDue: string }>(
		`SELECT id, title AS name, aquarium_id AS "aquariumId", next_due AS "nextDue"
		 FROM recurring_tasks WHERE active AND aquarium_id = ANY($1::int[]) ORDER BY next_due, id`,
		[scope.map((a) => a.id)]
	);
	const today = dayInParis();
	// Parmi les tâches qui correspondent, on prend celles qui sont dues avant les autres.
	const asked = body.title;
	const dueRows = rows.filter((t) => t.nextDue <= today);
	let task;
	try {
		task = matchByName(dueRows, asked, 'tâche due');
	} catch (e) {
		if (!(e instanceof ShortcutError) || e.status !== 404) throw e;
		task = matchByName(rows, asked, 'tâche');
	}
	const tank = aquariums.find((a) => a.id === task.aquariumId)!;

	// Même chemin que dans l'appli : réalisation + événement « changement d'eau » pour les tâches de type eau.
	await applyOps([{ type: 'completion', clientId: crypto.randomUUID(), taskId: task.id, doneAt: new Date().toISOString() }]);
	const { rows: after } = await db().query<{ nextDue: string }>('SELECT next_due AS "nextDue" FROM recurring_tasks WHERE id = $1', [task.id]);
	const next = after[0] ? new Date(`${after[0].nextDue}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TIMEZONE }) : null;
	return `${task.name} fait pour ${tank.name}.${next ? ` Prochaine échéance : ${next}.` : ''}`;
}

// --- Nourrissage ---------------------------------------------------------------

export async function shortcutFeed(body: Record<string, unknown>): Promise<string> {
	const aquarium = await resolveAquarium(str(body.aquarium));
	await addFeedingNow(aquarium.id, str(body.note));
	const { rows } = await db().query<Feeding>(
		`SELECT aquarium_id AS "aquariumId", to_char(fed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "fedAt"
		 FROM feedings WHERE aquarium_id = $1 AND fed_at >= now() - interval '2 days'`,
		[aquarium.id]
	);
	const { count } = feedingsToday(rows, aquarium.id);
	const status = feedingStatus(count, aquarium.feedingsPerDay);
	let message = `Repas noté pour ${aquarium.name} : ${ordinal(count)} aujourd'hui.`;
	if (status === 'complet') message += " C'est le dernier repas prévu pour aujourd'hui.";
	if (status === 'trop') message += ` Attention : tu dépasses les ${aquarium.feedingsPerDay} repas prévus.`;
	return message;
}

export async function shortcutPing(): Promise<string> {
	const tanks = await shortcutAquariums();
	return tanks.length ? `Raccourcis Aquarium connectés : ${tanks.map((t) => t.name).join(', ')}.` : 'Raccourcis Aquarium connectés, mais aucun bac en eau.';
}


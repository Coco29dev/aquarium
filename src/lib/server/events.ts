import { error } from '@sveltejs/kit';
import { db } from './db';
import { DEPARTURE_CAUSES, EVENT_KINDS, noonParisIso, validateEventPayload } from '$lib/domain/events';
import type { AquariumEvent, EventKind } from '$lib/types';

// Journal d'événements d'un bac. Les autres modules écrivent via recordEvent ; les routes /api/events
// permettent de lister, créer, corriger et supprimer. Aucun import de data.ts ici (data.ts importe ce fichier).

/** Pool ou client de transaction : seule la méthode query est utilisée. */
type Queryable = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }; // eslint-disable-line @typescript-eslint/no-explicit-any

const COLUMNS = `id, aquarium_id AS "aquariumId", kind,
	to_char(at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "at",
	payload, note, source, source_ref AS "sourceRef", client_id AS "clientId"`;

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export function assertEventNotFuture(iso: string): void {
	if (Date.parse(iso) > Date.now() + FUTURE_TOLERANCE_MS) error(400, "La date de l'événement est dans le futur");
}

export function isEventKind(value: unknown): value is EventKind {
	return typeof value === 'string' && (EVENT_KINDS as string[]).includes(value);
}

function checkPayload(kind: EventKind, payload: unknown): void {
	const problem = validateEventPayload(kind, payload);
	if (problem) error(400, problem);
}

export interface RecordEventInput {
	aquariumId: number;
	kind: EventKind;
	at: string;
	payload: Record<string, unknown>;
	note?: string | null;
	source: 'manuel' | 'tache' | 'auto';
	sourceRef?: number | null;
	clientId?: string | null;
}

/**
 * Enregistre un événement. Idempotent : un événement automatique (source 'tache' ou 'auto' avec
 * source_ref) ou un client_id déjà vu ne crée pas de doublon. Renvoie l'id, ou null si ignoré
 * (doublon ou bac disparu). À appeler depuis les autres modules serveur, avec le client de
 * transaction en cours quand il y en a un.
 */
export async function recordEvent(input: RecordEventInput, q: Queryable = db()): Promise<number | null> {
	checkPayload(input.kind, input.payload);
	const { rows } = await q.query(
		`INSERT INTO events (aquarium_id, kind, at, payload, note, source, source_ref, client_id)
		 SELECT a.id, $2::text, $3::timestamptz, $4::jsonb, $5::text, $6::text, $7::int, $8::uuid FROM aquariums a WHERE a.id = $1
		 ON CONFLICT DO NOTHING
		 RETURNING id`,
		[
			input.aquariumId,
			input.kind,
			input.at,
			JSON.stringify(input.payload),
			input.note?.trim() ? input.note.trim().slice(0, 1000) : null,
			input.source,
			input.sourceRef ?? null,
			input.clientId ?? null
		]
	);
	return rows[0]?.id ?? null;
}

export interface EventQuery {
	aquariumId?: number;
	kinds?: EventKind[];
	from?: string;
	to?: string;
	limit?: number;
}

/** Du plus ancien au plus récent ; `limit` garde les plus récents. */
export async function listEvents(query: EventQuery = {}, q: Queryable = db()): Promise<AquariumEvent[]> {
	const where: string[] = [];
	const params: unknown[] = [];
	if (query.aquariumId !== undefined) {
		params.push(query.aquariumId);
		where.push(`aquarium_id = $${params.length}`);
	}
	if (query.kinds?.length) {
		params.push(query.kinds);
		where.push(`kind = ANY($${params.length}::text[])`);
	}
	if (query.from) {
		params.push(query.from);
		where.push(`at >= $${params.length}::timestamptz`);
	}
	if (query.to) {
		params.push(query.to);
		where.push(`at <= $${params.length}::timestamptz`);
	}
	params.push(Math.min(Math.max(query.limit ?? 200, 1), 2000));
	const { rows } = await q.query(
		`SELECT ${COLUMNS} FROM events ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
		 ORDER BY at DESC, id DESC LIMIT $${params.length}`,
		params
	);
	return (rows as AquariumEvent[]).reverse();
}

/** Fenêtre du snapshot : 180 jours, 1000 événements au plus (les plus récents). */
export async function snapshotEvents(q: Queryable = db()): Promise<AquariumEvent[]> {
	const { rows } = await q.query(
		`SELECT ${COLUMNS} FROM events WHERE at >= now() - interval '180 days'
		 ORDER BY at DESC, id DESC LIMIT 1000`
	);
	return (rows as AquariumEvent[]).reverse();
}

export async function createEvent(input: {
	aquariumId: number;
	kind: EventKind;
	at?: string;
	payload: Record<string, unknown>;
	note?: string | null;
}): Promise<number> {
	checkPayload(input.kind, input.payload);
	const at = input.at ?? new Date().toISOString();
	assertEventNotFuture(at);
	const id = await recordEvent({ ...input, at, source: 'manuel' });
	if (id === null) error(404, 'Aquarium introuvable');
	return id;
}

export async function updateEvent(
	id: number,
	input: { at?: string; payload?: Record<string, unknown>; note?: string | null }
): Promise<void> {
	const { rows } = await db().query<{ kind: EventKind }>('SELECT kind FROM events WHERE id = $1', [id]);
	if (!rows[0]) error(404, 'Événement introuvable');
	if (input.payload !== undefined) checkPayload(rows[0].kind, input.payload);
	if (input.at !== undefined) assertEventNotFuture(input.at);
	await db().query(
		`UPDATE events SET
			at = COALESCE($2::timestamptz, at),
			payload = COALESCE($3::jsonb, payload),
			note = CASE WHEN $4::boolean THEN $5 ELSE note END
		 WHERE id = $1`,
		[
			id,
			input.at ?? null,
			input.payload === undefined ? null : JSON.stringify(input.payload),
			input.note !== undefined,
			input.note?.trim() ? input.note.trim().slice(0, 1000) : null
		]
	);
}

export async function deleteEvent(id: number): Promise<void> {
	await db().query('DELETE FROM events WHERE id = $1', [id]);
}

// --- Événements déduits des habitants (appelés par resources.ts) -------------------------------

interface InhabitantRow {
	aquarium_id: number;
	species: string;
	quantity: number;
	left_on: string | null;
}

export async function readInhabitant(id: number): Promise<InhabitantRow | null> {
	const { rows } = await db().query<InhabitantRow>(
		`SELECT aquarium_id, species, quantity, left_on::text AS left_on FROM inhabitants WHERE id = $1`,
		[id]
	);
	return rows[0] ?? null;
}

/** Création d'un habitant : événement « arrivée » (jour d'arrivée s'il est connu, sinon maintenant). */
export async function onInhabitantCreated(id: number, body: Record<string, unknown>): Promise<void> {
	const row = await readInhabitant(id);
	if (!row) return;
	const arrived = typeof body.arrivedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.arrivedOn) ? body.arrivedOn : null;
	await recordEvent({
		aquariumId: row.aquarium_id,
		kind: 'habitant_ajout',
		at: arrived ? noonParisIso(arrived) : new Date().toISOString(),
		payload: { species: row.species, quantity: Math.max(1, row.quantity) },
		source: 'auto',
		sourceRef: id
	});
	// Un habitant créé déjà parti (rare) : on n'invente pas de départ, il sera daté à la mise à jour.
}

/** Valide la cause de départ transmise à côté du formulaire (champ hors schéma de la ressource). */
export function parseDepartureCause(body: Record<string, unknown>): (typeof DEPARTURE_CAUSES)[number] | undefined {
	if (body.cause === undefined || body.cause === null || body.cause === '') return undefined;
	if (typeof body.cause !== 'string' || !(DEPARTURE_CAUSES as readonly string[]).includes(body.cause)) {
		error(400, 'Champ invalide : cause');
	}
	return body.cause as (typeof DEPARTURE_CAUSES)[number];
}

/** Mise à jour d'un habitant : le départ (left_on) crée l'événement « départ », l'annuler le retire. */
export async function onInhabitantUpdated(
	id: number,
	before: InhabitantRow | null,
	body: Record<string, unknown>,
	cause: (typeof DEPARTURE_CAUSES)[number] | undefined
): Promise<void> {
	if (!before || !('leftOn' in body)) return;
	const after = await readInhabitant(id);
	if (!after) return;
	if (after.left_on && !before.left_on) {
		await recordEvent({
			aquariumId: after.aquarium_id,
			kind: 'habitant_depart',
			at: noonParisIso(after.left_on),
			payload: { species: after.species, quantity: Math.max(1, after.quantity), ...(cause ? { cause } : {}) },
			source: 'auto',
			sourceRef: id
		});
	} else if (!after.left_on && before.left_on) {
		await db().query(`DELETE FROM events WHERE source = 'auto' AND kind = 'habitant_depart' AND source_ref = $1`, [id]);
	} else if (after.left_on && before.left_on && after.left_on !== before.left_on) {
		await db().query(
			`UPDATE events SET at = $2::timestamptz WHERE source = 'auto' AND kind = 'habitant_depart' AND source_ref = $1`,
			[id, noonParisIso(after.left_on)]
		);
	}
}

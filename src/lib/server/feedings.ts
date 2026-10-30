import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import { db } from './db';
import type { Feeding, SyncOp } from '$lib/types';

// Journal de nourrissage : un enregistrement par repas. Fichier sans import de data.ts (data.ts l'importe).

type FeedingOp = Extract<SyncOp, { type: 'feeding' }>;

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const SNAPSHOT_DAYS = 14;

const COLUMNS = `id, aquarium_id AS "aquariumId",
	to_char(fed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "fedAt", note, client_id AS "clientId"`;

/** Nourrissages des 14 derniers jours, du plus ancien au plus récent. */
export async function snapshotFeedings(): Promise<Feeding[]> {
	const { rows } = await db().query<Feeding>(
		`SELECT ${COLUMNS} FROM feedings WHERE fed_at >= now() - ($1 || ' days')::interval ORDER BY fed_at, id`,
		[String(SNAPSHOT_DAYS)]
	);
	return rows;
}

/** Valide une opération de la file d'envoi (une date future est ramenée à maintenant, comme pour les mesures). */
export function parseFeedingOp(op: Record<string, unknown>, when: (v: unknown) => string): FeedingOp {
	const aquariumId = Number(op.aquariumId);
	if (!Number.isInteger(aquariumId) || aquariumId <= 0) error(400, 'Aquarium invalide');
	const fedAt = when(op.fedAt);
	return {
		type: 'feeding',
		clientId: op.clientId as string,
		aquariumId,
		fedAt: Date.parse(fedAt) > Date.now() + FUTURE_TOLERANCE_MS ? new Date().toISOString() : fedAt,
		note: typeof op.note === 'string' && op.note.trim() ? op.note.trim().slice(0, 500) : undefined
	};
}

/** Enregistre un nourrissage dans la transaction en cours ; idempotent par client_id. */
export async function recordFeedingOp(client: PoolClient, op: FeedingOp): Promise<void> {
	await client.query(
		`INSERT INTO feedings (aquarium_id, fed_at, note, client_id)
		 SELECT a.id, $2::timestamptz, $3::text, $4::uuid FROM aquariums a WHERE a.id = $1
		 ON CONFLICT (client_id) DO NOTHING`,
		[op.aquariumId, op.fedAt, op.note ?? null, op.clientId]
	);
}

/** Enregistre un nourrissage immédiat (raccourcis Siri). Renvoie son id, ou null si le bac n'existe pas. */
export async function addFeedingNow(aquariumId: number, note?: string | null, at = new Date()): Promise<number | null> {
	const { rows } = await db().query<{ id: number }>(
		`INSERT INTO feedings (aquarium_id, fed_at, note)
		 SELECT a.id, $2::timestamptz, $3::text FROM aquariums a WHERE a.id = $1 RETURNING id`,
		[aquariumId, at.toISOString(), note?.trim() || null]
	);
	return rows[0]?.id ?? null;
}

export async function deleteFeeding(id: number): Promise<void> {
	const { rowCount } = await db().query('DELETE FROM feedings WHERE id = $1', [id]);
	if (!rowCount) error(404, 'Nourrissage introuvable');
}

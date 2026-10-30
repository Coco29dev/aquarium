import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import { db } from './db';
import { exportAll, readState, writeState } from './data';
import { deleteObject, getObject, putObject } from './storage';
import { EXPORTED_STATE_KEYS, RESTORE_TABLES, type TableSpec } from './tables';
import { exportedState, validateExport, type ValidationResult } from './restore-validate';
import { TIMEZONE } from '$lib/domain/dates';
import type { BackupListItem, RestorePreview, RestoreResult } from '$lib/types';

// Restauration d'un export JSON (voir exportAll). Principe :
//   1. validation de structure (restore-validate.ts, pur) ;
//   2. essai complet dans une transaction ANNULÉE : la base juge les types, CHECK et unicités ;
//   3. à l'application : sauvegarde de sécurité de l'état actuel, puis la même transaction, validée.
// Rien n'est touché hors des tables de RESTORE_TABLES et de l'état « notification_settings » :
// abonnements push, jetons, encyclopédie d'espèces et autres réglages restent en place.

const INSERT_CHUNK = 2000;
const SAFETY_KEEP = 5;
const SAFETY_INDEX = 'restore_backups';
const WEEKLY_KEYS = 'backup_keys';
const LAST_BACKUP = 'last_backup';

const BACKUP_KEY = /^backups\/(aquarium|avant-restauration)-[0-9A-Za-z_-]+\.json$/;

const q = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

async function tableExists(client: Pick<PoolClient, 'query'>, table: string): Promise<boolean> {
	const { rows } = await client.query<{ ok: boolean }>('SELECT to_regclass($1) IS NOT NULL AS ok', [`public.${table}`]);
	return Boolean(rows[0]?.ok);
}

/** Tables à restaurer qui existent réellement dans cette base. */
async function activeTables(client: Pick<PoolClient, 'query'>): Promise<TableSpec[]> {
	const out: TableSpec[] = [];
	for (const spec of RESTORE_TABLES) {
		if (spec.optionalTable && !(await tableExists(client, spec.table))) continue;
		out.push(spec);
	}
	return out;
}

async function currentCounts(specs: TableSpec[]): Promise<Record<string, number>> {
	const out: Record<string, number> = {};
	for (const spec of specs) {
		const { rows } = await db().query<{ n: string }>(`SELECT count(*) AS n FROM ${q(spec.table)}`);
		out[spec.key] = Number(rows[0].n);
	}
	return out;
}

async function columnsOf(client: Pick<PoolClient, 'query'>, table: string): Promise<Set<string>> {
	const { rows } = await client.query<{ column_name: string }>(
		`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
		[table]
	);
	return new Set(rows.map((r) => r.column_name));
}

/** Insère les lignes en conservant les identifiants ; les colonnes absentes du fichier prennent leur valeur par défaut. */
async function insertRows(
	client: PoolClient,
	table: string,
	rows: Record<string, unknown>[],
	dbColumns: Set<string>,
	skip: string[] = []
): Promise<string[]> {
	if (!rows.length) return [];
	const present = new Set<string>();
	for (const row of rows) for (const key of Object.keys(row)) present.add(key);
	const ignored = [...present].filter((c) => !dbColumns.has(c));
	const columns = [...present].filter((c) => dbColumns.has(c) && !skip.includes(c));
	const list = columns.map(q).join(', ');
	for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
		const chunk = rows.slice(i, i + INSERT_CHUNK);
		await client.query(
			`INSERT INTO ${q(table)} (${list})
			 SELECT ${list} FROM jsonb_populate_recordset(NULL::${q(table)}, $1::jsonb)`,
			[JSON.stringify(chunk)]
		);
	}
	return ignored;
}

interface ApplyOutcome {
	counts: Record<string, number>;
	warnings: string[];
}

/** Vide puis remplit les tables dans la transaction ouverte par l'appelant. */
async function replaceAll(
	client: PoolClient,
	validation: ValidationResult,
	payload: unknown,
	specs: TableSpec[],
	finalize: boolean
): Promise<ApplyOutcome> {
	const warnings: string[] = [];
	const rows = validation.rows;

	await client.query(`TRUNCATE ${specs.map((s) => q(s.table)).join(', ')}`);

	// Espèces connues de cette base : une espèce « maison » absente est détachée, pas bloquante.
	const speciesIds = new Set<number>();
	{
		const wanted = new Set<number>();
		for (const key of ['inhabitants', 'projectItems']) {
			for (const r of rows[key] ?? []) if (Number.isInteger(r.species_id)) wanted.add(r.species_id as number);
		}
		if (wanted.size) {
			const { rows: found } = await client.query<{ id: number }>('SELECT id FROM species WHERE id = ANY($1::int[])', [[...wanted]]);
			for (const r of found) speciesIds.add(r.id);
		}
	}

	const covers = new Map<number, number>();
	for (const spec of specs) {
		let data = rows[spec.key] ?? [];
		const dbColumns = await columnsOf(client, spec.table);
		const skip: string[] = [];

		if (spec.key === 'aquariums') {
			// aquariums ↔ photos se référencent : la couverture est remise après l'insertion des photos.
			for (const r of data) if (Number.isInteger(r.cover_photo_id)) covers.set(r.id as number, r.cover_photo_id as number);
			skip.push('cover_photo_id');
		}
		if (spec.key === 'inhabitants' || spec.key === 'projectItems') {
			let detached = 0;
			data = data.map((r) => {
				if (Number.isInteger(r.species_id) && !speciesIds.has(r.species_id as number)) {
					detached++;
					return { ...r, species_id: null };
				}
				return r;
			});
			if (detached) warnings.push(`${detached} fiche${detached > 1 ? 's' : ''} d'espèce introuvable${detached > 1 ? 's' : ''} dans cette base : le lien est retiré (le nom reste).`);
		}

		const ignored = await insertRows(client, spec.table, data, dbColumns, skip);
		if (ignored.length) warnings.push(`Colonnes inconnues de « ${spec.label} » ignorées : ${ignored.join(', ')}.`);
	}

	// Couvertures : seulement celles dont la photo existe dans le fichier (validation déjà avertie du reste).
	const photoIds = new Set((rows.photos ?? []).map((p) => p.id as number));
	for (const [aquariumId, photoId] of covers) {
		if (photoIds.has(photoId)) await client.query('UPDATE aquariums SET cover_photo_id = $2 WHERE id = $1', [aquariumId, photoId]);
	}

	// Réglages de notifications inclus dans l'export.
	for (const key of EXPORTED_STATE_KEYS) {
		const value = exportedState(payload, key);
		if (value !== null) {
			await client.query(
				`INSERT INTO app_state (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
				[key, JSON.stringify(value)]
			);
		}
	}

	if (finalize) {
		// setval n'est pas transactionnel : seulement à l'application réelle.
		for (const spec of specs) {
			await client.query(
				`SELECT setval(
					pg_get_serial_sequence($1, 'id'),
					GREATEST(COALESCE((SELECT MAX(id) FROM ${q(spec.table)}), 0), 1),
					(SELECT MAX(id) IS NOT NULL FROM ${q(spec.table)})
				)`,
				[`public.${spec.table}`]
			);
		}
	}
	return { counts: validation.counts, warnings };
}

function previewOf(validation: ValidationResult, current: Record<string, number>, extra: { errors?: string[]; warnings?: string[] } = {}): RestorePreview {
	const errors = [...validation.errors, ...(extra.errors ?? [])];
	return {
		valid: errors.length === 0,
		exportedAt: validation.exportedAt,
		counts: validation.counts,
		current,
		warnings: [...validation.warnings, ...(extra.warnings ?? [])],
		errors
	};
}

/**
 * Prévisualisation : résume le fichier, le compare à la base actuelle et le teste pour de bon dans une
 * transaction annulée (la base reste intacte, même en cas d'erreur).
 */
export async function previewRestore(payload: unknown): Promise<RestorePreview> {
	const validation = validateExport(payload);
	const specs = await activeTables(db());
	const current = await currentCounts(specs);
	if (validation.errors.length) return previewOf(validation, current);

	const client = await db().connect();
	try {
		await client.query('BEGIN');
		const outcome = await replaceAll(client, validation, payload, specs, false);
		return previewOf(validation, current, { warnings: outcome.warnings });
	} catch (e) {
		return previewOf(validation, current, { errors: [`La base refuse ce fichier : ${(e as Error).message}`] });
	} finally {
		await client.query('ROLLBACK').catch(() => {});
		client.release();
	}
}

// --- Sauvegardes ---------------------------------------------------------------

interface SafetyEntry {
	key: string;
	at: string;
	bytes: number;
}

function stampParis(date: Date): string {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: TIMEZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(date);
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
	return `${get('year')}-${get('month')}-${get('day')}-${get('hour')}${get('minute')}${get('second')}`;
}

/** Écrit l'état actuel sous backups/avant-restauration-… (hors rotation des sauvegardes hebdomadaires). */
async function safetyBackup(now = new Date()): Promise<SafetyEntry> {
	const key = `backups/avant-restauration-${stampParis(now)}.json`;
	const body = new TextEncoder().encode(JSON.stringify(await exportAll()));
	await putObject(key, body, 'application/json');
	const entry: SafetyEntry = { key, at: now.toISOString(), bytes: body.byteLength };
	const index = ((await readState<SafetyEntry[]>(SAFETY_INDEX)) ?? []).filter((e) => e.key !== key);
	index.push(entry);
	const removed = index.splice(0, Math.max(0, index.length - SAFETY_KEEP));
	await Promise.allSettled(removed.map((e) => deleteObject(e.key)));
	await writeState(SAFETY_INDEX, index);
	return entry;
}

/** Sauvegardes disponibles côté serveur : hebdomadaires puis de sécurité, la plus récente d'abord. */
export async function listBackups(): Promise<BackupListItem[]> {
	const weekly = (await readState<string[]>(WEEKLY_KEYS)) ?? [];
	const last = await readState<{ at: string; key: string; bytes: number }>(LAST_BACKUP);
	const items: BackupListItem[] = weekly.map((key) => {
		const day = /aquarium-(\d{4}-\d{2}-\d{2})\.json$/.exec(key)?.[1];
		return {
			key,
			at: last?.key === key ? last.at : day ? `${day}T02:10:00.000Z` : null,
			bytes: last?.key === key ? last.bytes : null,
			kind: 'hebdo'
		};
	});
	const safety = (await readState<SafetyEntry[]>(SAFETY_INDEX)) ?? [];
	for (const e of safety) items.push({ key: e.key, at: e.at, bytes: e.bytes, kind: 'avant-restauration' });
	return items.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
}

/** Applique la restauration. Lève une erreur HTTP 400 si le fichier est refusé ; la base reste alors intacte. */
export async function applyRestore(payload: unknown): Promise<RestoreResult> {
	const validation = validateExport(payload);
	if (validation.errors.length) error(400, validation.errors.join(' '));
	const specs = await activeTables(db());

	// Filet de sécurité : sans lui, on ne touche à rien.
	let safety: SafetyEntry;
	try {
		safety = await safetyBackup();
	} catch (e) {
		error(502, `Restauration annulée : la sauvegarde de sécurité a échoué (${(e as Error).message}).`);
	}

	const client = await db().connect();
	try {
		await client.query('BEGIN');
		const outcome = await replaceAll(client, validation, payload, specs, true);
		await client.query('COMMIT');
		return { ok: true, counts: outcome.counts, safetyBackup: safety.key };
	} catch (e) {
		await client.query('ROLLBACK').catch(() => {});
		error(400, `La base refuse ce fichier, rien n'a été modifié : ${(e as Error).message}`);
	} finally {
		client.release();
	}
}

/** Lit une sauvegarde du dossier backups/ ; erreur 400/404 en français sinon. */
export async function readBackup(key: unknown): Promise<unknown> {
	if (typeof key !== 'string' || !BACKUP_KEY.test(key) || key.includes('..')) error(400, 'Sauvegarde inconnue');
	const bytes = await getObject(key);
	if (!bytes) error(404, 'Cette sauvegarde est introuvable dans le stockage');
	try {
		return JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		error(400, "Cette sauvegarde n'est pas lisible (JSON invalide)");
	}
}

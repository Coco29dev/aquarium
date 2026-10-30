import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import { db } from './db';
import { deleteObject } from './storage';
import { PARAMETER_TEMPLATES } from '$lib/templates';
import { dayInParis } from '$lib/domain/dates';
import { nextDueAfter } from '$lib/domain/tasks';
import type { Aquarium, Measurement, Parameter, Snapshot, SyncOp, Task, WaterType } from '$lib/types';

const SNAPSHOT_DAYS = 120;

const aquariumSql = `id, name, water_type AS "waterType", volume_l AS "volumeL", started_on AS "startedOn"`;
const parameterSql = `id, aquarium_id AS "aquariumId", key, name, unit, min_value AS "min", max_value AS "max",
	drift_per_week AS "driftPerWeek", decimals, step, position`;
const taskSql = `id, aquarium_id AS "aquariumId", title, kind, every_days AS "everyDays",
	next_due AS "nextDue", active`;

export async function loadSnapshot(): Promise<Snapshot> {
	const [aquariums, parameters, measurements, tasks] = await Promise.all([
		db().query<Aquarium>(`SELECT ${aquariumSql} FROM aquariums ORDER BY id`),
		db().query<Parameter>(`SELECT ${parameterSql} FROM parameter_defs ORDER BY aquarium_id, position, id`),
		db().query<Measurement>(
			`SELECT parameter_id AS "parameterId", aquarium_id AS "aquariumId", value,
			        to_char(measured_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "measuredAt"
			 FROM measurements
			 WHERE measured_at >= now() - ($1 || ' days')::interval
			 ORDER BY measured_at`,
			[String(SNAPSHOT_DAYS)]
		),
		db().query<Task>(`SELECT ${taskSql} FROM recurring_tasks ORDER BY aquarium_id, id`)
	]);
	return {
		generatedAt: new Date().toISOString(),
		aquariums: aquariums.rows,
		parameters: parameters.rows,
		measurements: measurements.rows,
		tasks: tasks.rows
	};
}

// --- Aquariums -------------------------------------------------------------

export async function createAquarium(input: {
	name: string;
	waterType: WaterType;
	volumeL: number | null;
	startedOn: string | null;
}): Promise<number> {
	const client = await db().connect();
	try {
		await client.query('BEGIN');
		const { rows } = await client.query<{ id: number }>(
			`INSERT INTO aquariums (name, water_type, volume_l, started_on) VALUES ($1, $2, $3, $4) RETURNING id`,
			[input.name, input.waterType, input.volumeL, input.startedOn]
		);
		const id = rows[0].id;
		const templates = PARAMETER_TEMPLATES[input.waterType];
		for (const [position, p] of templates.entries()) {
			await client.query(
				`INSERT INTO parameter_defs
				 (aquarium_id, key, name, unit, min_value, max_value, drift_per_week, decimals, step, position)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
				[id, p.key, p.name, p.unit, p.min, p.max, p.driftPerWeek, p.decimals, p.step, position]
			);
		}
		await client.query('COMMIT');
		return id;
	} catch (e) {
		await client.query('ROLLBACK');
		throw e;
	} finally {
		client.release();
	}
}

export async function updateAquarium(
	id: number,
	input: { name?: string; volumeL?: number | null; startedOn?: string | null }
): Promise<void> {
	const { rowCount } = await db().query(
		`UPDATE aquariums SET
			name = COALESCE($2, name),
			volume_l = CASE WHEN $3::boolean THEN $4 ELSE volume_l END,
			started_on = CASE WHEN $5::boolean THEN $6 ELSE started_on END
		 WHERE id = $1`,
		[
			id,
			input.name ?? null,
			input.volumeL !== undefined,
			input.volumeL ?? null,
			input.startedOn !== undefined,
			input.startedOn ?? null
		]
	);
	if (!rowCount) error(404, 'Aquarium introuvable');
}

export async function deleteAquarium(id: number): Promise<void> {
	// Les lignes photos partent en cascade ; les fichiers du stockage sont à supprimer à la main.
	const { rows } = await db().query<{ storage_key: string }>('SELECT storage_key FROM photos WHERE aquarium_id = $1', [id]);
	await db().query('DELETE FROM aquariums WHERE id = $1', [id]);
	await Promise.allSettled(rows.map((r) => deleteObject(r.storage_key)));
}

// --- Paramètres ------------------------------------------------------------

export interface ParameterInput {
	name?: string;
	unit?: string;
	min?: number | null;
	max?: number | null;
	driftPerWeek?: number | null;
	decimals?: number | null;
	step?: number | null;
}

export async function addParameter(aquariumId: number, input: ParameterInput): Promise<number> {
	const { rows } = await db().query<{ id: number }>(
		`INSERT INTO parameter_defs
		 (aquarium_id, name, unit, min_value, max_value, drift_per_week, decimals, step, position)
		 VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 1), COALESCE($8, 0.1),
		         (SELECT COALESCE(MAX(position) + 1, 0) FROM parameter_defs WHERE aquarium_id = $1))
		 RETURNING id`,
		[
			aquariumId,
			input.name,
			input.unit ?? '',
			input.min ?? null,
			input.max ?? null,
			input.driftPerWeek ?? null,
			input.decimals ?? null,
			input.step ?? null
		]
	);
	return rows[0].id;
}

export async function updateParameter(id: number, input: ParameterInput): Promise<void> {
	const has = (k: keyof ParameterInput) => input[k] !== undefined;
	const { rowCount } = await db().query(
		`UPDATE parameter_defs SET
			name = COALESCE($2, name),
			unit = COALESCE($3, unit),
			min_value = CASE WHEN $4::boolean THEN $5 ELSE min_value END,
			max_value = CASE WHEN $6::boolean THEN $7 ELSE max_value END,
			drift_per_week = CASE WHEN $8::boolean THEN $9 ELSE drift_per_week END,
			decimals = COALESCE($10, decimals),
			step = COALESCE($11, step)
		 WHERE id = $1`,
		[
			id,
			input.name ?? null,
			input.unit ?? null,
			has('min'),
			input.min ?? null,
			has('max'),
			input.max ?? null,
			has('driftPerWeek'),
			input.driftPerWeek ?? null,
			input.decimals ?? null,
			input.step ?? null
		]
	);
	if (!rowCount) error(404, 'Paramètre introuvable');
}

export async function deleteParameter(id: number): Promise<void> {
	await db().query('DELETE FROM parameter_defs WHERE id = $1', [id]);
}

// --- Tâches ----------------------------------------------------------------

export async function addTask(
	aquariumId: number,
	input: { title: string; kind: string; everyDays: number; nextDue: string | null }
): Promise<number> {
	const { rows } = await db().query<{ id: number }>(
		`INSERT INTO recurring_tasks (aquarium_id, title, kind, every_days, next_due)
		 VALUES ($1, $2, $3, $4, COALESCE($5::date, $6::date)) RETURNING id`,
		[aquariumId, input.title, input.kind, input.everyDays, input.nextDue, dayInParis()]
	);
	return rows[0].id;
}

export async function updateTask(
	id: number,
	input: { title?: string; kind?: string; everyDays?: number; nextDue?: string | null; active?: boolean }
): Promise<void> {
	const { rowCount } = await db().query(
		`UPDATE recurring_tasks SET
			title = COALESCE($2, title),
			kind = COALESCE($3, kind),
			every_days = COALESCE($4, every_days),
			next_due = COALESCE($5::date, next_due),
			active = COALESCE($6, active)
		 WHERE id = $1`,
		[id, input.title ?? null, input.kind ?? null, input.everyDays ?? null, input.nextDue ?? null, input.active ?? null]
	);
	if (!rowCount) error(404, 'Tâche introuvable');
}

export async function deleteTask(id: number): Promise<void> {
	await db().query('DELETE FROM recurring_tasks WHERE id = $1', [id]);
}

// --- Synchronisation (saisies hors ligne) ----------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseOps(value: unknown): SyncOp[] {
	if (!Array.isArray(value) || value.length > 500) error(400, 'Opérations invalides');
	return value.map((raw): SyncOp => {
		const op = raw as Record<string, unknown>;
		if (typeof op.clientId !== 'string' || !UUID.test(op.clientId)) error(400, 'clientId invalide');
		const when = (v: unknown) => {
			if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) error(400, 'Date invalide');
			return new Date(v).toISOString();
		};
		if (op.type === 'measurement') {
			if (typeof op.value !== 'number' || !Number.isFinite(op.value)) error(400, 'Valeur invalide');
			return {
				type: 'measurement',
				clientId: op.clientId,
				aquariumId: Number(op.aquariumId),
				parameterId: Number(op.parameterId),
				value: op.value,
				measuredAt: when(op.measuredAt)
			};
		}
		if (op.type === 'completion') {
			return {
				type: 'completion',
				clientId: op.clientId,
				taskId: Number(op.taskId),
				doneAt: when(op.doneAt),
				note: typeof op.note === 'string' ? op.note.slice(0, 500) : undefined
			};
		}
		error(400, "Type d'opération inconnu");
	});
}

/**
 * Applique les opérations. Idempotent grâce à client_id : un renvoi après coupure réseau
 * ne crée pas de doublon. Les opérations dont la cible a disparu sont ignorées.
 */
export async function applyOps(ops: SyncOp[]): Promise<void> {
	const client = await db().connect();
	try {
		await client.query('BEGIN');
		for (const op of ops) {
			if (op.type === 'measurement') {
				await client.query(
					`INSERT INTO measurements (aquarium_id, parameter_id, value, measured_at, client_id)
					 SELECT p.aquarium_id, p.id, $2, $3, $4 FROM parameter_defs p WHERE p.id = $1
					 ON CONFLICT (client_id) DO NOTHING`,
					[op.parameterId, op.value, op.measuredAt, op.clientId]
				);
			} else {
				const inserted = await client.query(
					`INSERT INTO task_completions (task_id, done_at, note, client_id)
					 SELECT t.id, $2, $3, $4 FROM recurring_tasks t WHERE t.id = $1
					 ON CONFLICT (client_id) DO NOTHING`,
					[op.taskId, op.doneAt, op.note ?? null, op.clientId]
				);
				if (inserted.rowCount) {
					// Ne jamais reculer l'échéance si une réalisation plus ancienne arrive en retard.
					await client.query(
						`UPDATE recurring_tasks SET next_due = GREATEST(next_due, $2::date) WHERE id = $1`,
						[op.taskId, nextDueAfter(op.doneAt, await everyDays(client, op.taskId))]
					);
				}
			}
		}
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		throw e;
	} finally {
		client.release();
	}
}

async function everyDays(client: PoolClient, taskId: number): Promise<number> {
	const { rows } = await client.query<{ every_days: number }>(
		'SELECT every_days FROM recurring_tasks WHERE id = $1',
		[taskId]
	);
	return rows[0]?.every_days ?? 1;
}

// --- Export ----------------------------------------------------------------

export async function exportAll() {
	const [aquariums, parameters, measurements, tasks, completions, inhabitants, equipment, consumables, expenses, notes, photos] =
		await Promise.all([
		db().query(`SELECT * FROM aquariums ORDER BY id`),
		db().query(`SELECT * FROM parameter_defs ORDER BY id`),
		db().query(`SELECT * FROM measurements ORDER BY measured_at`),
		db().query(`SELECT * FROM recurring_tasks ORDER BY id`),
		db().query(`SELECT * FROM task_completions ORDER BY done_at`),
		db().query(`SELECT * FROM inhabitants ORDER BY id`),
		db().query(`SELECT * FROM equipment ORDER BY id`),
		db().query(`SELECT * FROM consumables ORDER BY id`),
		db().query(`SELECT * FROM expenses ORDER BY spent_on, id`),
		db().query(`SELECT * FROM notes ORDER BY noted_on, id`),
		// Métadonnées seulement : les fichiers restent dans le stockage (voir /api/photos/<id>).
		db().query(`SELECT id, aquarium_id, storage_key, content_type, bytes, caption, taken_on FROM photos ORDER BY id`)
	]);
	return {
		exportedAt: new Date().toISOString(),
		aquariums: aquariums.rows,
		parameters: parameters.rows,
		measurements: measurements.rows,
		recurringTasks: tasks.rows,
		taskCompletions: completions.rows,
		inhabitants: inhabitants.rows,
		equipment: equipment.rows,
		consumables: consumables.rows,
		expenses: expenses.rows,
		notes: notes.rows,
		photos: photos.rows
	};
}

export async function exportMeasurementsCsv(): Promise<string> {
	const { rows } = await db().query<Record<string, unknown>>(
		`SELECT a.name AS aquarium, p.name AS parametre, p.unit AS unite, m.value AS valeur,
		        to_char(m.measured_at AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD HH24:MI') AS date_paris
		 FROM measurements m
		 JOIN parameter_defs p ON p.id = m.parameter_id
		 JOIN aquariums a ON a.id = m.aquarium_id
		 ORDER BY m.measured_at`
	);
	return toCsv(['aquarium', 'parametre', 'unite', 'valeur', 'date_paris'], rows);
}

export async function exportCompletionsCsv(): Promise<string> {
	const { rows } = await db().query<Record<string, unknown>>(
		`SELECT a.name AS aquarium, t.title AS tache,
		        to_char(c.done_at AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD HH24:MI') AS date_paris,
		        COALESCE(c.note, '') AS note
		 FROM task_completions c
		 JOIN recurring_tasks t ON t.id = c.task_id
		 JOIN aquariums a ON a.id = t.aquarium_id
		 ORDER BY c.done_at`
	);
	return toCsv(['aquarium', 'tache', 'date_paris', 'note'], rows);
}

export async function exportExpensesCsv(): Promise<string> {
	const { rows } = await db().query<Record<string, unknown>>(
		`SELECT COALESCE(a.name, '') AS aquarium, e.label AS libelle, e.category AS categorie,
		        e.amount AS montant_eur, e.spent_on::text AS date
		 FROM expenses e LEFT JOIN aquariums a ON a.id = e.aquarium_id
		 ORDER BY e.spent_on, e.id`
	);
	return toCsv(['aquarium', 'libelle', 'categorie', 'montant_eur', 'date'], rows);
}

function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
	const cell = (v: unknown) => {
		const s = String(v ?? '');
		// Neutralise l'injection de formules à l'ouverture dans un tableur.
		const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
		return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
	};
	return [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n') + '\n';
}

import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import { db } from './db';

// Restauration d'un export JSON (voir exportAll). Remplace toutes les données personnelles dans une
// transaction : en cas d'erreur, rien ne change. Les noms de tables viennent de cette liste fixe ;
// les colonnes viennent de information_schema (jamais du fichier), donc pas d'injection SQL.
//
// Limites assumées : les fichiers photo restent dans le stockage (seules leurs fiches sont rétablies) ;
// seules les espèces « maison » sont dans l'export (les autres sont rechargées au démarrage).

/** Ordre d'insertion : les parents avant les enfants. */
const TABLES: { key: string; table: string }[] = [
	{ key: 'aquariums', table: 'aquariums' },
	{ key: 'parameters', table: 'parameter_defs' },
	{ key: 'measurements', table: 'measurements' },
	{ key: 'recurringTasks', table: 'recurring_tasks' },
	{ key: 'taskCompletions', table: 'task_completions' },
	{ key: 'inhabitants', table: 'inhabitants' },
	{ key: 'equipment', table: 'equipment' },
	{ key: 'consumables', table: 'consumables' },
	{ key: 'consumableReplacements', table: 'consumable_replacements' },
	{ key: 'expenses', table: 'expenses' },
	{ key: 'notes', table: 'notes' },
	{ key: 'photos', table: 'photos' }
];

/** Réglages d'app_state rétablis (le reste, comme l'état des rappels, se reconstruit seul). */
const STATE_KEYS = ['notification_settings'];

export interface RestoreSummary {
	[key: string]: number;
}

type Row = Record<string, unknown>;

function rowsOf(data: Row, key: string, required = false): Row[] {
	const value = data[key];
	if (value === undefined && !required) return [];
	if (!Array.isArray(value) || value.length > 500_000) error(400, `Export invalide : « ${key} » attendu`);
	if (!value.every((r) => r && typeof r === 'object' && !Array.isArray(r))) error(400, `Export invalide : « ${key} »`);
	return value as Row[];
}

async function columnsOf(client: PoolClient, table: string): Promise<Set<string>> {
	const { rows } = await client.query<{ column_name: string }>(
		`SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1`,
		[table]
	);
	return new Set(rows.map((r) => r.column_name));
}

/** Insère les lignes en une requête ; seules les colonnes présentes dans le fichier et dans la table comptent. */
async function insertRows(client: PoolClient, table: string, rows: Row[]): Promise<number> {
	if (!rows.length) return 0;
	const known = await columnsOf(client, table);
	const columns = Object.keys(rows[0]).filter((c) => known.has(c));
	if (!columns.length) error(400, `Export invalide : colonnes inconnues pour ${table}`);
	const list = columns.map((c) => `"${c}"`).join(', ');
	const CHUNK = 5000;
	for (let from = 0; from < rows.length; from += CHUNK) {
		await client.query(
			`INSERT INTO ${table} (${list})
			 SELECT ${list} FROM jsonb_populate_recordset(null::${table}, $1::jsonb)`,
			[JSON.stringify(rows.slice(from, from + CHUNK))]
		);
	}
	return rows.length;
}

export async function restoreAll(data: unknown): Promise<RestoreSummary> {
	if (!data || typeof data !== 'object' || Array.isArray(data)) error(400, 'Export invalide');
	const payload = data as Row;
	if (typeof payload.exportedAt !== 'string') error(400, 'Ce fichier n’est pas un export de l’appli');
	rowsOf(payload, 'aquariums', true);

	const client = await db().connect();
	const summary: RestoreSummary = {};
	try {
		await client.query('BEGIN');

		// 1. Vider (enfants d'abord).
		for (const { table } of [...TABLES].reverse()) await client.query(`DELETE FROM ${table}`);
		await client.query(`DELETE FROM species WHERE source = 'maison'`);

		// 2. Espèces « maison » : nouveaux identifiants (ceux de l'export peuvent déjà servir à des espèces importées).
		const speciesMap = new Map<number, number>();
		const speciesColumns = [...(await columnsOf(client, 'species'))].filter((c) => c !== 'id');
		for (const row of rowsOf(payload, 'species')) {
			const columns = speciesColumns.filter((c) => c in row);
			const list = columns.map((c) => `"${c}"`).join(', ');
			const { rows } = await client.query<{ id: number }>(
				`INSERT INTO species (${list}) SELECT ${list} FROM jsonb_populate_record(null::species, $1::jsonb) RETURNING id`,
				[JSON.stringify({ ...row, source: 'maison' })]
			);
			if (typeof row.id === 'number') speciesMap.set(row.id, rows[0].id);
			summary.species = (summary.species ?? 0) + 1;
		}
		const known = new Set((await client.query<{ id: number }>('SELECT id FROM species')).rows.map((r) => r.id));

		// 3. Tables métier.
		for (const { key, table } of TABLES) {
			let rows = rowsOf(payload, key);
			if (table === 'aquariums') rows = rows.map((r) => ({ ...r, cover_photo_id: null }));
			if (table === 'inhabitants') {
				rows = rows.map((r) => {
					const id = typeof r.species_id === 'number' ? (speciesMap.get(r.species_id) ?? r.species_id) : null;
					return { ...r, species_id: id != null && known.has(id) ? id : null };
				});
			}
			summary[key] = await insertRows(client, table, rows);
		}

		// 4. Photo de couverture (après les photos) et réglages.
		const covers = rowsOf(payload, 'aquariums')
			.filter((r) => typeof r.cover_photo_id === 'number')
			.map((r) => ({ id: r.id, cover_photo_id: r.cover_photo_id }));
		if (covers.length) {
			await client.query(
				`UPDATE aquariums a SET cover_photo_id = x.cover_photo_id
				 FROM jsonb_to_recordset($1::jsonb) AS x(id int, cover_photo_id int)
				 WHERE a.id = x.id AND EXISTS (SELECT 1 FROM photos p WHERE p.id = x.cover_photo_id)`,
				[JSON.stringify(covers)]
			);
		}
		for (const row of rowsOf(payload, 'appState')) {
			if (typeof row.key !== 'string' || typeof row.value !== 'string' || !STATE_KEYS.includes(row.key)) continue;
			await client.query(
				`INSERT INTO app_state (key, value) VALUES ($1, $2)
				 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
				[row.key, row.value]
			);
		}

		// 5. Les identifiants ont été fournis : recaler les compteurs pour que les prochains ne collisionnent pas.
		for (const { table } of TABLES) {
			await client.query(
				`SELECT setval(pg_get_serial_sequence('${table}', 'id'), GREATEST(COALESCE(MAX(id), 0), 1), COUNT(*) > 0) FROM ${table}`
			);
		}
		await client.query('COMMIT');
		return summary;
	} catch (e) {
		await client.query('ROLLBACK');
		if ((e as { status?: number }).status) throw e;
		error(400, `Restauration impossible : ${(e as Error).message}`);
	} finally {
		client.release();
	}
}

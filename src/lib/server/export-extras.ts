import { db } from './db';
import { EXPORTED_STATE_KEYS, RESTORE_TABLES } from './tables';

// Parties de l'export JSON qui ne sont pas lues directement dans exportAll (data.ts) : tables ajoutées
// après coup et réglages applicatifs. Piloté par RESTORE_TABLES : une nouvelle table y est ajoutée une fois.

const CORE_KEYS = new Set([
	'aquariums',
	'parameters',
	'measurements',
	'recurringTasks',
	'taskCompletions',
	'inhabitants',
	'equipment',
	'consumables',
	'expenses',
	'notes',
	'photos',
	'events'
]);

async function tableExists(table: string): Promise<boolean> {
	const { rows } = await db().query<{ ok: boolean }>('SELECT to_regclass($1) IS NOT NULL AS ok', [`public.${table}`]);
	return Boolean(rows[0]?.ok);
}

export async function exportExtras(): Promise<Record<string, unknown>> {
	const out: Record<string, unknown> = {};
	for (const spec of RESTORE_TABLES) {
		if (CORE_KEYS.has(spec.key)) continue;
		if (spec.optionalTable && !(await tableExists(spec.table))) continue;
		const { rows } = await db().query(`SELECT * FROM "${spec.table}" ORDER BY id`);
		out[spec.key] = rows;
	}
	const appState: Record<string, unknown> = {};
	for (const key of EXPORTED_STATE_KEYS) {
		const { rows } = await db().query<{ value: string }>('SELECT value FROM app_state WHERE key = $1', [key]);
		if (rows[0]) {
			try {
				appState[key] = JSON.parse(rows[0].value);
			} catch {
				// Valeur illisible : on ne l'exporte pas.
			}
		}
	}
	out.appState = appState;
	return out;
}

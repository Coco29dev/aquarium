import { error } from '@sveltejs/kit';
import { db } from './db';

// CRUD déclaratif pour l'inventaire, les dépenses et les notes. Les noms de tables et de colonnes
// viennent uniquement de cette configuration (jamais de la requête) : pas d'injection SQL possible.

type FieldType = 'text' | 'int' | 'number' | 'date' | 'enum';

interface Field {
	column: string;
	type: FieldType;
	required?: boolean;
	values?: string[];
	max?: number;
}

export interface Resource {
	table: string;
	/** Colonne de rattachement (aquarium_id), ou parent_column pour les sous-ressources. */
	scopeColumn: string;
	/** Autorise scope null (dépenses sans aquarium). */
	scopeOptional?: boolean;
	fields: Record<string, Field>;
	orderBy: string;
}

const text = (column: string, required = false, max = 200): Field => ({ column, type: 'text', required, max });
const date = (column: string): Field => ({ column, type: 'date' });

export const RESOURCES: Record<string, Resource> = {
	inhabitants: {
		table: 'inhabitants',
		scopeColumn: 'aquarium_id',
		orderBy: 'kind, species',
		fields: {
			kind: { column: 'kind', type: 'enum', required: true, values: ['faune', 'flore'] },
			species: text('species', true),
			quantity: { column: 'quantity', type: 'int' },
			arrivedOn: date('arrived_on'),
			leftOn: date('left_on'),
			notes: text('notes', false, 1000)
		}
	},
	equipment: {
		table: 'equipment',
		scopeColumn: 'aquarium_id',
		orderBy: 'name',
		fields: {
			name: text('name', true),
			category: text('category'),
			purchasedOn: date('purchased_on'),
			price: { column: 'price', type: 'number' },
			warrantyUntil: date('warranty_until'),
			notes: text('notes', false, 1000)
		}
	},
	consumables: {
		table: 'consumables',
		scopeColumn: 'equipment_id',
		orderBy: 'name',
		fields: {
			name: text('name', true),
			installedOn: date('installed_on'),
			replaceEveryDays: { column: 'replace_every_days', type: 'int' },
			notes: text('notes', false, 1000)
		}
	},
	expenses: {
		table: 'expenses',
		scopeColumn: 'aquarium_id',
		scopeOptional: true,
		orderBy: 'spent_on DESC, id DESC',
		fields: {
			label: text('label', true),
			category: text('category'),
			amount: { column: 'amount', type: 'number', required: true },
			spentOn: date('spent_on')
		}
	},
	notes: {
		table: 'notes',
		scopeColumn: 'aquarium_id',
		orderBy: 'noted_on DESC, id DESC',
		fields: {
			body: text('body', true, 4000),
			notedOn: date('noted_on')
		}
	}
};

export function resourceOf(name: string): Resource {
	const resource = RESOURCES[name];
	if (!resource) error(404, 'Ressource inconnue');
	return resource;
}

const camelSelect = (r: Resource) =>
	['id', `${r.scopeColumn} AS "scopeId"`, ...Object.entries(r.fields).map(([key, f]) => `${f.column} AS "${key}"`)].join(
		', '
	);

type Body = Record<string, unknown>;

/** Valide les champs présents dans `body` ; pour une création, vérifie aussi les champs requis. */
function parse(resource: Resource, body: Body, creating: boolean): Map<string, unknown> {
	const out = new Map<string, unknown>();
	for (const [key, field] of Object.entries(resource.fields)) {
		const present = key in body;
		const raw = body[key];
		const empty = raw === undefined || raw === null || raw === '';
		if (!present || empty) {
			if (creating && field.required && empty) error(400, `Champ requis : ${key}`);
			if (present && !field.required) out.set(field.column, null);
			continue;
		}
		switch (field.type) {
			case 'text':
				if (typeof raw !== 'string' || raw.length > (field.max ?? 200)) error(400, `Champ invalide : ${key}`);
				out.set(field.column, raw.trim());
				break;
			case 'enum':
				if (typeof raw !== 'string' || !field.values?.includes(raw)) error(400, `Champ invalide : ${key}`);
				out.set(field.column, raw);
				break;
			case 'int':
				if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > 1_000_000) {
					error(400, `Champ invalide : ${key}`);
				}
				out.set(field.column, raw);
				break;
			case 'number':
				if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > 1e9) error(400, `Champ invalide : ${key}`);
				out.set(field.column, raw);
				break;
			case 'date':
				if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) error(400, `Date invalide : ${key}`);
				out.set(field.column, raw);
				break;
		}
	}
	return out;
}

export async function listResource(name: string, scopeId: number | null) {
	const r = resourceOf(name);
	const where = scopeId === null ? '' : `WHERE ${r.scopeColumn} = $1`;
	const { rows } = await db().query(
		`SELECT ${camelSelect(r)} FROM ${r.table} ${where} ORDER BY ${r.orderBy}`,
		scopeId === null ? [] : [scopeId]
	);
	return rows;
}

export async function createResource(name: string, scopeId: number | null, body: Body): Promise<number> {
	const r = resourceOf(name);
	if (scopeId === null && !r.scopeOptional) error(400, 'Rattachement requis');
	const values = parse(r, body, true);
	const columns = [r.scopeColumn, ...values.keys()];
	const params = [scopeId, ...values.values()];
	const { rows } = await db().query<{ id: number }>(
		`INSERT INTO ${r.table} (${columns.join(', ')})
		 VALUES (${params.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
		params
	);
	return rows[0].id;
}

export async function updateResource(name: string, id: number, body: Body): Promise<void> {
	const r = resourceOf(name);
	const values = parse(r, body, false);
	if (values.size === 0) return;
	const sets = [...values.keys()].map((column, i) => `${column} = $${i + 2}`);
	const { rowCount } = await db().query(`UPDATE ${r.table} SET ${sets.join(', ')} WHERE id = $1`, [id, ...values.values()]);
	if (!rowCount) error(404, 'Introuvable');
}

export async function deleteResource(name: string, id: number): Promise<void> {
	const r = resourceOf(name);
	await db().query(`DELETE FROM ${r.table} WHERE id = $1`, [id]);
}

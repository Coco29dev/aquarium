import { EXPORT_META_KEYS, RESTORE_TABLES, type TableSpec } from './tables';

// Validation d'un export JSON avant restauration. Pur (pas d'accès base) : les contraintes que seule
// la base peut juger (types, CHECK, unicité) sont vérifiées ensuite par un essai annulé (restore.ts).

export interface ValidationResult {
	errors: string[];
	warnings: string[];
	/** Nombre de lignes par clé d'export. */
	counts: Record<string, number>;
	/** Lignes par clé d'export (vide si le fichier est invalide). */
	rows: Record<string, Record<string, unknown>[]>;
	exportedAt: string | null;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

export function validateExport(payload: unknown): ValidationResult {
	const result: ValidationResult = { errors: [], warnings: [], counts: {}, rows: {}, exportedAt: null };
	if (!isPlainObject(payload)) {
		result.errors.push("Ce fichier n'est pas une sauvegarde Aquarium (un objet JSON est attendu).");
		return result;
	}
	if (!Array.isArray(payload.aquariums)) {
		result.errors.push("Ce fichier ne ressemble pas à une sauvegarde Aquarium : la liste des aquariums manque.");
		return result;
	}

	if (typeof payload.exportedAt === 'string' && !Number.isNaN(Date.parse(payload.exportedAt))) {
		result.exportedAt = new Date(payload.exportedAt).toISOString();
	} else {
		result.warnings.push("La date d'export est absente ou illisible.");
	}

	const known = new Set<string>([...EXPORT_META_KEYS, ...RESTORE_TABLES.map((t) => t.key)]);
	for (const key of Object.keys(payload)) {
		if (!known.has(key)) result.warnings.push(`Donnée « ${key} » inconnue : ignorée.`);
	}

	// 1. Structure de chaque table.
	for (const spec of RESTORE_TABLES) {
		const raw = payload[spec.key];
		if (raw === undefined) {
			result.counts[spec.key] = 0;
			result.rows[spec.key] = [];
			if (spec.key !== 'aquariums') {
				result.warnings.push(`Absent de ce fichier (export plus ancien ?) : ${spec.label}. La table sera vidée.`);
			}
			continue;
		}
		if (!Array.isArray(raw)) {
			result.errors.push(`« ${spec.label} » doit être une liste.`);
			continue;
		}
		const rows: Record<string, unknown>[] = [];
		const seen = new Set<number>();
		let bad = 0;
		let duplicates = 0;
		for (const row of raw) {
			if (!isPlainObject(row) || !Number.isInteger(row.id) || (row.id as number) <= 0) {
				bad++;
				continue;
			}
			const id = row.id as number;
			if (seen.has(id)) duplicates++;
			seen.add(id);
			rows.push(row);
		}
		if (bad) result.errors.push(`${plural(bad, 'ligne')} de « ${spec.label} » sans identifiant valide.`);
		if (duplicates) result.errors.push(`${plural(duplicates, 'identifiant en double', 'identifiants en double')} dans « ${spec.label} ».`);
		result.counts[spec.key] = rows.length;
		result.rows[spec.key] = rows;
	}
	if (result.errors.length) return result;

	// 2. Références entre tables.
	const ids = new Map<string, Set<number>>();
	for (const spec of RESTORE_TABLES) ids.set(spec.key, new Set(result.rows[spec.key].map((r) => r.id as number)));

	const labelOf = (key: string) => RESTORE_TABLES.find((t) => t.key === key)?.label ?? key;
	for (const spec of RESTORE_TABLES) {
		for (const ref of spec.refs ?? []) {
			const target = ids.get(ref.to)!;
			const missing: number[] = [];
			for (const row of result.rows[spec.key]) {
				const value = row[ref.column];
				if (value === null || value === undefined) {
					if (!ref.nullable) missing.push(-1);
					continue;
				}
				if (!Number.isInteger(value) || !target.has(value as number)) missing.push(value as number);
			}
			if (missing.length) {
				const sample = missing.find((v) => v !== -1);
				result.errors.push(
					`${plural(missing.length, 'ligne')} de « ${spec.label} » pointe${missing.length > 1 ? 'nt' : ''} vers « ${labelOf(ref.to)} » absent${missing.length > 1 ? 's' : ''} du fichier${sample !== undefined ? ` (ex. id ${sample})` : ''}.`
				);
			}
		}
	}

	// Photo de couverture introuvable : l'aquarium est restauré sans couverture.
	const photoIds = ids.get('photos')!;
	const orphanCovers = result.rows.aquariums.filter((a) => a.cover_photo_id != null && !photoIds.has(a.cover_photo_id as number)).length;
	if (orphanCovers) result.warnings.push(`${plural(orphanCovers, 'photo de couverture introuvable', 'photos de couverture introuvables')} : retirée${orphanCovers > 1 ? 's' : ''}.`);

	if (result.counts.photos) {
		result.warnings.push(
			"Les métadonnées des photos sont restaurées, pas les fichiers : une photo dont le fichier n'est plus dans le stockage ne s'affichera pas."
		);
	}
	return result;
}

/** Valeur de l'état applicatif à restaurer (réglages de notifications), ou null. */
export function exportedState(payload: unknown, key: string): unknown | null {
	if (!isPlainObject(payload) || !isPlainObject(payload.appState)) return null;
	const value = payload.appState[key];
	return value === undefined ? null : value;
}

export type { TableSpec };

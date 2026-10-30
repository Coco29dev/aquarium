import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import { db } from './db';
import type { Species } from '$lib/types';

const SELECT = `id, source, scientific_name AS "scientificName", name_fr AS "nameFr", name_en AS "nameEn", kind,
	fresh, brackish, salt, max_length_cm AS "maxLengthCm", lifespan_years AS "lifespanYears",
	temp_min AS "tempMin", temp_max AS "tempMax", ph_min AS "phMin", ph_max AS "phMax",
	min_tank_l AS "minTankL", temperament, diet, zone, group_min AS "groupMin", reef_safe AS "reefSafe",
	bioload_g AS "bioloadG", notes, estimated, description, origin, difficulty, care, light, co2, curated, data_quality AS "dataQuality",
	(photo_key IS NOT NULL) AS "hasPhoto", photo_author AS "photoAuthor", photo_license AS "photoLicense",
	photo_source AS "photoSource"`;

// --- Amorçage depuis data/species.seed.json (FishBase / SeaLifeBase) ----------------------

/**
 * Charge ou met à jour les espèces importées quand la version du fichier change.
 * Les champs d'élevage saisis à la main ne sont jamais écrasés.
 */
export async function seedSpecies(): Promise<void> {
	let raw: string;
	try {
		raw = await readFile(path.resolve('data/species.seed.json'), 'utf8');
	} catch {
		console.warn('[espèces] data/species.seed.json absent : base d’espèces non amorcée');
		return;
	}
	const seed = JSON.parse(raw) as { version: string; columns: string[]; rows: unknown[][] };
	const done = await db().query<{ value: string }>(`SELECT value FROM app_state WHERE key = 'species_seed'`);
	if (done.rows[0]?.value === seed.version) return;

	const col = (name: string) => seed.rows.map((r) => r[seed.columns.indexOf(name)]);
	const BATCH = 1500;
	for (let from = 0; from < seed.rows.length; from += BATCH) {
		const slice = (name: string) => col(name).slice(from, from + BATCH);
		await db().query(
			`INSERT INTO species (source, source_code, scientific_name, name_fr, name_en, kind, fresh, brackish, salt,
			                      max_length_cm, lifespan_years, zone, diet, group_min, estimated)
			 SELECT t.source, t.code, t.sci, t.fr, t.en, t.kind, t.fresh = 1, t.brackish = 1, t.salt = 1,
			        t.len, t.life, t.zone, t.diet, t.grp,
			        array_remove(ARRAY[CASE WHEN t.zone IS NOT NULL THEN 'zone' END,
			                           CASE WHEN t.diet IS NOT NULL THEN 'diet' END,
			                           CASE WHEN t.grp IS NOT NULL THEN 'groupMin' END], NULL)
			 FROM unnest($1::text[], $2::int[], $3::text[], $4::text[], $5::text[], $6::text[], $7::int[], $8::int[], $9::int[],
			             $10::numeric[], $11::numeric[], $12::text[], $13::text[], $14::int[])
			      AS t(source, code, sci, fr, en, kind, fresh, brackish, salt, len, life, zone, diet, grp)
			 ON CONFLICT (source, source_code) WHERE source_code IS NOT NULL DO UPDATE SET
			   scientific_name = EXCLUDED.scientific_name,
			   name_fr = COALESCE(species.name_fr, EXCLUDED.name_fr),
			   name_en = COALESCE(species.name_en, EXCLUDED.name_en),
			   kind = EXCLUDED.kind, fresh = EXCLUDED.fresh, brackish = EXCLUDED.brackish, salt = EXCLUDED.salt,
			   max_length_cm = COALESCE(species.max_length_cm, EXCLUDED.max_length_cm),
			   lifespan_years = COALESCE(species.lifespan_years, EXCLUDED.lifespan_years)`,
			[
				slice('source'), slice('code'), slice('sci'), slice('fr'), slice('en'), slice('kind'),
				slice('fresh'), slice('brackish'), slice('salt'), slice('len'), slice('life'),
				slice('zone'), slice('diet'), slice('group')
			]
		);
	}
	await db().query(
		`INSERT INTO app_state (key, value) VALUES ('species_seed', $1)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
		[seed.version]
	);
	console.log(`[espèces] ${seed.rows.length} espèces importées (${seed.version})`);
}

// --- Lecture ---------------------------------------------------------------

export async function searchSpecies(opts: {
	q?: string;
	kind?: string;
	water?: string;
	ids?: number[];
	limit?: number;
	/** Inclut la base brute (espèces hors noyau). */
	all?: boolean;
}) {
	const where: string[] = [];
	const params: unknown[] = [];
	const add = (sql: string, value: unknown) => {
		params.push(value);
		where.push(sql.replace('?', `$${params.length}`));
	};
	if (opts.ids?.length) add('id = ANY(?::int[])', opts.ids);
	if (opts.q) {
		// Recherche sans accents ni casse : « ecrevisse » trouve « Écrevisse ».
		const plain = opts.q.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[%_\\]/g, '\\$&');
		params.push(`%${plain}%`);
		const n = params.length;
		const fold = (column: string) =>
			`translate(lower(coalesce(${column}, '')), 'àâäáãéèêëíìîïóòôöõúùûüýÿçñœ', 'aaaaaeeeeiiiiooooouuuuyycno')`;
		where.push(`(${fold('scientific_name')} ILIKE $${n} OR ${fold('name_fr')} ILIKE $${n} OR ${fold('name_en')} ILIKE $${n})`);
	}
	if (opts.kind) add('kind = ?', opts.kind);
	if (!opts.all && !opts.ids?.length) where.push('curated');
	if (opts.water === 'douce') where.push('fresh');
	if (opts.water === 'mer') where.push('salt');
	const limit = Math.min(opts.limit ?? 40, 200);
	const { rows } = await db().query<Species>(
		`SELECT ${SELECT} FROM species ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
		 ORDER BY curated DESC, (source = 'maison') DESC, (name_fr IS NOT NULL) DESC, (name_en IS NOT NULL) DESC, scientific_name
		 LIMIT ${limit}`,
		params
	);
	return rows;
}

// --- Écriture --------------------------------------------------------------

type Body = Record<string, unknown>;

interface FieldDef {
	column: string;
	type: 'text' | 'number' | 'int' | 'bool' | 'enum';
	values?: string[];
	/** Modifiable aussi sur les espèces importées. */
	husbandry?: boolean;
	max?: number;
}

const FIELDS: Record<string, FieldDef> = {
	scientificName: { column: 'scientific_name', type: 'text' },
	kind: { column: 'kind', type: 'enum', values: ['poisson', 'corail', 'invertebre', 'plante', 'autre'] },
	fresh: { column: 'fresh', type: 'bool' },
	brackish: { column: 'brackish', type: 'bool' },
	salt: { column: 'salt', type: 'bool' },
	lifespanYears: { column: 'lifespan_years', type: 'number' },
	nameFr: { column: 'name_fr', type: 'text', husbandry: true },
	nameEn: { column: 'name_en', type: 'text', husbandry: true },
	maxLengthCm: { column: 'max_length_cm', type: 'number', husbandry: true },
	tempMin: { column: 'temp_min', type: 'number', husbandry: true },
	tempMax: { column: 'temp_max', type: 'number', husbandry: true },
	phMin: { column: 'ph_min', type: 'number', husbandry: true },
	phMax: { column: 'ph_max', type: 'number', husbandry: true },
	minTankL: { column: 'min_tank_l', type: 'int', husbandry: true },
	temperament: { column: 'temperament', type: 'enum', values: ['paisible', 'semi-agressif', 'agressif'], husbandry: true },
	diet: { column: 'diet', type: 'enum', values: ['carnivore', 'omnivore', 'herbivore', 'filtreur', 'autre'], husbandry: true },
	zone: { column: 'zone', type: 'enum', values: ['haut', 'milieu', 'bas', 'tous'], husbandry: true },
	groupMin: { column: 'group_min', type: 'int', husbandry: true },
	reefSafe: { column: 'reef_safe', type: 'bool', husbandry: true },
	bioloadG: { column: 'bioload_g', type: 'number', husbandry: true },
	notes: { column: 'notes', type: 'text', husbandry: true, max: 2000 },
	description: { column: 'description', type: 'text', husbandry: true, max: 2000 },
	origin: { column: 'origin', type: 'text', husbandry: true, max: 200 },
	difficulty: { column: 'difficulty', type: 'int', husbandry: true },
	care: { column: 'care', type: 'text', husbandry: true, max: 2000 },
	light: { column: 'light', type: 'int', husbandry: true },
	co2: { column: 'co2', type: 'int', husbandry: true }
};

function parse(body: Body, allowed: (f: FieldDef) => boolean): Map<string, { column: string; value: unknown }> {
	const out = new Map<string, { column: string; value: unknown }>();
	for (const [key, field] of Object.entries(FIELDS)) {
		if (!(key in body) || !allowed(field)) continue;
		const raw = body[key];
		if (raw === null || raw === '') {
			out.set(key, { column: field.column, value: null });
			continue;
		}
		const bad = () => error(400, `Champ invalide : ${key}`);
		switch (field.type) {
			case 'text':
				if (typeof raw !== 'string' || raw.length > (field.max ?? 200)) bad();
				out.set(key, { column: field.column, value: (raw as string).trim() });
				break;
			case 'number':
				if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < -100 || raw > 100000) bad();
				out.set(key, { column: field.column, value: raw });
				break;
			case 'int':
				if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > 1_000_000) bad();
				out.set(key, { column: field.column, value: raw });
				break;
			case 'bool':
				if (typeof raw !== 'boolean') bad();
				out.set(key, { column: field.column, value: raw });
				break;
			case 'enum':
				if (typeof raw !== 'string' || !field.values?.includes(raw)) bad();
				out.set(key, { column: field.column, value: raw });
				break;
		}
	}
	return out;
}

export async function createSpecies(body: Body): Promise<number> {
	const values = parse(body, () => true);
	if (!values.get('scientificName')?.value) error(400, 'Nom requis');
	if (!values.has('kind')) values.set('kind', { column: 'kind', value: 'poisson' });
	const entries = [...values.values()];
	const { rows } = await db().query<{ id: number }>(
		`INSERT INTO species (source, curated, ${entries.map((e) => e.column).join(', ')})
		 VALUES ('maison', true, ${entries.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
		entries.map((e) => e.value)
	);
	return rows[0].id;
}

export async function updateSpecies(id: number, body: Body): Promise<void> {
	const current = await db().query<{ source: string }>('SELECT source FROM species WHERE id = $1', [id]);
	if (!current.rows[0]) error(404, 'Espèce introuvable');
	const isHome = current.rows[0].source === 'maison' || current.rows[0].source === 'noyau';
	const values = parse(body, (f) => isHome || f.husbandry === true);
	if (body.verified === true) {
		await db().query(`UPDATE species SET data_quality = 'verifie' WHERE id = $1`, [id]);
	}
	if (values.size === 0) return;
	const sets = [...values.values()].map((e, i) => `${e.column} = $${i + 2}`);
	// Un champ « estimé » modifié à la main devient confirmé.
	const confirmed = [...values.keys()].filter((k) => k === 'zone' || k === 'diet' || k === 'groupMin');
	await db().query(
		`UPDATE species SET ${sets.join(', ')},
		   estimated = ARRAY(SELECT e FROM unnest(estimated) e WHERE e <> ALL($${sets.length + 2}::text[])),
		   locked = ARRAY(SELECT DISTINCT l FROM unnest(locked || $${sets.length + 3}::text[]) l)
		 WHERE id = $1`,
		[id, ...[...values.values()].map((e) => e.value), confirmed, [...values.keys()]]
	);
}

export async function deleteSpecies(id: number): Promise<void> {
	const { rowCount } = await db().query(`DELETE FROM species WHERE id = $1 AND source = 'maison'`, [id]);
	if (!rowCount) error(400, 'Seules les espèces ajoutées à la main peuvent être supprimées');
}

// --- Noyau encyclopédique (data/core/*.jsonl) ---------------------------------------------

interface CoreEntry {
	s: string; // nom scientifique
	fr?: string;
	en?: string;
	k: 'poisson' | 'corail' | 'invertebre' | 'plante';
	w: 'd' | 'm' | 'sd'; // douce, mer, douce + saumâtre
	L?: number; // taille adulte (cm) ; hauteur pour une plante
	v?: number; // durée de vie (ans)
	t?: [number, number]; // température °C
	p?: [number, number]; // pH
	b?: number; // volume minimal (L)
	m?: 'paisible' | 'semi-agressif' | 'agressif';
	r?: 'carnivore' | 'omnivore' | 'herbivore' | 'filtreur' | 'autre';
	z?: 'haut' | 'milieu' | 'bas' | 'tous';
	g?: number; // groupe minimal
	rf?: boolean; // compatible récif
	d?: string; // description
	o?: string; // provenance et milieu naturel
	n?: 1 | 2 | 3; // difficulté d'entretien
	c?: string; // conseils d'entretien
	lt?: 1 | 2 | 3; // plantes : lumière
	co2?: 0 | 1 | 2; // plantes : CO2
	was?: string; // ancien nom latin (la fiche est renommée, son identifiant est conservé)
}

export async function readCore(): Promise<{ version: string; entries: CoreEntry[] }> {
	const { readdir } = await import('node:fs/promises');
	const { createHash } = await import('node:crypto');
	const dir = path.resolve('data/core');
	let files: string[] = [];
	try {
		files = (await readdir(dir)).filter((f) => f.endsWith('.jsonl')).sort();
	} catch {
		return { version: 'vide', entries: [] };
	}
	const hash = createHash('sha1');
	const entries: CoreEntry[] = [];
	for (const file of files) {
		const raw = await readFile(path.join(dir, file), 'utf8');
		hash.update(file).update(raw);
		for (const line of raw.split('\n')) {
			if (line.trim()) entries.push(JSON.parse(line) as CoreEntry);
		}
	}
	return { version: hash.digest('hex').slice(0, 12), entries };
}

/** Applique le noyau : met à jour les espèces importées de même nom latin, crée les autres (plantes…). */
export async function seedCore(): Promise<void> {
	const { version, entries } = await readCore();
	if (!entries.length) return;
	const done = await db().query<{ value: string }>(`SELECT value FROM app_state WHERE key = 'species_core'`);
	if (done.rows[0]?.value === version) return;

	// Renommages (nom latin révisé) : on garde l'identifiant, donc les liens avec les habitants.
	for (const e of entries) {
		if (!e.was) continue;
		await db().query(
			`UPDATE species SET scientific_name = $2 WHERE lower(scientific_name) = lower($1) AND source = 'noyau'
			   AND NOT EXISTS (SELECT 1 FROM species WHERE lower(scientific_name) = lower($2) AND source = 'noyau')`,
			[e.was, e.s]
		);
	}

	let created = 0;
	let updated = 0;
	for (const e of entries) {
		const values: Record<string, unknown> = {
			name_fr: e.fr ?? null,
			name_en: e.en ?? null,
			kind: e.k,
			fresh: e.w === 'd' || e.w === 'sd',
			brackish: e.w === 'sd',
			salt: e.w === 'm',
			max_length_cm: e.L ?? null,
			lifespan_years: e.v ?? null,
			temp_min: e.t?.[0] ?? null,
			temp_max: e.t?.[1] ?? null,
			ph_min: e.p?.[0] ?? null,
			ph_max: e.p?.[1] ?? null,
			min_tank_l: e.b ?? null,
			temperament: e.m ?? null,
			diet: e.r ?? null,
			zone: e.z ?? null,
			group_min: e.g ?? null,
			reef_safe: e.rf ?? null,
			description: e.d ?? null,
			origin: e.o ?? null,
			difficulty: e.n ?? null,
			care: e.c ?? null,
			light: e.lt ?? null,
			co2: e.co2 ?? null
		};
		const found = await db().query<{ id: number; locked: string[] }>(
			`SELECT id, locked FROM species WHERE lower(scientific_name) = lower($1) AND source <> 'maison'
			 ORDER BY (source = 'noyau') DESC, source LIMIT 1`,
			[e.s]
		);
		if (found.rows[0]) {
			const { id, locked } = found.rows[0];
			const lockedColumns = new Set(locked.map((k) => FIELDS[k]?.column).filter(Boolean));
			const entriesToSet = Object.entries(values).filter(([column, value]) => !lockedColumns.has(column) && value !== null);
			if (!entriesToSet.length) continue;
			const sets = entriesToSet.map(([column], i) => `${column} = $${i + 2}`);
			await db().query(
				`UPDATE species SET ${sets.join(', ')}, curated = true, data_quality = COALESCE(data_quality, 'claude'),
				   estimated = ARRAY(SELECT x FROM unnest(estimated) x WHERE x <> ALL($${sets.length + 2}::text[]))
				 WHERE id = $1`,
				[id, ...entriesToSet.map(([, v]) => v), [e.z != null && 'zone', e.r != null && 'diet', e.g != null && 'groupMin'].filter(Boolean)]
			);
			updated++;
		} else {
			const cols = Object.keys(values);
			await db().query(
				`INSERT INTO species (source, scientific_name, curated, data_quality, ${cols.join(', ')})
				 VALUES ('noyau', $1, true, 'claude', ${cols.map((_, i) => `$${i + 2}`).join(', ')})
				 ON CONFLICT DO NOTHING`,
				[e.s, ...Object.values(values)]
			);
			created++;
		}
	}
	await db().query(
		`INSERT INTO app_state (key, value) VALUES ('species_core', $1)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
		[version]
	);
	console.log(`[espèces] noyau ${version} : ${updated} mises à jour, ${created} créées`);
}

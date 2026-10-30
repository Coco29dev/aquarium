// Vérifie data/core/*.jsonl : format, valeurs plausibles, doublons, et correspondance avec la base importée.
// Usage : node scripts/check-core.mjs [--unmatched]
import { readdir, readFile } from 'node:fs/promises';

const KINDS = new Set(['poisson', 'corail', 'invertebre', 'plante']);
const WATER = new Set(['d', 'm', 'sd']);
const TEMPER = new Set(['paisible', 'semi-agressif', 'agressif']);
const DIET = new Set(['carnivore', 'omnivore', 'herbivore', 'filtreur', 'autre']);
const ZONE = new Set(['haut', 'milieu', 'bas', 'tous']);
const KEYS = new Set(['s', 'fr', 'en', 'k', 'w', 'L', 'v', 't', 'p', 'b', 'm', 'r', 'z', 'g', 'rf', 'd']);

const seed = JSON.parse(await readFile('data/species.seed.json', 'utf8'));
const sci = seed.columns.indexOf('sci');
const known = new Map(seed.rows.map((r) => [r[sci].toLowerCase(), r]));

const files = (await readdir('data/core')).filter((f) => f.endsWith('.jsonl')).sort();
const seen = new Map();
const errors = [];
const unmatched = [];
let total = 0;
const byKind = {};

for (const file of files) {
	const lines = (await readFile(`data/core/${file}`, 'utf8')).split('\n');
	lines.forEach((line, i) => {
		if (!line.trim()) return;
		const where = `${file}:${i + 1}`;
		let e;
		try {
			e = JSON.parse(line);
		} catch (err) {
			errors.push(`${where} JSON invalide`);
			return;
		}
		total++;
		const bad = (msg) => errors.push(`${where} ${e.s ?? '?'} : ${msg}`);
		for (const k of Object.keys(e)) if (!KEYS.has(k)) bad(`clé inconnue « ${k} »`);
		if (!e.s || !/^[A-Z][a-z-]+ [a-z-]+( [a-z-]+)?$/.test(e.s)) bad('nom latin mal formé');
		if (!e.fr) bad('nom français manquant');
		if (!KINDS.has(e.k)) bad('type invalide');
		if (!WATER.has(e.w)) bad('eau invalide');
		if (e.m && !TEMPER.has(e.m)) bad('tempérament invalide');
		if (e.r && !DIET.has(e.r)) bad('régime invalide');
		if (e.z && !ZONE.has(e.z)) bad('zone invalide');
		if (!e.d || e.d.length < 40) bad('description absente ou trop courte');
		if (e.d && e.d.length > 400) bad('description trop longue');
		for (const key of ['t', 'p']) if (e[key] && !(Array.isArray(e[key]) && e[key].length === 2 && e[key][0] < e[key][1])) bad(`plage ${key} invalide`);
		if (e.t && (e.t[0] < 0 || e.t[1] > 40)) bad('température improbable');
		if (e.p && (e.p[0] < 3 || e.p[1] > 9.5)) bad('pH improbable');
		if (e.L != null && !(e.L > 0 && e.L < 500)) bad('taille improbable');
		if (e.b != null && !(e.b >= 5 && e.b <= 20000)) bad('volume improbable');
		if (e.g != null && !(Number.isInteger(e.g) && e.g >= 1 && e.g <= 30)) bad('groupe improbable');
		if (e.k !== 'poisson' && e.k !== 'invertebre' && e.m) bad('tempérament sur une plante/un corail');
		const key = e.s?.toLowerCase();
		if (seen.has(key)) bad(`doublon avec ${seen.get(key)}`);
		else seen.set(key, where);
		byKind[e.k] = (byKind[e.k] ?? 0) + 1;
		if (e.k !== 'plante' && !known.has(key)) unmatched.push(`${e.s} (${file})`);
	});
}

console.log(`${total} fiches`, byKind);
if (errors.length) console.log(`\n${errors.length} erreurs :\n` + errors.join('\n'));
if (process.argv.includes('--unmatched') || unmatched.length) {
	console.log(`\n${unmatched.length} espèces absentes de FishBase/SeaLifeBase (seront créées telles quelles) :`);
	console.log(unmatched.join('\n'));
}
process.exit(errors.length ? 1 : 0);

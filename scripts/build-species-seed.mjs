// Génère data/species.seed.json à partir des snapshots FishBase / SeaLifeBase (rfishbase, Hugging Face).
// Usage : node scripts/build-species-seed.mjs   (télécharge dans .data/fishbase la première fois)
// Données : CC-BY-NC 4.0, FishBase.org / SeaLifeBase.org. Usage personnel non commercial uniquement.
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet';

const VERSION = 'v25.04';
const BASE = 'https://huggingface.co/datasets/cboettig/fishbase/resolve/main/data';
const CACHE = '.data/fishbase';
const AQUARIUM = new Set(['commercial', 'highly commercial', 'public aquariums', 'show aquarium', 'potential']);

async function table(db, name) {
	const file = `${CACHE}/${db}_${name}.parquet`;
	try {
		await stat(file);
	} catch {
		await mkdir(CACHE, { recursive: true });
		console.log('téléchargement', db, name);
		const response = await fetch(`${BASE}/${db}/${VERSION}/parquet/${name}.parquet`);
		if (!response.ok) throw new Error(`${db}/${name} : ${response.status}`);
		await writeFile(file, Buffer.from(await response.arrayBuffer()));
	}
	return parquetReadObjects({ file: await asyncBufferFromFile(file) });
}

function names(comnames) {
	// SpecCode → { fr, en } : on préfère le nom marqué « préféré », sinon le premier.
	const best = new Map();
	for (const row of comnames) {
		const lang = row.Language === 'French' ? 'fr' : row.Language === 'English' ? 'en' : null;
		if (!lang || !row.ComName || row.Misspelling) continue;
		const entry = best.get(row.SpecCode) ?? {};
		const preferred = row.PreferredName === -1 || row.PreferredName === 1;
		if (!entry[lang] || (preferred && !entry[`${lang}P`])) {
			entry[lang] = row.ComName.trim();
			if (preferred) entry[`${lang}P`] = true;
		}
		best.set(row.SpecCode, entry);
	}
	return best;
}

const flag = (v) => (v ? 1 : 0);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

const ZONE = {
	pelagic: 'haut',
	'pelagic-neritic': 'haut',
	'pelagic-oceanic': 'haut',
	benthopelagic: 'milieu',
	'reef-associated': 'milieu',
	demersal: 'bas',
	bathydemersal: 'bas',
	bathypelagic: 'bas'
};

function diet(herbivory, feeding) {
	if (feeding === 'filtering plankton') return 'filtreur';
	if (herbivory?.startsWith('mainly plants')) return 'herbivore';
	if (herbivory?.startsWith('plants/detritus+animals')) return 'omnivore';
	if (herbivory?.startsWith('mainly animals')) return 'carnivore';
	return null;
}

const rows = [];

// --- FishBase : poissons signalés comme utilisés en aquarium ------------------------------
{
	const [species, comnames, ecology] = await Promise.all([table('fb', 'species'), table('fb', 'comnames'), table('fb', 'ecology')]);
	const nm = names(comnames);
	const eco = new Map();
	for (const e of ecology) if (!eco.has(e.SpecCode)) eco.set(e.SpecCode, e);
	for (const s of species) {
		if (!AQUARIUM.has(s.Aquarium) || s.TaxIssue) continue;
		const e = eco.get(s.SpecCode);
		const n = nm.get(s.SpecCode) ?? {};
		rows.push({
			source: 'fishbase',
			code: s.SpecCode,
			sci: `${s.Genus} ${s.Species}`,
			fr: n.fr ?? null,
			en: n.en ?? s.FBname ?? null,
			kind: 'poisson',
			fresh: flag(s.Fresh),
			brackish: flag(s.Brack),
			salt: flag(s.Saltwater),
			len: num(s.Length),
			life: num(s.LongevityCaptive ?? s.LongevityWild),
			zone: ZONE[s.DemersPelag] ?? null,
			diet: diet(e?.Herbivory2, e?.FeedingType),
			group: e?.Schooling ? 6 : null
		});
	}
}

// --- SeaLifeBase : pas de drapeau « aquarium » → classes et mots-clés ------------------------
{
	const [species, comnames, families] = await Promise.all([table('slb', 'species'), table('slb', 'comnames'), table('slb', 'families')]);
	const nm = names(comnames);
	const fam = new Map(families.map((f) => [f.FamCode, f]));
	const decapod = /shrimp|prawn|crab|lobster|hermit|crayfish|squat/i;
	const mollusc = /snail|urchin|sea star|starfish|cucumber|clam|nudibranch|conch|cowrie|cerith|nerite|turbo|astraea|trochus|sea hare|brittle|feather star|slug/i;
	const CORAL_CLASSES = new Set(['Hexacorallia', 'Octocorallia']);
	const OTHER_CLASSES = new Set(['Gastropoda', 'Bivalvia', 'Echinoidea', 'Asteroidea', 'Holothuroidea', 'Ophiuroidea', 'Crinoidea']);
	for (const s of species) {
		if (s.TaxIssue) continue;
		const f = fam.get(s.FamCode);
		const n = nm.get(s.SpecCode) ?? {};
		const en = n.en ?? s.FBname ?? null;
		if (!f || !(en || n.fr)) continue;
		const label = `${en ?? ''} ${n.fr ?? ''}`;
		let kind = null;
		if (CORAL_CLASSES.has(f.Class)) kind = 'corail';
		else if (f.Class === 'Malacostraca' && f.Order === 'Decapoda' && decapod.test(label)) kind = 'invertebre';
		else if (OTHER_CLASSES.has(f.Class) && mollusc.test(label)) kind = 'invertebre';
		if (!kind || !s.Saltwater) continue;
		rows.push({
			source: 'sealifebase',
			code: s.SpecCode,
			sci: `${s.Genus} ${s.Species}`,
			fr: n.fr ?? null,
			en,
			kind,
			fresh: flag(s.Fresh),
			brackish: flag(s.Brack),
			salt: flag(s.Saltwater),
			len: num(s.Length),
			life: num(s.LongevityCaptive ?? s.LongevityWild),
			zone: null,
			diet: null,
			group: null
		});
	}
}

const columns = ['source', 'code', 'sci', 'fr', 'en', 'kind', 'fresh', 'brackish', 'salt', 'len', 'life', 'zone', 'diet', 'group'];
const output = {
	version: `fishbase-sealifebase-${VERSION}`,
	attribution: 'FishBase (fishbase.org) et SeaLifeBase (sealifebase.org), CC-BY-NC 4.0, via rfishbase.',
	columns,
	rows: rows.map((r) => columns.map((c) => r[c]))
};
await mkdir('data', { recursive: true });
await writeFile('data/species.seed.json', JSON.stringify(output));
const by = (k) => rows.reduce((m, r) => ((m[r[k]] = (m[r[k]] ?? 0) + 1), m), {});
console.log(rows.length, 'espèces', by('source'), by('kind'));

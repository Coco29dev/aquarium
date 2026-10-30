// Vérifie les noms latins de data/core/*.jsonl auprès de GBIF (statut, nom accepté) et les noms français / tailles
// contre l'import FishBase / SeaLifeBase (data/species.seed.json). Réseau requis.
// Usage : node scripts/verify-names.mjs [--water=d] [--out=rapport.json]
import { readdir, readFile, writeFile } from 'node:fs/promises';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const only = arg('water', 'd'); // d : eau douce (d et sd) ; m : mer ; all
const out = arg('out', '');

const seed = JSON.parse(await readFile('data/species.seed.json', 'utf8'));
const col = (n) => seed.columns.indexOf(n);
const bySci = new Map(seed.rows.map((r) => [String(r[col('sci')]).toLowerCase(), r]));

const entries = [];
for (const f of (await readdir('data/core')).filter((x) => x.endsWith('.jsonl')).sort()) {
	for (const line of (await readFile(`data/core/${f}`, 'utf8')).split('\n')) {
		if (!line.trim()) continue;
		const e = JSON.parse(line);
		const fresh = e.w === 'd' || e.w === 'sd';
		if (only === 'all' || (only === 'd' && fresh) || (only === 'm' && e.w === 'm')) entries.push({ ...e, file: f });
	}
}

async function gbif(name) {
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			const r = await fetch(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(name)}&strict=false`);
			if (r.ok) return await r.json();
		} catch {}
		await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
	}
	return null;
}

const report = [];
let next = 0;
await Promise.all(
	Array.from({ length: 8 }, async () => {
		while (next < entries.length) {
			const e = entries[next++];
			const g = await gbif(e.s);
			const issues = [];
			if (!g) issues.push('GBIF injoignable');
			else if (g.matchType === 'NONE') issues.push('inconnu de GBIF');
			else {
				if (g.matchType !== 'EXACT') issues.push(`correspondance ${g.matchType} → ${g.canonicalName}`);
				if (g.status === 'SYNONYM' || g.synonym) issues.push(`synonyme → ${g.acceptedUsageKey ? await accepted(g.acceptedUsageKey) : '?'}`);
				if (g.status === 'DOUBTFUL') issues.push('statut douteux');
			}
			const row = bySci.get(e.s.toLowerCase());
			if (row) {
				const fb = row[col('fr')];
				const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
				if (fb && norm(fb) !== norm(e.fr)) issues.push(`FR FishBase : « ${fb} » (fiche : « ${e.fr} »)`);
				const len = Number(row[col('len')]);
				if (len && e.L && (e.L > len * 1.5 || e.L < len * 0.5) && e.k !== 'plante') issues.push(`taille ${e.L} cm vs FishBase ${len} cm`);
			}
			if (issues.length) report.push({ s: e.s, fr: e.fr, file: e.file, issues });
		}
	})
);
async function accepted(key) {
	try {
		return (await (await fetch(`https://api.gbif.org/v1/species/${key}`)).json()).canonicalName;
	} catch {
		return '?';
	}
}
report.sort((a, b) => a.file.localeCompare(b.file) || a.s.localeCompare(b.s));
console.log(`${entries.length} fiches contrôlées, ${report.length} à regarder`);
for (const r of report) console.log(`${r.s} (${r.fr}) [${r.file.slice(0, 2)}] : ${r.issues.join(' ; ')}`);
if (out) await writeFile(out, JSON.stringify(report, null, 1));

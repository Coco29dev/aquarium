// Construit data/species.photos.json : une photo libre (Wikimedia Commons) par espèce du noyau.
// Source : image principale de la page Wikipédia de l'espèce ; on ne garde que les licences libres
// (CC BY, CC BY-SA, CC0, domaine public) et on conserve auteur + licence pour l'attribution.
// Le serveur copie ensuite les images dans le bucket (src/lib/server/species-photos.ts).
// Usage : node scripts/build-species-photos.mjs
import { readdir, readFile, writeFile } from 'node:fs/promises';

const UA = 'AquariumPerso/1.0 (appli personnelle; github.com/Coco29dev/aquarium)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(host, params) {
	const url = `https://${host}/w/api.php?${new URLSearchParams({ format: 'json', ...params })}`;
	for (let attempt = 0; attempt < 6; attempt++) {
		const response = await fetch(url, { headers: { 'user-agent': UA } });
		if (response.ok) return response.json();
		// 429 : on respecte Retry-After (sinon 30 s, puis de plus en plus long).
		const wait = Number(response.headers.get('retry-after')) || 30 * (attempt + 1);
		console.log(`\n${host} → ${response.status}, pause ${wait} s`);
		await sleep(wait * 1000);
	}
	throw new Error(`API ${host} indisponible`);
}

// --- Lecture du noyau
const entries = [];
for (const file of (await readdir('data/core')).filter((f) => f.endsWith('.jsonl')).sort()) {
	for (const line of (await readFile(`data/core/${file}`, 'utf8')).split('\n')) if (line.trim()) entries.push(JSON.parse(line));
}
const names = entries.map((e) => e.s);
console.log(entries.length, 'espèces');

// --- 1. Image principale des pages Wikipédia (en, puis fr pour celles qui manquent)
const pageImage = new Map(); // nom latin → { file, title }
async function lookup(host, list) {
	for (let i = 0; i < list.length; i += 50) {
		const batch = list.slice(i, i + 50);
		const data = await api(host, {
			action: 'query',
			titles: batch.join('|'),
			prop: 'pageimages',
			piprop: 'name',
			pilimit: '50',
			redirects: '1'
		});
		const q = data.query ?? {};
		const toFinal = new Map(batch.map((n) => [n, n]));
		for (const r of q.normalized ?? []) for (const [k, v] of toFinal) if (v === r.from) toFinal.set(k, r.to);
		for (const r of q.redirects ?? []) for (const [k, v] of toFinal) if (v === r.from) toFinal.set(k, r.to);
		const byTitle = new Map(Object.values(q.pages ?? {}).map((p) => [p.title, p]));
		for (const [sci, finalTitle] of toFinal) {
			const page = byTitle.get(finalTitle);
			if (!page?.pageimage) continue;
			// Une page « genre » (titre d'un seul mot = le genre) ne représente pas l'espèce.
			if (!finalTitle.includes(' ') && finalTitle === sci.split(' ')[0]) continue;
			if (/\.svg$/i.test(page.pageimage) || /(map|distribution|range|skeleton|fossil|diagram|drawing|illustration|plate|stamp|logo|locator)/i.test(page.pageimage)) continue;
			pageImage.set(sci, { file: page.pageimage, title: finalTitle });
		}
		await sleep(1200);
		process.stdout.write('.');
	}
}
await lookup('en.wikipedia.org', names);
await lookup('fr.wikipedia.org', names.filter((n) => !pageImage.has(n)));
console.log(`\n${pageImage.size} images candidates`);

// --- 2. Licence, auteur et URL (Commons)
const files = [...new Set([...pageImage.values()].map((v) => v.file))];
const info = new Map();
for (let i = 0; i < files.length; i += 50) {
	const batch = files.slice(i, i + 50);
	const data = await api('commons.wikimedia.org', {
		action: 'query',
		titles: batch.map((f) => `File:${f}`).join('|'),
		prop: 'imageinfo',
		iiprop: 'url|extmetadata',
		iiurlwidth: '800'
	});
	const q = data.query ?? {};
	const norm = new Map((q.normalized ?? []).map((n) => [n.from, n.to]));
	const pages = new Map(Object.values(q.pages ?? {}).map((p) => [p.title, p]));
	for (const f of batch) {
		const title = norm.get(`File:${f}`) ?? `File:${f}`;
		const page = pages.get(title) ?? pages.get(title.replaceAll('_', ' '));
		const ii = page?.imageinfo?.[0];
		if (ii) info.set(f, ii);
	}
	await sleep(1200);
	process.stdout.write('.');
}

const FREE = /^(CC BY(?!-NC)(?!-ND)|CC0|Public domain|PD|Attribution)/i;
const manifest = {};
let rejected = 0;
for (const [sci, { file }] of pageImage) {
	const ii = info.get(file);
	const meta = ii?.extmetadata;
	const license = meta?.LicenseShortName?.value ?? '';
	if (!ii || !FREE.test(license) || /NC|ND/.test(license)) {
		rejected++;
		continue;
	}
	const author = (meta.Artist?.value ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || 'Auteur inconnu';
	manifest[sci.toLowerCase()] = {
		url: ii.thumburl ?? ii.url,
		page: ii.descriptionurl,
		author: author.slice(0, 160),
		license
	};
}
await writeFile('data/species.photos.json', JSON.stringify(manifest, null, 1));
const missing = names.filter((n) => !manifest[n.toLowerCase()]);
console.log(`\n${Object.keys(manifest).length} photos retenues, ${rejected} refusées (licence), ${missing.length} espèces sans photo`);
await writeFile('.data/photos-manquantes.txt', missing.join('\n')).catch(() => {});

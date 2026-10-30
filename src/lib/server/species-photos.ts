import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from './db';
import { putObject } from './storage';

// Photos Wikimedia Commons (licences libres) : data/species.photos.json donne, par nom latin, l'URL,
// l'auteur et la licence. Le serveur les copie dans le stockage (bucket), en tâche de fond et sans
// bloquer le démarrage ; ce qui échoue est retenté au prochain démarrage.

interface PhotoEntry {
	url: string;
	page: string;
	author: string;
	license: string;
}

const USER_AGENT = 'AquariumPerso/1.0 (appli personnelle; github.com/Coco29dev/aquarium)';
const MAX_BYTES = 4 * 1024 * 1024;

function imageKind(bytes: Uint8Array): { type: string; ext: string } | null {
	if (bytes[0] === 0xff && bytes[1] === 0xd8) return { type: 'image/jpeg', ext: 'jpg' };
	if (bytes[0] === 0x89 && bytes[1] === 0x50) return { type: 'image/png', ext: 'png' };
	if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57) return { type: 'image/webp', ext: 'webp' };
	return null;
}

let running = false;

export async function syncSpeciesPhotos(): Promise<void> {
	if (running) return;
	running = true;
	try {
		let manifest: Record<string, PhotoEntry>;
		try {
			manifest = JSON.parse(await readFile(path.resolve('data/species.photos.json'), 'utf8'));
		} catch {
			return;
		}
		// Jusqu'à 3 passes : les échecs (souvent une limite de débit) sont repris après une pause.
		for (let pass = 1; pass <= 3; pass++) {
			const { rows } = await db().query<{ id: number; scientific_name: string }>(
				`SELECT id, scientific_name FROM species WHERE curated AND photo_key IS NULL`
			);
			const todo = rows.filter((r) => manifest[r.scientific_name.toLowerCase()]);
			if (!todo.length) return;
			console.log(`[photos] passe ${pass} : ${todo.length} photos à copier`);

			let ok = 0;
			let failed = 0;
			for (const row of todo) {
				const entry = manifest[row.scientific_name.toLowerCase()];
				try {
					let response = await fetch(entry.url, { headers: { 'user-agent': USER_AGENT } });
					if (response.status === 429) {
						// Limite de débit de Wikimedia : on patiente puis on réessaie une fois.
						const wait = Math.min(60, Number(response.headers.get('retry-after')) || 30);
						await new Promise((r) => setTimeout(r, wait * 1000));
						response = await fetch(entry.url, { headers: { 'user-agent': USER_AGENT } });
					}
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const bytes = new Uint8Array(await response.arrayBuffer());
					const kind = imageKind(bytes);
					if (!kind || bytes.length > MAX_BYTES) throw new Error('image invalide ou trop lourde');
					const key = `species/${row.id}.${kind.ext}`;
					await putObject(key, bytes, kind.type);
					await db().query(
						`UPDATE species SET photo_key = $2, photo_source = $3, photo_author = $4, photo_license = $5 WHERE id = $1`,
						[row.id, key, entry.page, entry.author.slice(0, 200), entry.license]
					);
					ok++;
				} catch (error) {
					failed++;
					console.warn(`[photos] ${row.scientific_name} : ${(error as Error).message}`);
				}
				// Politesse envers Wikimedia : ~2 images par seconde au maximum.
				await new Promise((r) => setTimeout(r, 500));
			}
			console.log(`[photos] passe ${pass} terminée : ${ok} copiées, ${failed} échecs`);
			if (!failed) return;
			await new Promise((r) => setTimeout(r, 5 * 60 * 1000));
		}
	} finally {
		running = false;
	}
}

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runBackup } from '$lib/server/backup';
import { restoreAll } from '$lib/server/restore';

const MAX_JSON_BYTES = 200 * 1024 * 1024;

/** Le fichier arrive compressé en gzip (le serveur limite la taille des requêtes, un export en clair la dépasserait). */
async function readExport(request: Request): Promise<unknown> {
	if (!request.body) error(400, 'Fichier manquant');
	const gzip = request.headers.get('content-encoding') === 'gzip' || request.headers.get('content-type') === 'application/gzip';
	const stream = gzip ? request.body.pipeThrough(new DecompressionStream('gzip')) : request.body;
	const chunks: Uint8Array[] = [];
	let total = 0;
	for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
		total += chunk.byteLength;
		if (total > MAX_JSON_BYTES) error(413, 'Fichier trop volumineux');
		chunks.push(chunk);
	}
	try {
		return JSON.parse(Buffer.concat(chunks).toString('utf8'));
	} catch {
		error(400, 'Ce fichier n’est pas un JSON valide');
	}
}

// Remplace toutes les données par celles d'un export JSON. Une sauvegarde de l'état actuel est faite avant.
export const POST: RequestHandler = async ({ request }) => {
	const data = await readExport(request);
	try {
		await runBackup();
	} catch (e) {
		error(502, `Restauration annulée : la sauvegarde de sécurité a échoué (${(e as Error).message})`);
	}
	return json({ restored: await restoreAll(data) });
};

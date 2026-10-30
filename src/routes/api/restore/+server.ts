import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyRestore, previewRestore } from '$lib/server/restore';

// POST /api/restore?dry=1 : prévisualisation (base intacte). POST /api/restore : applique, avec l'en-tête
// `x-confirm: restaurer`. Le corps est l'export JSON complet (voir /api/export?format=json).
// En production, adapter-node limite le corps à 512 Ko par défaut : le script « start » le relève (BODY_SIZE_LIMIT).
export const POST: RequestHandler = async ({ request, url }) => {
	const payload = await request.json().catch(() => null);
	if (payload === null) error(400, "Ce fichier n'est pas un JSON valide.");
	if (url.searchParams.get('dry') === '1') return json(await previewRestore(payload));
	if (request.headers.get('x-confirm') !== 'restaurer') error(400, 'Confirmation requise : en-tête x-confirm: restaurer.');
	return json(await applyRestore(payload));
};

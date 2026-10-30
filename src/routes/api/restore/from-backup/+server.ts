import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyRestore, previewRestore, readBackup } from '$lib/server/restore';
import { readBody } from '$lib/server/validate';

// POST /api/restore/from-backup { key, dry? } : comme /api/restore, depuis une sauvegarde du serveur.
export const POST: RequestHandler = async ({ request }) => {
	const body = await readBody(request);
	const payload = await readBackup(body.key);
	if (body.dry === true) return json(await previewRestore(payload));
	if (request.headers.get('x-confirm') !== 'restaurer') error(400, 'Confirmation requise : en-tête x-confirm: restaurer.');
	return json(await applyRestore(payload));
};

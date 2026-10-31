import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chatState, deleteThread, renameThread } from '$lib/server/assistant';
import { paramId, readBody } from '$lib/server/validate';

// GET → { threadId, aquariumId, title, configured, busy, items, pending, remaining }
export const GET: RequestHandler = async ({ params }) => json(await chatState(paramId(params.id)));

// PATCH { title } : renomme (titre vide : retour à l'aperçu du premier message).
export const PATCH: RequestHandler = async ({ params, request }) => {
	await renameThread(paramId(params.id), (await readBody(request)).title);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params }) => {
	await deleteThread(paramId(params.id));
	return json({ ok: true });
};

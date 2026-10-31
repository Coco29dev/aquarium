import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chatState, clearChat, sendMessage } from '$lib/server/assistant';
import { integer, readBody } from '$lib/server/validate';

const aquariumOf = (url: URL) => integer(Number(url.searchParams.get('aquarium')), 'aquarium');

// GET /api/assistant?aquarium=ID → { configured, busy, items, pending, remaining }
export const GET: RequestHandler = async ({ url }) => json(await chatState(aquariumOf(url)));

// POST { aquariumId, message } → flux d'événements (SSE)
export const POST: RequestHandler = async ({ request }) => {
	const body = await readBody(request);
	return sendMessage(integer(body.aquariumId, 'aquariumId'), body.message);
};

// DELETE /api/assistant?aquarium=ID : efface la conversation du bac.
export const DELETE: RequestHandler = async ({ url }) => {
	await clearChat(aquariumOf(url));
	return json({ ok: true });
};

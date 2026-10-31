import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { discardAttachment, readAttachment } from '$lib/server/assistant';
import { paramId } from '$lib/server/validate';

export const GET: RequestHandler = async ({ params }) => {
	const { bytes, type } = await readAttachment(paramId(params.id));
	return new Response(bytes as BodyInit, { headers: { 'content-type': type, 'cache-control': 'private, max-age=31536000, immutable' } });
};

// Retire une photo pas encore envoyée.
export const DELETE: RequestHandler = async ({ params }) => {
	await discardAttachment(paramId(params.id));
	return json({ ok: true });
};

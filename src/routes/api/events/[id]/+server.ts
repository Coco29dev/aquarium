import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteEvent, updateEvent } from '$lib/server/events';
import { paramId, readBody } from '$lib/server/validate';

// Correction d'un événement : date, détails (selon son type) et/ou note.
export const PATCH: RequestHandler = async ({ request, params }) => {
	const body = await readBody(request);
	const patch: { at?: string; payload?: Record<string, unknown>; note?: string | null } = {};
	if ('at' in body) {
		if (typeof body.at !== 'string' || Number.isNaN(Date.parse(body.at))) error(400, 'Date invalide');
		patch.at = new Date(body.at).toISOString();
	}
	if ('payload' in body) {
		if (!body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) error(400, 'Détails invalides');
		patch.payload = body.payload as Record<string, unknown>;
	}
	if ('note' in body) {
		if (body.note !== null && typeof body.note !== 'string') error(400, 'Champ invalide : note');
		patch.note = body.note as string | null;
	}
	if (Object.keys(patch).length === 0) error(400, 'Rien à modifier');
	await updateEvent(paramId(params.id), patch);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params }) => {
	await deleteEvent(paramId(params.id));
	return json({ ok: true });
};

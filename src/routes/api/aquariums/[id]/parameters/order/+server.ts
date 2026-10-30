import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { reorderParameters } from '$lib/server/data';
import { paramId, readBody } from '$lib/server/validate';

// Ordre d'affichage et de saisie des paramètres d'un bac.
export const PUT: RequestHandler = async ({ request, params }) => {
	const body = await readBody(request);
	const ids = body.ids;
	if (!Array.isArray(ids) || !ids.every((id) => Number.isInteger(id) && id > 0)) error(400, 'ids invalides');
	await reorderParameters(paramId(params.id), ids as number[]);
	return json({ ok: true });
};

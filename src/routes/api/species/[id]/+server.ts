import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteSpecies, searchSpecies, updateSpecies } from '$lib/server/species';
import { paramId, readBody } from '$lib/server/validate';

export const GET: RequestHandler = async ({ params }) => {
	const [species] = await searchSpecies({ ids: [paramId(params.id)] });
	if (!species) error(404, 'Espèce introuvable');
	return json(species);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	await updateSpecies(paramId(params.id), await readBody(request));
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params }) => {
	await deleteSpecies(paramId(params.id));
	return json({ ok: true });
};

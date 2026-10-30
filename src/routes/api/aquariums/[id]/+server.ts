import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteAquarium, updateAquarium } from '$lib/server/data';
import { day, number, paramId, readBody, text } from '$lib/server/validate';

export const PATCH: RequestHandler = async ({ request, params }) => {
	const body = await readBody(request);
	await updateAquarium(paramId(params.id), {
		name: text(body, 'name', false),
		volumeL: number(body, 'volumeL'),
		startedOn: day(body, 'startedOn')
	});
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params }) => {
	await deleteAquarium(paramId(params.id));
	return json({ ok: true });
};

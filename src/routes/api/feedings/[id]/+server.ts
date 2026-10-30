import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteFeeding } from '$lib/server/feedings';
import { paramId } from '$lib/server/validate';

export const DELETE: RequestHandler = async ({ params }) => {
	await deleteFeeding(paramId(params.id));
	return json({ ok: true });
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteResource, updateResource } from '$lib/server/resources';
import { paramId, readBody } from '$lib/server/validate';

export const PATCH: RequestHandler = async ({ params, request }) => {
	await updateResource(params.resource, paramId(params.id), await readBody(request));
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params }) => {
	await deleteResource(params.resource, paramId(params.id));
	return json({ ok: true });
};

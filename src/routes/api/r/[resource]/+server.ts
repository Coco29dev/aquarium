import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createResource, listResource } from '$lib/server/resources';
import { readBody } from '$lib/server/validate';

// GET /api/r/<ressource>?scope=<id> · POST { scopeId, ...champs }
export const GET: RequestHandler = async ({ params, url }) => {
	const scope = url.searchParams.get('scope');
	return json(await listResource(params.resource, scope ? Number(scope) : null));
};

export const POST: RequestHandler = async ({ params, request }) => {
	const body = await readBody(request);
	const scopeId = body.scopeId == null ? null : Number(body.scopeId);
	const id = await createResource(params.resource, scopeId, body);
	return json({ id }, { status: 201 });
};

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createResource, listResource } from '$lib/server/resources';
import { readBody } from '$lib/server/validate';

function scopeId(value: unknown): number {
	const id = Number(value);
	if (!Number.isInteger(id) || id <= 0) error(400, 'Rattachement invalide');
	return id;
}

// GET /api/r/<ressource>?scope=<id> · POST { scopeId, ...champs }
export const GET: RequestHandler = async ({ params, url }) => {
	const scope = url.searchParams.get('scope');
	return json(await listResource(params.resource, scope ? scopeId(scope) : null));
};

export const POST: RequestHandler = async ({ params, request }) => {
	const body = await readBody(request);
	const scope = body.scopeId == null ? null : scopeId(body.scopeId);
	const id = await createResource(params.resource, scope, body);
	return json({ id }, { status: 201 });
};

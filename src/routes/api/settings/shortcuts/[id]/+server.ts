import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { revokeToken } from '$lib/server/tokens';
import { paramId } from '$lib/server/validate';

export const DELETE: RequestHandler = async ({ params }) => {
	await revokeToken(paramId(params.id));
	return json({ ok: true });
};

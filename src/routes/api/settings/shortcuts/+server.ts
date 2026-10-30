import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createToken, listTokens } from '$lib/server/tokens';
import { readBody } from '$lib/server/validate';

export const GET: RequestHandler = async () => json(await listTokens());

// Le jeton n'est renvoyé qu'ici, une seule fois.
export const POST: RequestHandler = async ({ request }) => {
	const body = await readBody(request);
	return json(await createToken(typeof body.label === 'string' ? body.label : ''), { status: 201 });
};

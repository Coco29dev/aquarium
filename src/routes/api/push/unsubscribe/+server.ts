import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { removeSubscription } from '$lib/server/push';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
	if (typeof body?.endpoint !== 'string') error(400, 'Endpoint manquant');
	await removeSubscription(body.endpoint);
	return json({ ok: true });
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyOps, loadSnapshot, parseOps } from '$lib/server/data';
import { readBody } from '$lib/server/validate';

// Reçoit la file d'envoi (mesures, réalisations) puis renvoie l'état frais.
export const POST: RequestHandler = async ({ request }) => {
	const body = await readBody(request);
	await applyOps(parseOps(body.ops ?? []));
	return json(await loadSnapshot());
};

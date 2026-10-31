import type { RequestHandler } from './$types';
import { decide } from '$lib/server/assistant';
import { integer, readBody } from '$lib/server/validate';

// POST { aquariumId, decisions: { [idAppel]: true | false } } → flux d'événements (SSE)
export const POST: RequestHandler = async ({ request }) => {
	const body = await readBody(request);
	return decide(integer(body.aquariumId, 'aquariumId'), body.decisions);
};

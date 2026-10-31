import type { RequestHandler } from './$types';
import { decide } from '$lib/server/assistant';
import { integer, readBody } from '$lib/server/validate';

// POST { threadId, decisions: { [idAppel]: true | false } } → flux d'événements (SSE)
export const POST: RequestHandler = async ({ request }) => {
	const body = await readBody(request);
	return decide(integer(body.threadId, 'threadId'), body.decisions);
};

import type { RequestHandler } from './$types';
import { sendMessage } from '$lib/server/assistant';
import { readBody } from '$lib/server/validate';

// POST { threadId? | aquariumId, message, imageIds? } → flux d'événements (SSE). Sans threadId, une conversation est créée.
export const POST: RequestHandler = async ({ request }) => sendMessage(await readBody(request));

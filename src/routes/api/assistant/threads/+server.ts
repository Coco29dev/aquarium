import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listThreads } from '$lib/server/assistant';
import { integer } from '$lib/server/validate';

// GET /api/assistant/threads?aquarium=ID : conversations d'un bac, ou de tous sans le paramètre.
export const GET: RequestHandler = async ({ url }) => {
	const aquarium = url.searchParams.get('aquarium');
	return json(await listThreads(aquarium ? integer(Number(aquarium), 'aquarium') : undefined));
};

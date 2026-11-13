import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteThreads, listThreads } from '$lib/server/assistant';
import { integer, readBody } from '$lib/server/validate';

// GET /api/assistant/threads?aquarium=ID : conversations d'un bac, ou de tous sans le paramètre.
// Chaque entrée : { id, aquariumId, title, preview, updatedAt, messages, images }.
export const GET: RequestHandler = async ({ url }) => {
	const aquarium = url.searchParams.get('aquarium');
	return json(await listThreads(aquarium ? integer(Number(aquarium), 'aquarium') : undefined));
};

// DELETE { ids: number[] } : supprime plusieurs conversations avec leurs photos → { deleted, kept }.
// `kept` : celles qui n'ont pas pu l'être (réponse en cours, photos impossibles à supprimer).
export const DELETE: RequestHandler = async ({ request }) => json(await deleteThreads((await readBody(request)).ids));

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { attachmentToGallery } from '$lib/server/assistant';
import { paramId } from '$lib/server/validate';

// POST : copie la photo dans les photos du bac → { id } (identifiant de la photo créée).
export const POST: RequestHandler = async ({ params }) => json({ id: await attachmentToGallery(paramId(params.id)) }, { status: 201 });

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { saveAttachment } from '$lib/server/assistant';

// multipart : file, aquariumId → { id }. La photo est rattachée à la conversation à l'envoi du message.
export const POST: RequestHandler = async ({ request }) => {
	const form = await request.formData();
	const file = form.get('file');
	const aquariumId = Number(form.get('aquariumId'));
	if (!(file instanceof File) || !Number.isInteger(aquariumId)) error(400, 'Fichier et aquarium requis');
	return json({ id: await saveAttachment(aquariumId, file) }, { status: 201 });
};

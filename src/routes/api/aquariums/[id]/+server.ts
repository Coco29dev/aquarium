import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteAquarium, updateAquarium } from '$lib/server/data';
import { day, number, paramId, readBody, text } from '$lib/server/validate';

export const PATCH: RequestHandler = async ({ request, params }) => {
	const body = await readBody(request);
	await updateAquarium(paramId(params.id), {
		name: text(body, 'name', false),
		volumeL: number(body, 'volumeL'),
		startedOn: day(body, 'startedOn'),
		coverPhotoId: coverPhoto(body)
	});
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params }) => {
	await deleteAquarium(paramId(params.id));
	return json({ ok: true });
};

/** Photo de couverture : identifiant entier, null pour la retirer, absent pour ne rien changer. */
function coverPhoto(body: Record<string, unknown>): number | null | undefined {
	if (!('coverPhotoId' in body)) return undefined;
	const v = body.coverPhotoId;
	if (v === null) return null;
	if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) error(400, 'coverPhotoId invalide');
	return v;
}

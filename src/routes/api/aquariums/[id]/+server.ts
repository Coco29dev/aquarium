import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteAquarium, setAquariumStage, updateAquarium } from '$lib/server/data';
import { parseStage } from '$lib/server/aquarium-input';
import { db } from '$lib/server/db';
import { day, number, paramId, readBody, text } from '$lib/server/validate';

export const PATCH: RequestHandler = async ({ request, params }) => {
	const body = await readBody(request);
	const id = paramId(params.id);
	await updateAquarium(id, {
		name: text(body, 'name', false),
		volumeL: number(body, 'volumeL'),
		startedOn: day(body, 'startedOn'),
		coverPhotoId: coverPhoto(body),
		feedingsPerDay: feedingsPerDay(body)
	});
	// Un changement d'étape passe par les mêmes règles que POST /api/aquariums/[id]/stage.
	if ('stage' in body) {
		const stage = parseStage(body.stage);
		const { rows } = await db().query<{ stage: string }>('SELECT stage FROM aquariums WHERE id = $1', [id]);
		if (rows[0] && rows[0].stage !== stage) await setAquariumStage(id, stage);
	}
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

/** Repas par jour visés : entier de 1 à 10, null pour retirer la consigne, absent pour ne rien changer. */
function feedingsPerDay(body: Record<string, unknown>): number | null | undefined {
	if (!('feedingsPerDay' in body)) return undefined;
	const v = body.feedingsPerDay;
	if (v === null) return null;
	if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 10) error(400, 'feedingsPerDay doit être un entier de 1 à 10');
	return v;
}

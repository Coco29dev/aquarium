import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { deleteObject, getObject, putObject } from '$lib/server/storage';
import { imageType } from '$lib/server/image-type';
import { paramId } from '$lib/server/validate';

// Photo personnelle d'un habitant : propre à la fiche du bac, la fiche d'espèce n'est pas touchée.

const MAX_BYTES = 6 * 1024 * 1024;

export const GET: RequestHandler = async ({ params }) => {
	const { rows } = await db().query<{ photo_key: string | null; photo_type: string | null }>(
		'SELECT photo_key, photo_type FROM inhabitants WHERE id = $1',
		[paramId(params.id)]
	);
	if (!rows[0]?.photo_key) error(404, 'Photo introuvable');
	const bytes = await getObject(rows[0].photo_key);
	if (!bytes) error(404, 'Fichier introuvable');
	return new Response(bytes as BodyInit, {
		headers: {
			'content-type': rows[0].photo_type ?? 'image/jpeg',
			// La clé change à chaque nouvelle photo (le client l'ajoute à l'adresse) : cache sans risque.
			'cache-control': 'private, max-age=86400, immutable'
		}
	});
};

// multipart : file
export const PUT: RequestHandler = async ({ params, request }) => {
	const id = paramId(params.id);
	const file = (await request.formData()).get('file');
	if (!(file instanceof File)) error(400, 'Photo requise');
	if (file.size === 0 || file.size > MAX_BYTES) error(400, 'Photo vide ou trop lourde (6 Mo maximum)');
	const bytes = new Uint8Array(await file.arrayBuffer());
	const kind = imageType(bytes);
	if (!kind) error(400, 'Format non pris en charge (JPEG, PNG ou WebP)');

	const found = await db().query<{ aquarium_id: number; photo_key: string | null }>(
		'SELECT aquarium_id, photo_key FROM inhabitants WHERE id = $1',
		[id]
	);
	if (!found.rows[0]) error(404, 'Habitant introuvable');

	const key = `habitants/${found.rows[0].aquarium_id}/${crypto.randomUUID()}.${kind.ext}`;
	await putObject(key, bytes, kind.type);
	await db().query('UPDATE inhabitants SET photo_key = $2, photo_type = $3 WHERE id = $1', [id, key, kind.type]);
	if (found.rows[0].photo_key) await deleteObject(found.rows[0].photo_key).catch(() => {});
	return json({ photoKey: key });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = paramId(params.id);
	const { rows } = await db().query<{ photo_key: string | null }>('SELECT photo_key FROM inhabitants WHERE id = $1', [id]);
	await db().query('UPDATE inhabitants SET photo_key = NULL, photo_type = NULL WHERE id = $1', [id]);
	if (rows[0]?.photo_key) await deleteObject(rows[0].photo_key).catch(() => {});
	return json({ ok: true });
};

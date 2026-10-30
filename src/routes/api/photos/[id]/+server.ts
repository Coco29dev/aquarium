import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { deleteObject, getObject } from '$lib/server/storage';
import { paramId, readBody } from '$lib/server/validate';

export const GET: RequestHandler = async ({ params }) => {
	const { rows } = await db().query<{ storage_key: string; content_type: string }>(
		'SELECT storage_key, content_type FROM photos WHERE id = $1',
		[paramId(params.id)]
	);
	if (!rows[0]) error(404, 'Photo introuvable');
	const bytes = await getObject(rows[0].storage_key);
	if (!bytes) error(404, 'Fichier introuvable');
	return new Response(bytes as BodyInit, {
		headers: {
			'content-type': rows[0].content_type,
			// Privé : jamais mis en cache par un intermédiaire ; le navigateur peut le garder.
			'cache-control': 'private, max-age=86400, immutable'
		}
	});
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await readBody(request);
	const caption = typeof body.caption === 'string' ? body.caption.trim().slice(0, 300) || null : null;
	await db().query('UPDATE photos SET caption = $2 WHERE id = $1', [paramId(params.id), caption]);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const { rows } = await db().query<{ storage_key: string }>(
		'DELETE FROM photos WHERE id = $1 RETURNING storage_key',
		[paramId(params.id)]
	);
	if (rows[0]) await deleteObject(rows[0].storage_key);
	return json({ ok: true });
};

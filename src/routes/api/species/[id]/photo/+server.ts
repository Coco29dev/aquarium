import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { getObject } from '$lib/server/storage';
import { paramId } from '$lib/server/validate';

const TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export const GET: RequestHandler = async ({ params }) => {
	const { rows } = await db().query<{ photo_key: string | null }>('SELECT photo_key FROM species WHERE id = $1', [paramId(params.id)]);
	const key = rows[0]?.photo_key;
	if (!key) error(404, 'Pas de photo');
	const bytes = await getObject(key);
	if (!bytes) error(404, 'Fichier introuvable');
	return new Response(bytes as BodyInit, {
		headers: {
			'content-type': TYPES[key.split('.').pop() ?? ''] ?? 'image/jpeg',
			'cache-control': 'private, max-age=604800'
		}
	});
};

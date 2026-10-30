import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { putObject } from '$lib/server/storage';

const MAX_BYTES = 6 * 1024 * 1024;

function imageType(bytes: Uint8Array): { type: string; ext: string } | null {
	if (bytes[0] === 0xff && bytes[1] === 0xd8) return { type: 'image/jpeg', ext: 'jpg' };
	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { type: 'image/png', ext: 'png' };
	if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57) {
		return { type: 'image/webp', ext: 'webp' };
	}
	return null;
}

export const GET: RequestHandler = async ({ url }) => {
	const aquariumId = Number(url.searchParams.get('aquariumId'));
	if (!Number.isInteger(aquariumId)) error(400, 'aquariumId requis');
	const { rows } = await db().query(
		`SELECT id, aquarium_id AS "aquariumId", caption, taken_on AS "takenOn", bytes
		 FROM photos WHERE aquarium_id = $1 ORDER BY taken_on DESC, id DESC`,
		[aquariumId]
	);
	return json(rows);
};

// multipart : file, aquariumId, caption?, takenOn?
export const POST: RequestHandler = async ({ request }) => {
	const form = await request.formData();
	const file = form.get('file');
	const aquariumId = Number(form.get('aquariumId'));
	if (!(file instanceof File) || !Number.isInteger(aquariumId)) error(400, 'Fichier et aquarium requis');
	if (file.size === 0 || file.size > MAX_BYTES) error(400, 'Photo vide ou trop lourde (6 Mo maximum)');

	const bytes = new Uint8Array(await file.arrayBuffer());
	const kind = imageType(bytes);
	if (!kind) error(400, 'Format non pris en charge (JPEG, PNG ou WebP)');

	const exists = await db().query('SELECT 1 FROM aquariums WHERE id = $1', [aquariumId]);
	if (!exists.rowCount) error(404, 'Aquarium introuvable');

	const key = `${aquariumId}/${crypto.randomUUID()}.${kind.ext}`;
	await putObject(key, bytes, kind.type);

	const caption = String(form.get('caption') ?? '').trim().slice(0, 300) || null;
	const takenOn = String(form.get('takenOn') ?? '');
	const { rows } = await db().query<{ id: number }>(
		`INSERT INTO photos (aquarium_id, storage_key, content_type, bytes, caption, taken_on)
		 VALUES ($1, $2, $3, $4, $5, COALESCE(NULLIF($6, '')::date, CURRENT_DATE)) RETURNING id`,
		[aquariumId, key, kind.type, bytes.length, caption, /^\d{4}-\d{2}-\d{2}$/.test(takenOn) ? takenOn : '']
	);
	return json({ id: rows[0].id }, { status: 201 });
};

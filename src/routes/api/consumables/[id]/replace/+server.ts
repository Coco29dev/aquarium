import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { dayInParis } from '$lib/domain/dates';
import { paramId } from '$lib/server/validate';

// Marque un consommable comme remplacé aujourd'hui et garde la durée de vie réelle dans l'historique.
export const POST: RequestHandler = async ({ params }) => {
	const id = paramId(params.id);
	const today = dayInParis();
	const client = await db().connect();
	try {
		await client.query('BEGIN');
		const { rows } = await client.query<{ installed_on: string | null }>(
			'SELECT installed_on FROM consumables WHERE id = $1 FOR UPDATE',
			[id]
		);
		if (!rows[0]) error(404, 'Consommable introuvable');
		const installed = rows[0].installed_on;
		if (installed && installed <= today) {
			await client.query(
				'INSERT INTO consumable_replacements (consumable_id, installed_on, replaced_on) VALUES ($1, $2, $3)',
				[id, installed, today]
			);
		}
		await client.query('UPDATE consumables SET installed_on = $2 WHERE id = $1', [id, today]);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		throw e;
	} finally {
		client.release();
	}
	return json({ ok: true });
};

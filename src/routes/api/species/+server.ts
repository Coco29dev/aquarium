import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSpecies, searchSpecies } from '$lib/server/species';
import { readBody } from '$lib/server/validate';

// GET /api/species?q=&kind=&water=douce|mer&ids=1,2,3
export const GET: RequestHandler = async ({ url }) => {
	const ids = (url.searchParams.get('ids') ?? '')
		.split(',')
		.map(Number)
		.filter((n) => Number.isInteger(n) && n > 0)
		.slice(0, 200);
	const q = url.searchParams.get('q')?.trim();
	return json(
		await searchSpecies({
			q: q && q.length >= 2 ? q.slice(0, 80) : undefined,
			kind: url.searchParams.get('kind') || undefined,
			water: url.searchParams.get('water') || undefined,
			ids: ids.length ? ids : undefined,
			all: url.searchParams.get('all') === '1',
			// Sans critère, ne renvoie que les espèces maison pour ne pas lister 9 000 lignes.
			limit: ids.length ? ids.length : 40
		})
	);
};

export const POST: RequestHandler = async ({ request }) => {
	const id = await createSpecies(await readBody(request));
	return json({ id }, { status: 201 });
};

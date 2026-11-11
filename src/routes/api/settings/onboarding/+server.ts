import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getOnboarding, saveOnboarding } from '$lib/server/settings';
import { readBody } from '$lib/server/validate';
import { parseOnboarding } from '$lib/domain/onboarding';

// null tant que rien n'est enregistré : le client décide alors d'après les bacs déjà créés.
export const GET: RequestHandler = async () => json(await getOnboarding());

export const PUT: RequestHandler = async ({ request }) => {
	const body = await readBody(request);
	if (!parseOnboarding(body)) error(400, 'État de visite invalide');
	return json(await saveOnboarding(body));
};

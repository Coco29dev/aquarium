import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAquarium } from '$lib/server/data';
import { parseNewAquarium } from '$lib/server/aquarium-input';
import { dayInParis } from '$lib/domain/dates';
import { readBody } from '$lib/server/validate';

// Création d'un bac : nom, type d'eau, volume, date et étape (projet, cyclage, actif), plus de quoi
// démarrer : tâches, premières mesures, habitants, dernier changement d'eau, liste de projet.
export const POST: RequestHandler = async ({ request }) => {
	const body = await readBody(request);
	const id = await createAquarium(parseNewAquarium(body, dayInParis()));
	return json({ id }, { status: 201 });
};

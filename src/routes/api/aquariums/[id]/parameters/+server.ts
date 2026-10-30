import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { addParameter } from '$lib/server/data';
import { error } from '@sveltejs/kit';
import { number, paramId, readBody, text } from '$lib/server/validate';

/** Attente du réactif : 5 à 3600 secondes, ou null pour l'effacer. */
function waitSeconds(body: Record<string, unknown>): number | null | undefined {
	const v = number(body, 'testWaitSeconds');
	if (v != null && (!Number.isInteger(v) || v < 5 || v > 3600)) error(400, 'testWaitSeconds : entre 5 et 3600 secondes');
	return v;
}

export const POST: RequestHandler = async ({ request, params }) => {
	const body = await readBody(request);
	const id = await addParameter(paramId(params.id), {
		name: text(body, 'name'),
		unit: text(body, 'unit', false),
		min: number(body, 'min'),
		max: number(body, 'max'),
		driftPerWeek: number(body, 'driftPerWeek'),
		decimals: number(body, 'decimals'),
		step: number(body, 'step'),
		testWaitSeconds: waitSeconds(body)
	});
	return json({ id }, { status: 201 });
};

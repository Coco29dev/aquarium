import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { addParameter } from '$lib/server/data';
import { number, paramId, range, readBody, text } from '$lib/server/validate';

export const POST: RequestHandler = async ({ request, params }) => {
	const body = await readBody(request);
	range(number(body, 'min'), number(body, 'max'));
	const id = await addParameter(paramId(params.id), {
		name: text(body, 'name'),
		unit: text(body, 'unit', false),
		min: number(body, 'min'),
		max: number(body, 'max'),
		driftPerWeek: number(body, 'driftPerWeek'),
		decimals: number(body, 'decimals'),
		step: number(body, 'step')
	});
	return json({ id }, { status: 201 });
};

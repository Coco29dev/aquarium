import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteParameter, updateParameter } from '$lib/server/data';
import { number, paramId, readBody, text } from '$lib/server/validate';

export const PATCH: RequestHandler = async ({ request, params }) => {
	const body = await readBody(request);
	await updateParameter(paramId(params.id), {
		name: text(body, 'name', false),
		unit: 'unit' in body ? ((body.unit as string) ?? '') : undefined,
		min: number(body, 'min'),
		max: number(body, 'max'),
		driftPerWeek: number(body, 'driftPerWeek'),
		decimals: number(body, 'decimals'),
		step: number(body, 'step')
	});
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params }) => {
	await deleteParameter(paramId(params.id));
	return json({ ok: true });
};

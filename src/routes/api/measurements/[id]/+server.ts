import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteMeasurement, updateMeasurement } from '$lib/server/data';
import { paramId, readBody } from '$lib/server/validate';

// Correction d'une mesure : valeur et/ou date (ISO).
export const PATCH: RequestHandler = async ({ request, params }) => {
	const body = await readBody(request);
	let value: number | undefined;
	let measuredAt: string | undefined;
	if ('value' in body) {
		if (typeof body.value !== 'number' || !Number.isFinite(body.value)) error(400, 'Valeur invalide');
		value = body.value;
	}
	if ('measuredAt' in body) {
		if (typeof body.measuredAt !== 'string' || Number.isNaN(Date.parse(body.measuredAt))) error(400, 'Date invalide');
		measuredAt = new Date(body.measuredAt).toISOString();
	}
	if (value === undefined && measuredAt === undefined) error(400, 'Rien à modifier');
	await updateMeasurement(paramId(params.id), { value, measuredAt });
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params }) => {
	await deleteMeasurement(paramId(params.id));
	return json({ ok: true });
};

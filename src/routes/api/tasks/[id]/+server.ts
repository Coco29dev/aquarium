import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteTask, updateTask } from '$lib/server/data';
import { day, integer, paramId, readBody, text } from '$lib/server/validate';

export const PATCH: RequestHandler = async ({ request, params }) => {
	const body = await readBody(request);
	const everyDays = 'everyDays' in body ? integer(body.everyDays, 'everyDays') : undefined;
	if (everyDays !== undefined && (everyDays < 1 || everyDays > 365)) error(400, 'Fréquence invalide');
	await updateTask(paramId(params.id), {
		title: text(body, 'title', false),
		kind: text(body, 'kind', false),
		everyDays,
		nextDue: day(body, 'nextDue') ?? undefined,
		active: typeof body.active === 'boolean' ? body.active : undefined
	});
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params }) => {
	await deleteTask(paramId(params.id));
	return json({ ok: true });
};

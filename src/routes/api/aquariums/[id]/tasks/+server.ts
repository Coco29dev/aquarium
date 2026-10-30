import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { addTask } from '$lib/server/data';
import { day, integer, paramId, readBody, text } from '$lib/server/validate';

export const POST: RequestHandler = async ({ request, params }) => {
	const body = await readBody(request);
	const everyDays = integer(body.everyDays, 'everyDays');
	if (everyDays < 1 || everyDays > 365) error(400, 'Fréquence invalide');
	const id = await addTask(paramId(params.id), {
		title: text(body, 'title') as string,
		kind: text(body, 'kind', false) ?? 'autre',
		everyDays,
		nextDue: day(body, 'nextDue') ?? null
	});
	return json({ id }, { status: 201 });
};

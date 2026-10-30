import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAquarium } from '$lib/server/data';
import { day, number, readBody, text, waterType } from '$lib/server/validate';

export const POST: RequestHandler = async ({ request }) => {
	const body = await readBody(request);
	const id = await createAquarium({
		name: text(body, 'name') as string,
		waterType: waterType(body),
		volumeL: number(body, 'volumeL') ?? null,
		startedOn: day(body, 'startedOn') ?? null
	});
	return json({ id }, { status: 201 });
};

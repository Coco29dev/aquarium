import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNotificationSettings, saveNotificationSettings } from '$lib/server/settings';
import { readBody } from '$lib/server/validate';

export const GET: RequestHandler = async () => json(await getNotificationSettings());

export const PUT: RequestHandler = async ({ request }) => {
	const body = await readBody(request);
	try {
		return json(await saveNotificationSettings(body));
	} catch (e) {
		error(400, (e as Error).message);
	}
};

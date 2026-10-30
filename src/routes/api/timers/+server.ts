import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseTimer, timers } from '$lib/server/timers';

export const GET: RequestHandler = async () => json(timers.list());

// POST { seconds: 10..3600, label, url? } → { id, endsAt }
export const POST: RequestHandler = async ({ request }) => {
	const parsed = parseTimer(await request.json().catch(() => null));
	if (!parsed.ok) error(400, parsed.message);
	try {
		return json(timers.start(parsed.value), { status: 201 });
	} catch (e) {
		error(400, (e as Error).message);
	}
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setAquariumStage } from '$lib/server/data';
import { parseStage } from '$lib/server/aquarium-input';
import { day, paramId, readBody } from '$lib/server/validate';

// POST { stage, startedOn? } : projet → cyclage (mise en eau), cyclage → actif, actif → cyclage (nouveau cyclage).
export const POST: RequestHandler = async ({ request, params }) => {
	const body = await readBody(request);
	await setAquariumStage(paramId(params.id), parseStage(body.stage), day(body, 'startedOn') ?? undefined);
	return json({ ok: true });
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProfile, saveProfile } from '$lib/server/settings';
import { readBody } from '$lib/server/validate';

export const GET: RequestHandler = async () => json(await getProfile());

export const PUT: RequestHandler = async ({ request }) => json(await saveProfile(await readBody(request)));

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadSnapshot } from '$lib/server/data';

export const GET: RequestHandler = async () => json(await loadSnapshot());

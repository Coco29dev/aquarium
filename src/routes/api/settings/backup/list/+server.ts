import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listBackups } from '$lib/server/restore';

export const GET: RequestHandler = async () => json(await listBackups());

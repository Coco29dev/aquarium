import type { RequestHandler } from './$types';
import { run, shortcutPing } from '$lib/server/shortcuts';

export const GET: RequestHandler = async () => run(shortcutPing);

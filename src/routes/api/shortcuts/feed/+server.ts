import type { RequestHandler } from './$types';
import { shortcutFeed, readJson, run } from '$lib/server/shortcuts';

// Raccourcis Siri / bouton Action : réponse { ok, message }. Corps JSON (pas de formulaire).
export const POST: RequestHandler = async ({ request }) => run(async () => shortcutFeed(await readJson(request)));

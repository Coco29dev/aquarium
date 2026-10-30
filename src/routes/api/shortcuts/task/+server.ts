import type { RequestHandler } from './$types';
import { shortcutTask, readJson, run } from '$lib/server/shortcuts';

// Raccourcis Siri / bouton Action : réponse { ok, message }. Corps JSON (pas de formulaire).
export const POST: RequestHandler = async ({ request }) => run(async () => shortcutTask(await readJson(request)));

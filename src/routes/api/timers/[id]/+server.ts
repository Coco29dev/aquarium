import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { timers } from '$lib/server/timers';
import { paramId } from '$lib/server/validate';

export const DELETE: RequestHandler = async ({ params }) => {
	if (!timers.cancel(paramId(params.id))) error(404, 'Minuteur introuvable (déjà terminé ou perdu après un redémarrage).');
	return json({ ok: true });
};

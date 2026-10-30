import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sendToAll } from '$lib/server/push';

export const POST: RequestHandler = async () => {
	const results = await sendToAll({
		title: 'Aquarium',
		body: `Test de rappel envoyé à ${new Date().toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris' })}`,
		url: '/'
	});
	return json({ sent: results.filter((r) => r.ok).length, total: results.length, results });
};

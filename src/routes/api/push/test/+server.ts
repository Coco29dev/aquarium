import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sendToAll } from '$lib/server/push';

// Un test toutes les 10 secondes au plus : évite de saturer le téléphone.
let lastTest = 0;

export const POST: RequestHandler = async () => {
	if (Date.now() - lastTest < 10_000) error(429, 'Attends quelques secondes avant un nouveau test.');
	lastTest = Date.now();
	const results = await sendToAll({
		title: 'Aquarium',
		body: `Test de rappel envoyé à ${new Date().toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris' })}`,
		url: '/'
	});
	return json({ sent: results.filter((r) => r.ok).length, total: results.length, results });
};

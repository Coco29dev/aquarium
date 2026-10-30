import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseSubscription, saveSubscription } from '$lib/server/push';

// Appelée à chaque ouverture : crée l'abonnement ou met à jour last_seen_at.
export const POST: RequestHandler = async ({ request }) => {
	const subscription = parseSubscription(await request.json().catch(() => null));
	if (!subscription) error(400, 'Abonnement invalide');
	await saveSubscription(subscription, request.headers.get('user-agent'));
	return json({ ok: true });
};

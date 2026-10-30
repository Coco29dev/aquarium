import webpush from 'web-push';
import { env } from '$env/dynamic/private';
import { db } from './db';

let configured = false;

function configure(): void {
	if (configured) return;
	const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = env;
	if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
		throw new Error('VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT sont requis.');
	}
	webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
	configured = true;
}

export function vapidPublicKey(): string {
	configure();
	return env.VAPID_PUBLIC_KEY as string;
}

export interface SubscriptionInput {
	endpoint: string;
	keys: { p256dh: string; auth: string };
}

export function parseSubscription(value: unknown): SubscriptionInput | null {
	const v = value as Partial<SubscriptionInput> | null;
	if (!v || typeof v.endpoint !== 'string' || !v.keys) return null;
	if (typeof v.keys.p256dh !== 'string' || typeof v.keys.auth !== 'string') return null;
	if (!v.endpoint.startsWith('https://')) return null;
	return { endpoint: v.endpoint, keys: { p256dh: v.keys.p256dh, auth: v.keys.auth } };
}

export async function saveSubscription(sub: SubscriptionInput, userAgent: string | null): Promise<void> {
	await db().query(
		`INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_agent)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (endpoint) DO UPDATE
		 SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
		     user_agent = EXCLUDED.user_agent, last_seen_at = now()`,
		[sub.endpoint, sub.keys.p256dh, sub.keys.auth, userAgent]
	);
}

export async function removeSubscription(endpoint: string): Promise<void> {
	await db().query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
}

export interface SendResult {
	id: string;
	ok: boolean;
	status?: number;
	removed?: boolean;
}

export async function sendToAll(payload: { title: string; body: string; url?: string }): Promise<SendResult[]> {
	configure();
	const { rows } = await db().query<{ id: string; endpoint: string; p256dh: string; auth: string }>(
		'SELECT id, endpoint, p256dh, auth FROM push_subscriptions'
	);
	const body = JSON.stringify(payload);
	const results: SendResult[] = [];

	for (const row of rows) {
		try {
			await webpush.sendNotification(
				{ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
				body,
				{ TTL: 60 * 60 }
			);
			await db().query('UPDATE push_subscriptions SET last_success_at = now(), last_error = NULL WHERE id = $1', [
				row.id
			]);
			results.push({ id: row.id, ok: true });
		} catch (error) {
			const status = (error as { statusCode?: number }).statusCode;
			// 404 / 410 : l'abonnement n'existe plus côté Apple, on le supprime.
			if (status === 404 || status === 410) {
				await db().query('DELETE FROM push_subscriptions WHERE id = $1', [row.id]);
				results.push({ id: row.id, ok: false, status, removed: true });
			} else {
				await db().query('UPDATE push_subscriptions SET last_error = $2 WHERE id = $1', [
					row.id,
					`${status ?? 'erreur'}: ${(error as Error).message}`.slice(0, 500)
				]);
				results.push({ id: row.id, ok: false, status });
			}
		}
	}
	return results;
}

// Côté navigateur : enregistrement du service worker et gestion de l'abonnement push.

export function isStandalone(): boolean {
	return (
		window.matchMedia('(display-mode: standalone)').matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true
	);
}

export function pushSupported(): boolean {
	return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
	const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
	const raw = atob(padded);
	return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function sameKey(subscription: PushSubscription, publicKey: string): boolean {
	const current = subscription.options.applicationServerKey;
	if (!current) return false;
	const expected = urlBase64ToUint8Array(publicKey);
	const actual = new Uint8Array(current);
	return actual.length === expected.length && actual.every((byte, i) => byte === expected[i]);
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
	await navigator.serviceWorker.register('/service-worker.js');
	return navigator.serviceWorker.ready;
}

async function publicKey(): Promise<string> {
	const response = await fetch('/api/push/key');
	if (!response.ok) throw new Error('Clé VAPID indisponible');
	return (await response.json()).publicKey;
}

async function sendToServer(subscription: PushSubscription): Promise<void> {
	const response = await fetch('/api/push/subscribe', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(subscription.toJSON())
	});
	if (!response.ok) throw new Error(`Enregistrement refusé (${response.status})`);
}

export type SyncState = 'actif' | 'recréé' | 'inactif';

/**
 * Vérifie l'abonnement à chaque ouverture. Si la permission est accordée mais que
 * l'abonnement a disparu (ou que la clé VAPID a changé), il est recréé en silence.
 * Sans permission, ne demande rien : la demande passe par un geste (bouton).
 */
export async function syncSubscription(): Promise<SyncState> {
	const registration = await registerServiceWorker();
	if (Notification.permission !== 'granted') return 'inactif';

	const key = await publicKey();
	let subscription = await registration.pushManager.getSubscription();
	let state: SyncState = 'actif';

	if (subscription && !sameKey(subscription, key)) {
		await subscription.unsubscribe();
		subscription = null;
	}
	if (!subscription) {
		subscription = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(key)
		});
		state = 'recréé';
	}
	await sendToServer(subscription);
	return state;
}

/** À appeler depuis un geste de l'utilisateur (appui sur « Activer les rappels »). */
export async function enableReminders(): Promise<SyncState> {
	const permission = await Notification.requestPermission();
	if (permission !== 'granted') return 'inactif';
	return syncSubscription();
}

export async function sendTest(): Promise<{ sent: number; total: number }> {
	const response = await fetch('/api/push/test', { method: 'POST' });
	if (!response.ok) throw new Error(`Envoi refusé (${response.status})`);
	return response.json();
}

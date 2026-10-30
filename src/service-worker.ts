/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: unknown[] };
const sw = self;

// Jeton requis par injectManifest (remplacé au build) ; aucune mise en cache en phase 0.
console.debug('[sw] ressources du build :', self.__WB_MANIFEST.length);

sw.addEventListener('install', () => {
	void sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(sw.clients.claim());
});

interface PushPayload {
	title?: string;
	body?: string;
	url?: string;
}

sw.addEventListener('push', (event) => {
	let data: PushPayload = {};
	try {
		data = event.data?.json() ?? {};
	} catch {
		data = { body: event.data?.text() };
	}
	// iOS exige qu'une notification soit affichée à chaque push reçu.
	event.waitUntil(
		sw.registration.showNotification(data.title ?? 'Aquarium', {
			body: data.body ?? '',
			icon: '/pwa-192x192.png',
			badge: '/pwa-64x64.png',
			data: { url: data.url ?? '/' }
		})
	);
});

sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url: string = event.notification.data?.url ?? '/';
	event.waitUntil(
		sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
			for (const client of windows) {
				if ('focus' in client) return client.focus();
			}
			return sw.clients.openWindow(url);
		})
	);
});

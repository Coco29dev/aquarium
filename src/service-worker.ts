/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & {
	__WB_MANIFEST: { url: string; revision: string | null }[];
};
const sw = self;

// Ressources du build (JS, CSS, icônes) : disponibles hors ligne.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Pages : réseau d'abord (la session est vérifiée par le serveur), cache en secours.
// Hors ligne sur une page jamais chargée en entier : retour à l'écran d'accueil, qui est en cache.
const pages = new NetworkFirst({
	cacheName: 'pages',
	networkTimeoutSeconds: 3,
	plugins: [
		{
			cacheWillUpdate: async ({ response }) =>
				response.status === 200 && !response.redirected && response.type !== 'opaqueredirect'
					? response
					: null
		}
	]
});

registerRoute(
	({ request, url }) =>
		request.mode === 'navigate' && url.pathname !== '/login' && !url.pathname.startsWith('/api/'),
	async (options) => {
		try {
			return await pages.handle(options);
		} catch {
			const home = await caches.match('/', { cacheName: 'pages' });
			if (home && new URL(options.request.url).pathname === '/') return home;
			return Response.redirect('/', 302);
		}
	}
);

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
	/** Nombre de tâches dues : pastille rouge sur l'icône (PWA installée, iOS 16.4+). */
	badge?: number;
}

type BadgeNavigator = { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

async function updateBadge(count: unknown): Promise<void> {
	if (typeof count !== 'number' || !Number.isFinite(count)) return;
	const nav = sw.navigator as unknown as BadgeNavigator;
	try {
		if (count > 0) await nav.setAppBadge?.(Math.round(count));
		else await nav.clearAppBadge?.();
	} catch {
		// Pastille indisponible : la notification reste affichée.
	}
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
		Promise.all([
			sw.registration.showNotification(data.title ?? 'Aquarium', {
				body: data.body ?? '',
				icon: '/pwa-192x192.png',
				badge: '/pwa-64x64.png',
				data: { url: data.url ?? '/' }
			}),
			updateBadge(data.badge)
		])
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

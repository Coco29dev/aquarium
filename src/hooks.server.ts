import { json, redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { ensureSchema } from '$lib/server/db';
import { SESSION_COOKIE, verifySessionToken } from '$lib/server/session';

export const init: ServerInit = async () => {
	await ensureSchema();
};

// Ressources nécessaires avant connexion : page de login, assets, manifeste, service worker, icônes.
const PUBLIC_EXACT = new Set([
	'/health',
	'/login',
	'/manifest.webmanifest',
	'/service-worker.js',
	'/favicon.ico',
	'/icon.svg',
	'/robots.txt'
]);
const PUBLIC_PREFIXES = ['/_app/', '/workbox-'];
const PUBLIC_ICON = /^\/(pwa-\d+x\d+|maskable-icon-\d+x\d+|apple-touch-icon-\d+x\d+)\.png$/;

function isPublic(pathname: string): boolean {
	return (
		PUBLIC_EXACT.has(pathname) ||
		PUBLIC_ICON.test(pathname) ||
		PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
	);
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.authenticated = verifySessionToken(event.cookies.get(SESSION_COOKIE));

	if (!event.locals.authenticated && !isPublic(event.url.pathname)) {
		// Aucune route d'API ne répond sans session.
		if (event.url.pathname.startsWith('/api/')) {
			return json({ error: 'Non autorisé' }, { status: 401 });
		}
		redirect(303, '/login');
	}

	return resolve(event);
};

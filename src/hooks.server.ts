import { json, redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { migrate } from '$lib/server/db';
import { seedCore, seedSpecies } from '$lib/server/species';
import { syncSpeciesPhotos } from '$lib/server/species-photos';
import { startScheduler } from '$lib/server/scheduler';
import { SESSION_COOKIE, verifySessionToken } from '$lib/server/session';
import { recordTokenFailure, recordTokenSuccess, tokenLockRemaining, verifyToken } from '$lib/server/tokens';

export const init: ServerInit = async () => {
	await migrate();
	await seedSpecies();
	await seedCore();
	// Copie des photos en tâche de fond : ne retarde pas le démarrage.
	void syncSpeciesPhotos().catch((error) => console.error('[photos]', error));
	startScheduler();
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

/** Adresse du client : en-tête du proxy (Railway) si présent, sinon l'adresse de la connexion. */
function clientIp(event: Parameters<Handle>[0]['event']): string {
	const forwarded = event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
	if (forwarded) return forwarded;
	try {
		return event.getClientAddress();
	} catch {
		return 'inconnue';
	}
}

const shortcutReply = (message: string, status: number) => json({ ok: false, message }, { status });

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.authenticated = verifySessionToken(event.cookies.get(SESSION_COOKIE));

	// Raccourcis Siri / bouton Action : un jeton `Authorization: Bearer aq_…` suffit, sur /api/shortcuts/* uniquement.
	const authorization = event.request.headers.get('authorization');
	if (!event.locals.authenticated && event.url.pathname.startsWith('/api/shortcuts/') && authorization?.startsWith('Bearer ')) {
		const ip = clientIp(event);
		const locked = tokenLockRemaining(ip);
		if (locked > 0) return shortcutReply(`Trop d'essais. Réessaie dans ${locked} secondes.`, 429);
		if ((await verifyToken(authorization.slice(7).trim())) === null) {
			recordTokenFailure(ip);
			return shortcutReply('Jeton invalide ou révoqué. Crée-en un autre dans Réglages, Raccourcis.', 401);
		}
		recordTokenSuccess(ip);
		event.locals.shortcut = true;
		return resolve(event);
	}

	if (!event.locals.authenticated && !isPublic(event.url.pathname)) {
		// Aucune route d'API ne répond sans session.
		if (event.url.pathname.startsWith('/api/shortcuts/')) {
			return shortcutReply('Non autorisé : ajoute l’en-tête Authorization: Bearer avec ton jeton.', 401);
		}
		if (event.url.pathname.startsWith('/api/')) {
			return json({ error: 'Non autorisé' }, { status: 401 });
		}
		redirect(303, '/login');
	}

	return resolve(event);
};

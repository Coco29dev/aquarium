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

/**
 * Adresse du client telle que la voit SvelteKit. Derrière Railway, ADDRESS_HEADER=x-forwarded-for et
 * XFF_DEPTH=1 donnent l'adresse ajoutée par le proxy ; on ne lit jamais l'en-tête brut, que le client
 * peut falsifier pour échapper au freinage.
 */
function clientIp(event: Parameters<Handle>[0]['event']): string {
	try {
		return event.getClientAddress();
	} catch {
		return 'inconnue';
	}
}

// Taille maximale d'un corps de requête : la restauration d'un export complet et l'envoi d'une photo
// font exception, le reste de l'API n'a besoin que de quelques Ko.
const BODY_LIMIT_DEFAULT = 2 * 1024 * 1024;
const BODY_LIMIT_PHOTO = 7 * 1024 * 1024;

function bodyLimit(pathname: string): number {
	if (pathname.startsWith('/api/restore')) return Infinity;
	if (pathname === '/api/photos') return BODY_LIMIT_PHOTO;
	return BODY_LIMIT_DEFAULT;
}

const shortcutReply = (message: string, status: number) => json({ ok: false, message }, { status });

export const handle: Handle = async ({ event, resolve }) => {
	const declared = Number(event.request.headers.get('content-length') ?? 0);
	if (declared > bodyLimit(event.url.pathname)) return json({ error: 'Requête trop volumineuse' }, { status: 413 });
	const response = await authenticate(event, resolve);
	return withSecurityHeaders(response);
};

const SECURITY_HEADERS: Record<string, string> = {
	'x-content-type-options': 'nosniff',
	'referrer-policy': 'same-origin',
	'x-frame-options': 'DENY',
	'permissions-policy': 'camera=(), microphone=(), geolocation=()',
	'strict-transport-security': 'max-age=31536000'
};

function withSecurityHeaders(response: Response): Response {
	try {
		for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
			if (!response.headers.has(name)) response.headers.set(name, value);
		}
		return response;
	} catch {
		// En-têtes en lecture seule (réponse issue d'un fetch) : on recopie la réponse.
		const copy = new Response(response.body, response);
		for (const [name, value] of Object.entries(SECURITY_HEADERS)) if (!copy.headers.has(name)) copy.headers.set(name, value);
		return copy;
	}
}

const authenticate = async (event: Parameters<Handle>[0]['event'], resolve: Parameters<Handle>[0]['resolve']) => {
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

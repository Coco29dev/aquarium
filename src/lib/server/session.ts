import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

export const SESSION_COOKIE = 'aquarium_session';
// 90 jours : une seule personne, un seul téléphone, on évite de redemander le mot de passe.
export const SESSION_MAX_AGE = 60 * 60 * 24 * 90;

function password(): string {
	const value = env.APP_PASSWORD;
	if (!value) throw new Error('APP_PASSWORD est absent : définissez-le dans .env ou les variables Railway.');
	return value;
}

function sign(payload: string): string {
	// La clé dérive du mot de passe : le changer invalide toutes les sessions existantes.
	const key = createHash('sha256').update(`session:${password()}`).digest();
	return createHmac('sha256', key).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
	const ha = createHash('sha256').update(a).digest();
	const hb = createHash('sha256').update(b).digest();
	return timingSafeEqual(ha, hb);
}

export function createSessionToken(nowMs = Date.now()): string {
	const expires = Math.floor(nowMs / 1000) + SESSION_MAX_AGE;
	return `${expires}.${sign(String(expires))}`;
}

export function verifySessionToken(token: string | undefined, nowMs = Date.now()): boolean {
	if (!token) return false;
	const [expires, signature] = token.split('.');
	if (!expires || !signature) return false;
	if (!safeEqual(signature, sign(expires))) return false;
	return Number(expires) > Math.floor(nowMs / 1000);
}

export function checkPassword(candidate: string): boolean {
	return safeEqual(candidate, password());
}

// Freinage des essais, par client (adresse IP vue par le serveur) : quelqu'un d'autre qui tape de
// mauvais mots de passe ne bloque pas ta propre connexion. Derrière le proxy Railway, définir
// ADDRESS_HEADER=x-forwarded-for et XFF_DEPTH=1 pour que l'adresse soit celle du visiteur ;
// sans cela, tout le monde partage l'adresse du proxy et le freinage reste global.
interface Attempts {
	failures: number;
	lockedUntil: number;
}
const attempts = new Map<string, Attempts>();
const MAX_TRACKED = 1000;

export function loginLockRemainingSeconds(client = 'global', nowMs = Date.now()): number {
	return Math.max(0, Math.ceil(((attempts.get(client)?.lockedUntil ?? 0) - nowMs) / 1000));
}

export function recordLoginFailure(client = 'global', nowMs = Date.now()): void {
	if (attempts.size >= MAX_TRACKED) {
		for (const [key, value] of attempts) if (value.lockedUntil < nowMs) attempts.delete(key);
		if (attempts.size >= MAX_TRACKED) attempts.clear();
	}
	const entry = attempts.get(client) ?? { failures: 0, lockedUntil: 0 };
	entry.failures += 1;
	if (entry.failures >= 5) {
		const delay = Math.min(15 * 60, 30 * 2 ** (entry.failures - 5));
		entry.lockedUntil = nowMs + delay * 1000;
	}
	attempts.set(client, entry);
}

export function recordLoginSuccess(client = 'global'): void {
	attempts.delete(client);
}

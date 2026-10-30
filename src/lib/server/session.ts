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

// Freinage des essais : compteur global (un seul utilisateur), pas par adresse IP.
let failures = 0;
let lockedUntil = 0;

export function loginLockRemainingSeconds(nowMs = Date.now()): number {
	return Math.max(0, Math.ceil((lockedUntil - nowMs) / 1000));
}

export function recordLoginFailure(nowMs = Date.now()): void {
	failures += 1;
	if (failures >= 5) {
		const delay = Math.min(15 * 60, 30 * 2 ** (failures - 5));
		lockedUntil = nowMs + delay * 1000;
	}
}

export function recordLoginSuccess(): void {
	failures = 0;
	lockedUntil = 0;
}

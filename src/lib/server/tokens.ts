import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { db } from './db';
import type { ShortcutToken } from '$lib/types';

// Jetons d'accès des raccourcis (Siri, bouton Action). Seule l'empreinte SHA-256 est stockée ; le jeton
// n'est montré qu'à la création et ne doit jamais être journalisé. Valable sur /api/shortcuts/* uniquement.

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export async function listTokens(): Promise<ShortcutToken[]> {
	const { rows } = await db().query<ShortcutToken>(
		`SELECT id, label, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt",
		        to_char(last_used_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "lastUsedAt"
		 FROM api_tokens WHERE revoked_at IS NULL ORDER BY id`
	);
	return rows;
}

export async function createToken(label: string): Promise<{ id: number; token: string }> {
	const clean = label.trim();
	if (!clean || clean.length > 60) error(400, 'Donne un nom au raccourci (60 caractères au plus).');
	const { rows: active } = await db().query<{ n: string }>('SELECT count(*) AS n FROM api_tokens WHERE revoked_at IS NULL');
	if (Number(active[0].n) >= 20) error(400, 'Vingt jetons actifs au plus : révoque-en un avant d’en créer un autre.');
	const token = `aq_${randomBytes(32).toString('base64url')}`;
	const { rows } = await db().query<{ id: number }>('INSERT INTO api_tokens (label, token_hash) VALUES ($1, $2) RETURNING id', [
		clean,
		hash(token)
	]);
	return { id: rows[0].id, token };
}

export async function revokeToken(id: number): Promise<void> {
	const { rowCount } = await db().query('UPDATE api_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [id]);
	if (!rowCount) error(404, 'Jeton introuvable');
}

/**
 * Vérifie un jeton. Compare en temps constant avec tous les jetons actifs (il y en a peu),
 * sans s'arrêter au premier. Renvoie l'id du jeton, ou null. Met à jour last_used_at.
 */
export async function verifyToken(token: string): Promise<number | null> {
	if (!/^aq_[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
	const wanted = Buffer.from(hash(token), 'hex');
	const { rows } = await db().query<{ id: number; token_hash: string }>('SELECT id, token_hash FROM api_tokens WHERE revoked_at IS NULL');
	let found: number | null = null;
	for (const row of rows) {
		const candidate = Buffer.from(row.token_hash, 'hex');
		if (candidate.length === wanted.length && timingSafeEqual(candidate, wanted)) found = row.id;
	}
	if (found !== null) await db().query('UPDATE api_tokens SET last_used_at = now() WHERE id = $1', [found]);
	return found;
}

// --- Freinage des essais de jeton invalide : par adresse, 5 essais gratuits puis délai croissant. ---

interface Attempts {
	failures: number;
	lockedUntil: number;
}
const attempts = new Map<string, Attempts>();
const FREE_TRIES = 5;
const MAX_DELAY_S = 15 * 60;

/** Délai de blocage (secondes) après `failures` échecs : 0 jusqu'à 5, puis 30 s, 60 s… plafonné à 15 min. */
export function lockDelaySeconds(failures: number): number {
	if (failures < FREE_TRIES) return 0;
	return Math.min(MAX_DELAY_S, 30 * 2 ** (failures - FREE_TRIES));
}

export function tokenLockRemaining(ip: string, nowMs = Date.now()): number {
	const a = attempts.get(ip);
	return a ? Math.max(0, Math.ceil((a.lockedUntil - nowMs) / 1000)) : 0;
}

export function recordTokenFailure(ip: string, nowMs = Date.now()): void {
	if (attempts.size > 5000) attempts.clear(); // garde-fou mémoire
	const a = attempts.get(ip) ?? { failures: 0, lockedUntil: 0 };
	a.failures += 1;
	a.lockedUntil = nowMs + lockDelaySeconds(a.failures) * 1000;
	attempts.set(ip, a);
}

export function recordTokenSuccess(ip: string): void {
	attempts.delete(ip);
}

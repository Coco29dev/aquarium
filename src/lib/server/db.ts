import pg from 'pg';
import { env } from '$env/dynamic/private';

let pool: pg.Pool | undefined;

export function db(): pg.Pool {
	if (!pool) {
		if (!env.DATABASE_URL) throw new Error('DATABASE_URL est absent.');
		pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 5 });
	}
	return pool;
}

// Phase 0 : une seule table, créée au démarrage. Un outil de migrations sera
// proposé avant la phase 1 (voir CLAUDE.md), il remplacera cette fonction.
export async function ensureSchema(): Promise<void> {
	await db().query(`
		CREATE TABLE IF NOT EXISTS push_subscriptions (
			id              BIGSERIAL PRIMARY KEY,
			endpoint        TEXT NOT NULL UNIQUE,
			p256dh          TEXT NOT NULL,
			auth            TEXT NOT NULL,
			user_agent      TEXT,
			created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
			last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
			last_success_at TIMESTAMPTZ,
			last_error      TEXT
		)
	`);
}

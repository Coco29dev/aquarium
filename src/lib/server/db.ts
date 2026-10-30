import path from 'node:path';
import pg from 'pg';
import { runner } from 'node-pg-migrate';
import { env } from '$env/dynamic/private';

// numeric → number, date → 'YYYY-MM-DD' (sinon pg renvoie des Date à minuit local).
pg.types.setTypeParser(1700, (value) => parseFloat(value));
pg.types.setTypeParser(1082, (value) => value);

let pool: pg.Pool | undefined;

export function db(): pg.Pool {
	if (!pool) {
		if (!env.DATABASE_URL) throw new Error('DATABASE_URL est absent.');
		pool = new pg.Pool({
			connectionString: env.DATABASE_URL,
			max: 5,
			idleTimeoutMillis: 30_000,
			statement_timeout: 30_000
		});
		// Sans écouteur, une connexion inactive coupée (redémarrage de la base) ferait tomber le processus.
		pool.on('error', (error) => console.error('[db] connexion inactive perdue :', error.message));
	}
	return pool;
}

/** Applique les migrations en attente (dossier migrations/, table pgmigrations). */
export async function migrate(): Promise<void> {
	if (!env.DATABASE_URL) throw new Error('DATABASE_URL est absent.');
	await runner({
		databaseUrl: env.DATABASE_URL,
		dir: path.resolve('migrations'),
		direction: 'up',
		migrationsTable: 'pgmigrations',
		log: (message) => console.log('[migrations]', message)
	});
}

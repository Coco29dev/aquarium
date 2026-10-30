import Dexie, { type Table } from 'dexie';
import type { SyncOp } from '$lib/types';

export type OutboxItem = SyncOp & { seq?: number };

// Cache local uniquement : le serveur reste la source de vérité.
class LocalDb extends Dexie {
	kv!: Table<{ key: string; value: unknown }, string>;
	outbox!: Table<OutboxItem, number>;

	constructor() {
		super('aquarium');
		this.version(1).stores({ kv: 'key', outbox: '++seq, &clientId' });
	}
}

export const localDb = new LocalDb();

import { localDb, type OutboxItem } from './db';
import { nextDueAfter } from '$lib/domain/tasks';
import type { Measurement, Snapshot, SyncOp, Task } from '$lib/types';

const SNAPSHOT_KEY = 'snapshot';

class AppStore {
	snapshot = $state<Snapshot | null>(null);
	pending = $state<OutboxItem[]>([]);
	loaded = $state(false);
	syncing = $state(false);
	error = $state('');
	lastSync = $state<string | null>(null);

	/** Données affichées : état serveur + saisies encore dans la file d'envoi. */
	view = $derived.by(() => {
		const base = this.snapshot;
		if (!base) return null;
		const measurements: Measurement[] = [...base.measurements];
		let tasks: Task[] = base.tasks;
		for (const op of this.pending) {
			if (op.type === 'measurement') {
				measurements.push({
					parameterId: op.parameterId,
					aquariumId: op.aquariumId,
					value: op.value,
					measuredAt: op.measuredAt,
					clientId: op.clientId
				});
			} else {
				tasks = tasks.map((t) => {
					if (t.id !== op.taskId) return t;
					const next = nextDueAfter(op.doneAt, t.everyDays);
					return next > t.nextDue ? { ...t, nextDue: next } : t;
				});
			}
		}
		measurements.sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
		return { ...base, measurements, tasks };
	});

	#started = false;
	#again = false;

	async init() {
		if (this.#started) return;
		this.#started = true;
		try {
			const cached = await localDb.kv.get(SNAPSHOT_KEY);
			if (cached) this.snapshot = cached.value as Snapshot;
			this.pending = await localDb.outbox.toArray();
		} catch {
			// IndexedDB indisponible ou purgé : on repart du serveur.
		}
		this.loaded = true;
		window.addEventListener('online', () => void this.sync());
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') void this.sync();
		});
		await this.sync();
	}

	/** Envoie la file d'envoi puis récupère l'état frais. Sans réseau, ne change rien. */
	async sync() {
		if (this.syncing) {
			this.#again = true;
			return;
		}
		this.syncing = true;
		try {
			const sent = [...this.pending];
			const response = await fetch('/api/sync', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ ops: sent.map(({ seq: _seq, ...op }) => op) })
			});
			if (response.status === 401) {
				location.href = '/login';
				return;
			}
			if (!response.ok) throw new Error(`Synchronisation refusée (${response.status})`);
			const snapshot = (await response.json()) as Snapshot;
			const seqs = new Set(sent.map((o) => o.seq));
			this.pending = this.pending.filter((o) => !seqs.has(o.seq));
			this.snapshot = snapshot;
			this.error = '';
			this.lastSync = snapshot.generatedAt;
			try {
				await localDb.transaction('rw', localDb.kv, localDb.outbox, async () => {
					await localDb.outbox.bulkDelete([...seqs].filter((s): s is number => s != null));
					await localDb.kv.put({ key: SNAPSHOT_KEY, value: snapshot });
				});
			} catch {
				// Cache indisponible : sans conséquence, le serveur a tout.
			}
		} catch (e) {
			this.error = navigator.onLine ? (e as Error).message : '';
		} finally {
			this.syncing = false;
			if (this.#again) {
				this.#again = false;
				void this.sync();
			}
		}
	}

	async #enqueue(ops: SyncOp[]) {
		const items: OutboxItem[] = ops.map((op) => ({ ...op }));
		try {
			for (const item of items) item.seq = (await localDb.outbox.add(item)) as number;
		} catch {
			// Sans IndexedDB la saisie reste en mémoire jusqu'à la prochaine synchronisation.
		}
		this.pending = [...this.pending, ...items];
		void this.sync();
	}

	async addMeasurements(aquariumId: number, values: { parameterId: number; value: number }[]) {
		const measuredAt = new Date().toISOString();
		await this.#enqueue(
			values.map((v) => ({
				type: 'measurement' as const,
				clientId: crypto.randomUUID(),
				aquariumId,
				parameterId: v.parameterId,
				value: v.value,
				measuredAt
			}))
		);
	}

	async completeTask(taskId: number, note?: string) {
		await this.#enqueue([
			{ type: 'completion', clientId: crypto.randomUUID(), taskId, doneAt: new Date().toISOString(), note }
		]);
	}

	/** Modifications de configuration (aquariums, paramètres, tâches) : réseau requis. */
	async mutate(method: 'POST' | 'PATCH' | 'DELETE', url: string, body?: unknown): Promise<Response> {
		if (!navigator.onLine) throw new Error('Connexion requise pour modifier la configuration.');
		const response = await fetch(url, {
			method,
			headers: { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		});
		if (!response.ok) {
			const detail = await response.json().catch(() => null);
			throw new Error(detail?.message ?? `Erreur ${response.status}`);
		}
		await this.sync();
		return response;
	}
}

export const store = new AppStore();

import { localDb, type OutboxItem } from './db';
import { nextDueAfter } from '$lib/domain/tasks';
import { addDays, dayInParis } from '$lib/domain/dates';
import { skipDue } from '$lib/domain/notifications';
import { validateEventPayload } from '$lib/domain/events';
import type { AquariumEvent, BackupStatus, Completion, EventKind, Measurement, NotificationSettings, Snapshot, SyncOp, Task } from '$lib/types';

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
		const completions: Completion[] = [...(base.completions ?? [])];
		const events: AquariumEvent[] = [...(base.events ?? [])];
		for (const op of this.pending) {
			if (op.type === 'measurement') {
				measurements.push({
					parameterId: op.parameterId,
					aquariumId: op.aquariumId,
					value: op.value,
					measuredAt: op.measuredAt,
					clientId: op.clientId
				});
			} else if (op.type === 'event') {
				events.push({
					aquariumId: op.aquariumId,
					kind: op.kind,
					at: op.at,
					payload: op.payload,
					note: op.note ?? null,
					source: 'manuel',
					clientId: op.clientId
				});
			} else if (op.type === 'completion') {
				completions.push({ taskId: op.taskId, doneAt: op.doneAt, note: op.note });
				// Cocher une tâche « eau » laisse tout de suite un changement d'eau dans le journal (comme le serveur le fera).
				const done = base.tasks.find((t) => t.id === op.taskId);
				if (done?.kind === 'eau') {
					events.push({
						aquariumId: done.aquariumId,
						kind: 'changement_eau',
						at: op.doneAt,
						payload: {},
						note: op.note ?? null,
						source: 'tache',
						clientId: op.clientId
					});
				}
				tasks = tasks.map((t) => {
					if (t.id !== op.taskId) return t;
					const next = nextDueAfter(op.doneAt, t.everyDays);
					return next > t.nextDue ? { ...t, nextDue: next } : t;
				});
			}
		}
		measurements.sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
		completions.sort((a, b) => a.doneAt.localeCompare(b.doneAt));
		events.sort((a, b) => a.at.localeCompare(b.at));
		return { ...base, measurements, tasks, completions, events };
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

	/** Mesures d'un bac ; measuredAt (ISO) par défaut maintenant, jamais plus de 5 min dans le futur. */
	async addMeasurements(aquariumId: number, values: { parameterId: number; value: number }[], measuredAt?: string) {
		const at = measuredAt ? new Date(measuredAt) : new Date();
		if (Number.isNaN(at.getTime())) throw new Error('Date de mesure invalide.');
		if (at.getTime() > Date.now() + 5 * 60 * 1000) throw new Error('La date de mesure est dans le futur.');
		measuredAt = at.toISOString();
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

	/**
	 * Ajoute un événement au journal d'un bac (changement d'eau, dosage, réglage…). Passe par la file
	 * d'envoi : fonctionne hors ligne et apparaît tout de suite dans `view.events`. Lève une Error
	 * en français si le détail est invalide ou la date dans le futur.
	 */
	async addEvent(
		aquariumId: number,
		kind: EventKind,
		payload: Record<string, unknown> = {},
		opts?: { note?: string; at?: string }
	): Promise<void> {
		const problem = validateEventPayload(kind, payload);
		if (problem) throw new Error(problem);
		const at = opts?.at ?? new Date().toISOString();
		if (Number.isNaN(Date.parse(at))) throw new Error('Date invalide.');
		if (Date.parse(at) > Date.now() + 5 * 60 * 1000) throw new Error("La date de l'événement est dans le futur.");
		await this.#enqueue([
			{
				type: 'event',
				clientId: crypto.randomUUID(),
				aquariumId,
				kind,
				at: new Date(at).toISOString(),
				payload,
				note: opts?.note?.trim() || undefined
			}
		]);
	}

	/** Corrige un événement déjà envoyé (date, détails selon son type, note). Réseau requis. */
	async updateEvent(id: number, patch: { at?: string; payload?: Record<string, unknown>; note?: string | null }) {
		await this.mutate('PATCH', `/api/events/${id}`, patch);
	}

	/** Supprime un événement déjà envoyé. Réseau requis. */
	async deleteEvent(id: number) {
		await this.mutate('DELETE', `/api/events/${id}`);
	}

	/** Corrige une mesure déjà envoyée (valeur et/ou date ISO). Réseau requis. */
	async updateMeasurement(id: number, patch: { value?: number; measuredAt?: string }) {
		await this.mutate('PATCH', `/api/measurements/${id}`, patch);
	}

	/** Supprime une mesure déjà envoyée. Réseau requis. */
	async deleteMeasurement(id: number) {
		await this.mutate('DELETE', `/api/measurements/${id}`);
	}

	/** Reporte une tâche : prochaine échéance = aujourd'hui + days. */
	async postponeTask(taskId: number, days: number) {
		await this.mutate('PATCH', `/api/tasks/${taskId}`, { nextDue: addDays(dayInParis(), days) });
	}

	/** « Ignorer cette fois » : un cycle plus loin, sans réalisation enregistrée. */
	async skipTask(taskId: number) {
		const task = this.snapshot?.tasks.find((t) => t.id === taskId);
		if (!task) throw new Error('Tâche introuvable.');
		await this.mutate('PATCH', `/api/tasks/${taskId}`, { nextDue: skipDue(task.nextDue, dayInParis(), task.everyDays, addDays) });
	}

	/** Nouvel ordre des paramètres d'un bac (tous ses ids) ; la vue change tout de suite. */
	async reorderParameters(aquariumId: number, ids: number[]) {
		const previous = this.snapshot;
		if (previous) {
			const rank = new Map(ids.map((id, i) => [id, i]));
			const parameters = previous.parameters
				.map((p) => (p.aquariumId === aquariumId && rank.has(p.id) ? { ...p, position: rank.get(p.id)! } : p))
				.sort((a, b) => a.aquariumId - b.aquariumId || a.position - b.position || a.id - b.id);
			this.snapshot = { ...previous, parameters };
		}
		try {
			await this.mutate('PUT', `/api/aquariums/${aquariumId}/parameters/order`, { ids });
		} catch (e) {
			if (previous) this.snapshot = previous;
			throw e;
		}
	}

	async fetchNotificationSettings(): Promise<NotificationSettings> {
		return (await this.#json('GET', '/api/settings/notifications')) as NotificationSettings;
	}

	async saveNotificationSettings(settings: NotificationSettings): Promise<NotificationSettings> {
		return (await this.#json('PUT', '/api/settings/notifications', settings)) as NotificationSettings;
	}

	async fetchBackup(): Promise<BackupStatus> {
		return (await this.#json('GET', '/api/settings/backup')) as BackupStatus;
	}

	/** Lance une sauvegarde tout de suite. */
	async runBackup(): Promise<BackupStatus> {
		return (await this.#json('POST', '/api/settings/backup')) as BackupStatus;
	}

	async #json(method: string, url: string, body?: unknown): Promise<unknown> {
		if (!navigator.onLine) throw new Error('Connexion requise.');
		const response = await fetch(url, {
			method,
			headers: body === undefined ? undefined : { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		});
		if (response.status === 401) {
			location.href = '/login';
			throw new Error('Session expirée');
		}
		if (!response.ok) {
			const detail = await response.json().catch(() => null);
			throw new Error(detail?.message ?? `Erreur ${response.status}`);
		}
		return response.json();
	}

	/** Modifications de configuration (aquariums, paramètres, tâches) : réseau requis. */
	async mutate(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, body?: unknown): Promise<Response> {
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

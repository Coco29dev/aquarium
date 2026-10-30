import { localDb, type OutboxItem } from './db';
import { nextDueAfter } from '$lib/domain/tasks';
import { addDays, dayInParis } from '$lib/domain/dates';
import { skipDue } from '$lib/domain/notifications';
import { validateEventPayload } from '$lib/domain/events';
import type {
	AquariumEvent,
	AquariumStage,
	BackupListItem,
	BackupStatus,
	Completion,
	EventKind,
	Feeding,
	Measurement,
	NotificationSettings,
	RestorePreview,
	RestoreResult,
	ShortcutToken,
	Snapshot,
	SyncOp,
	Task
} from '$lib/types';

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
		const feedings: Feeding[] = [...(base.feedings ?? [])];
		for (const op of this.pending) {
			if (op.type === 'measurement') {
				measurements.push({
					parameterId: op.parameterId,
					aquariumId: op.aquariumId,
					value: op.value,
					measuredAt: op.measuredAt,
					clientId: op.clientId
				});
			} else if (op.type === 'feeding') {
				feedings.push({ aquariumId: op.aquariumId, fedAt: op.fedAt, note: op.note ?? null, clientId: op.clientId });
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
		feedings.sort((a, b) => a.fedAt.localeCompare(b.fedAt));
		return { ...base, measurements, tasks, completions, events, feedings };
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
			// Par lots de 500 (limite du serveur) ; le reste part à la synchronisation suivante.
			const sent = this.pending.slice(0, 500);
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
			if (this.pending.length > 0) this.#again = true;
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
	/**
	 * Change l'étape d'un bac : projet → cyclage (mise en eau), cyclage → actif, actif → cyclage (nouveau cyclage).
	 * `startedOn` (YYYY-MM-DD) fixe la date de mise en eau ; réseau requis.
	 */
	async setStage(aquariumId: number, stage: AquariumStage, startedOn?: string) {
		await this.mutate('POST', `/api/aquariums/${aquariumId}/stage`, { stage, startedOn });
	}

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
	// --- Nourrissage -----------------------------------------------------------

	/** Note un repas maintenant (file d'attente hors ligne ; apparaît tout de suite dans `view.feedings`). */
	async addFeeding(aquariumId: number, note?: string): Promise<void> {
		await this.#enqueue([
			{
				type: 'feeding',
				clientId: crypto.randomUUID(),
				aquariumId,
				fedAt: new Date().toISOString(),
				note: note?.trim() || undefined
			}
		]);
	}

	/** Supprime un repas déjà enregistré par le serveur (réseau requis). */
	async deleteFeeding(id: number): Promise<void> {
		await this.mutate('DELETE', `/api/feedings/${id}`);
	}

	// --- Appels JSON hors configuration (restauration, jetons, minuteurs) ---------

	async #call<T>(method: 'GET' | 'POST' | 'DELETE', url: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
		if (!navigator.onLine) throw new Error('Connexion requise.');
		const response = await fetch(url, {
			method,
			headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
			body: body === undefined ? undefined : JSON.stringify(body)
		});
		const data = await response.json().catch(() => null);
		if (!response.ok) throw new Error(data?.message ?? `Erreur ${response.status}`);
		return data as T;
	}

	// --- Restauration ---------------------------------------------------------------

	/** Résume un export JSON et le teste sans rien modifier (la base reste intacte). */
	previewRestore(payload: unknown): Promise<RestorePreview> {
		return this.#call<RestorePreview>('POST', '/api/restore?dry=1', payload);
	}

	/** Remplace toutes les données par celles de l'export. Une sauvegarde de sécurité est faite avant. */
	async restore(payload: unknown): Promise<RestoreResult> {
		const result = await this.#call<RestoreResult>('POST', '/api/restore', payload, { 'x-confirm': 'restaurer' });
		await this.resetLocalCache();
		return result;
	}

	listBackups(): Promise<BackupListItem[]> {
		return this.#call<BackupListItem[]>('GET', '/api/settings/backup/list');
	}

	previewRestoreFromBackup(key: string): Promise<RestorePreview> {
		return this.#call<RestorePreview>('POST', '/api/restore/from-backup', { key, dry: true });
	}

	async restoreFromBackup(key: string): Promise<RestoreResult> {
		const result = await this.#call<RestoreResult>('POST', '/api/restore/from-backup', { key }, { 'x-confirm': 'restaurer' });
		await this.resetLocalCache();
		return result;
	}

	/** Déconnexion : efface le cache local, la file d'envoi et les pages en cache de cet appareil. */
	async clearLocalData(): Promise<void> {
		try {
			await localDb.transaction('rw', localDb.kv, localDb.outbox, async () => {
				await localDb.kv.clear();
				await localDb.outbox.clear();
			});
		} catch {
			// Cache indisponible : rien à effacer.
		}
		try {
			await caches.delete('pages');
		} catch {
			// API de cache absente (navigation privée) : ignoré.
		}
		// L'état en mémoire reste intact : la page se recharge sur /login, et le vider ici
		// démonterait le formulaire de déconnexion avant son envoi.
	}

	/** Vide le cache local (IndexedDB) et la file d'attente, puis repart de l'état du serveur. */
	async resetLocalCache(): Promise<void> {
		try {
			await localDb.transaction('rw', localDb.kv, localDb.outbox, async () => {
				await localDb.kv.clear();
				await localDb.outbox.clear();
			});
		} catch {
			// Cache indisponible : on repart quand même du serveur.
		}
		this.snapshot = null;
		this.pending = [];
		await this.sync();
	}

	// --- Raccourcis (Siri, bouton Action) --------------------------------------------

	listShortcutTokens(): Promise<ShortcutToken[]> {
		return this.#call<ShortcutToken[]>('GET', '/api/settings/shortcuts');
	}

	/** Le jeton n'est renvoyé qu'ici, une seule fois : à afficher et copier tout de suite. */
	createShortcutToken(label: string): Promise<{ id: number; token: string }> {
		return this.#call('POST', '/api/settings/shortcuts', { label });
	}

	async revokeShortcutToken(id: number): Promise<void> {
		await this.#call('DELETE', `/api/settings/shortcuts/${id}`);
	}

	// --- Minuteurs push --------------------------------------------------------------

	/** Lance un minuteur : une notification arrive à la fin, même app fermée. Perdu si le serveur redémarre. */
	startTimer(seconds: number, label: string, url?: string): Promise<{ id: number; endsAt: string }> {
		return this.#call('POST', '/api/timers', { seconds, label, url });
	}

	async cancelTimer(id: number): Promise<void> {
		await this.#call('DELETE', `/api/timers/${id}`);
	}

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

import { api } from '$lib/client/api';
import { ui } from '$lib/client/ui.svelte';
import { describeDeletion, type ThreadSummary } from '$lib/domain/assistant';

/**
 * Liste des conversations de l'assistant, partagée entre le chat (conversations récentes de l'accueil) et
 * la feuille « Conversations ». Toutes les suppressions passent ici : même alerte de confirmation, même
 * message, que l'on supprime depuis le glissement, la sélection ou le menu du chat.
 */
class Threads {
	list = $state<ThreadSummary[]>([]);
	/** 'idle' avant la première lecture ; 'ready' garde la liste affichée pendant une relecture. */
	status = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
	failure = $state('');

	async load(): Promise<void> {
		if (this.status !== 'ready') this.status = 'loading';
		try {
			this.list = await api<ThreadSummary[]>('GET', '/api/assistant/threads');
			this.failure = '';
			this.status = 'ready';
		} catch (e) {
			this.failure = e instanceof Error ? e.message : 'Chargement impossible';
			this.status = this.list.length ? 'ready' : 'error';
		}
	}

	/** Met à jour une conversation connue sans relire toute la liste (titre proposé, nouveau message…). */
	patch(id: number, fields: Partial<ThreadSummary>): void {
		this.list = this.list.map((t) => (t.id === id ? { ...t, ...fields } : t));
	}

	async rename(id: number, title: string): Promise<boolean> {
		try {
			await api('PATCH', `/api/assistant/threads/${id}`, { title });
			// Un titre vidé redonne le titre automatique : la liste le relira.
			if (title.trim()) this.patch(id, { title: title.trim().slice(0, 80) });
			else await this.load();
			return true;
		} catch (e) {
			ui.fail(e, 'Renommage impossible.');
			return false;
		}
	}

	/**
	 * Demande confirmation puis supprime les conversations avec leurs photos. Renvoie les identifiants
	 * réellement supprimés (vide si l'utilisateur annule ou si tout échoue).
	 */
	async confirmRemove(targets: ThreadSummary[]): Promise<number[]> {
		if (!targets.length) return [];
		const text = describeDeletion(targets);
		const ok = await ui.confirm({ ...text, confirmLabel: 'Supprimer', destructive: true });
		if (!ok) return [];
		try {
			const ids = targets.map((t) => t.id);
			const report = await api<{ deleted: number[]; kept: number[] }>('DELETE', '/api/assistant/threads', { ids });
			const gone = new Set(report.deleted);
			this.list = this.list.filter((t) => !gone.has(t.id));
			if (report.kept.length) {
				ui.notify({
					message: report.deleted.length
						? `${report.deleted.length} supprimée${report.deleted.length > 1 ? 's' : ''}, ${report.kept.length} gardée${report.kept.length > 1 ? 's' : ''} : réponse en cours ou photos à réessayer.`
						: 'Suppression impossible pour l’instant : réessaie dans un instant.',
					kind: 'warn',
					icon: 'alert'
				});
			} else {
				ui.show(targets.length > 1 ? `${targets.length} conversations supprimées` : 'Conversation supprimée', undefined, 'check');
			}
			return report.deleted;
		} catch (e) {
			ui.fail(e, 'Suppression impossible.');
			return [];
		}
	}
}

export const threads = new Threads();

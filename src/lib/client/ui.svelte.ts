import { store } from './store.svelte';

interface Toast {
	id: number;
	message: string;
	icon?: string;
	undo?: () => void;
}

export interface ConfirmOptions {
	title: string;
	message?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	destructive?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
	resolve: (ok: boolean) => void;
}

const UNDO_MS = 4500;

/** État d'interface partagé : bannière avec « Annuler », alertes de confirmation, tâches cochées en sursis. */
class Ui {
	toast = $state<Toast | null>(null);
	alert = $state<PendingConfirm | null>(null);
	/** Tâches cochées dont l'envoi attend la fin du délai d'annulation. */
	checking = $state<Record<number, true>>({});

	#timer: ReturnType<typeof setTimeout> | undefined;
	#pending = new Map<number, ReturnType<typeof setTimeout>>();

	/** Alerte iOS à deux boutons ; se résout à true si l'utilisateur confirme. */
	confirm(options: ConfirmOptions): Promise<boolean> {
		this.alert?.resolve(false);
		return new Promise((resolve) => {
			this.alert = {
				...options,
				resolve: (ok) => {
					this.alert = null;
					resolve(ok);
				}
			};
		});
	}

	show(message: string, undo?: () => void, icon?: string) {
		clearTimeout(this.#timer);
		this.toast = { id: Date.now(), message, undo, icon };
		this.#timer = setTimeout(() => (this.toast = null), UNDO_MS);
	}

	dismiss() {
		clearTimeout(this.#timer);
		this.toast = null;
	}

	/** Coche une tâche : visible tout de suite, envoyée après le délai d'annulation. */
	check(taskId: number, title: string) {
		if (this.checking[taskId]) return;
		this.checking[taskId] = true;
		this.#pending.set(
			taskId,
			setTimeout(() => void this.#commit(taskId), UNDO_MS)
		);
		this.show(title, () => this.uncheck(taskId), 'check');
	}

	uncheck(taskId: number) {
		clearTimeout(this.#pending.get(taskId));
		this.#pending.delete(taskId);
		delete this.checking[taskId];
		this.dismiss();
	}

	/** Envoie tout de suite ce qui attend (l'appli passe en arrière-plan). */
	flush() {
		for (const taskId of [...this.#pending.keys()]) void this.#commit(taskId);
	}

	async #commit(taskId: number) {
		clearTimeout(this.#pending.get(taskId));
		if (!this.#pending.delete(taskId)) return;
		await store.completeTask(taskId);
		delete this.checking[taskId];
	}
}

export const ui = new Ui();

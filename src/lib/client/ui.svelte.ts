import { store } from './store.svelte';

interface Toast {
	id: number;
	message: string;
	undo?: () => void;
}

const UNDO_MS = 4500;

/** État d'interface partagé : message éphémère avec « Annuler », tâches cochées en sursis. */
class Ui {
	toast = $state<Toast | null>(null);
	/** Tâches cochées dont l'envoi attend la fin du délai d'annulation. */
	checking = $state<Record<number, true>>({});

	#timer: ReturnType<typeof setTimeout> | undefined;
	#pending = new Map<number, ReturnType<typeof setTimeout>>();

	show(message: string, undo?: () => void) {
		clearTimeout(this.#timer);
		this.toast = { id: Date.now(), message, undo };
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
		this.show(`« ${title} » fait`, () => this.uncheck(taskId));
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

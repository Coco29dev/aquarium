import { store } from './store.svelte';
import { DEFAULT_PROFILE, parseProfile, type Profile } from '$lib/domain/profile';

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

export type ThemePreference = 'auto' | 'light' | 'dark';

function readTheme(): ThemePreference {
	try {
		const value = localStorage.getItem('theme');
		return value === 'light' || value === 'dark' ? value : 'auto';
	} catch {
		return 'auto';
	}
}

function readProfile(): Profile {
	try {
		return parseProfile(JSON.parse(localStorage.getItem('profile') ?? 'null'));
	} catch {
		return { ...DEFAULT_PROFILE };
	}
}

/** État d'interface partagé : bannière avec « Annuler », alertes de confirmation, tâches cochées en sursis. */
class Ui {
	toast = $state<Toast | null>(null);
	alert = $state<PendingConfirm | null>(null);
	/** Tâches cochées dont l'envoi attend la fin du délai d'annulation. */
	checking = $state<Record<number, true>>({});
	/** Apparence choisie (Réglages › Affichage) ; 'auto' suit l'iPhone. */
	theme = $state<ThemePreference>(typeof window === 'undefined' ? 'auto' : readTheme());

	setTheme(theme: ThemePreference) {
		this.theme = theme;
		try {
			if (theme === 'auto') localStorage.removeItem('theme');
			else localStorage.setItem('theme', theme);
		} catch {
			// Stockage indisponible : le choix vaut pour cette session seulement.
		}
		const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
		const root = document.documentElement;
		root.dataset.theme = theme;
		root.dataset.scheme = dark ? 'dark' : 'light';
		document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#050b0e' : '#eef3f5');
	}

	/** Profil personnel : copie locale (affichage immédiat, hors ligne), le serveur fait foi. */
	profile = $state<Profile>(typeof window === 'undefined' ? { ...DEFAULT_PROFILE } : readProfile());

	/** Récupère le profil du serveur (au lancement de l'appli) et l'applique. */
	async loadProfile() {
		try {
			const res = await fetch('/api/settings/profile');
			if (!res.ok) return;
			const remote = parseProfile(await res.json());
			// Un profil vide côté serveur ne doit pas effacer un profil local pas encore envoyé.
			const hasRemote = remote.name || remote.level || remote.interest || remote.accent !== 'lagon';
			if (hasRemote) this.#applyProfile(remote);
			else if (this.profile.name || this.profile.level || this.profile.interest || this.profile.accent !== 'lagon') void this.#sendProfile();
		} catch {
			// Hors ligne : on garde la copie locale.
		}
	}

	async setProfile(patch: Partial<Profile>) {
		this.#applyProfile(parseProfile({ ...this.profile, ...patch }));
		await this.#sendProfile();
	}

	#applyProfile(profile: Profile) {
		this.profile = profile;
		try {
			localStorage.setItem('profile', JSON.stringify(profile));
			if (profile.accent === 'lagon') localStorage.removeItem('accent');
			else localStorage.setItem('accent', profile.accent);
		} catch {
			// Stockage indisponible : le profil vaut pour cette session.
		}
		if (profile.accent === 'lagon') delete document.documentElement.dataset.accent;
		else document.documentElement.dataset.accent = profile.accent;
	}

	async #sendProfile() {
		try {
			await fetch('/api/settings/profile', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(this.profile)
			});
		} catch {
			// Renvoyé au prochain lancement tant que le serveur n'a rien.
		}
	}

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

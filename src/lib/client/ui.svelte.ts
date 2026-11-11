import { store } from './store.svelte';
import { DEFAULT_PROFILE, parseProfile, type Profile } from '$lib/domain/profile';
import { tankHealth } from '$lib/tank';
import { haptic } from '$lib/motion/haptic';
import { friendlyError, looksLikeError, measureVerdict, taskDone, type SavedValue } from '$lib/voice';
import type { Aquarium } from '$lib/types';

/**
 * Nature d'une bannière : `ok` (c'est fait), `info` (neutre), `warn` (une valeur à regarder, ton calme,
 * jamais rouge) et `error` (échec : reste plus longtemps et se ferme d'un toucher).
 */
export type ToastKind = 'ok' | 'info' | 'warn' | 'error';

export interface Toast {
	id: number;
	message: string;
	kind: ToastKind;
	icon?: string;
	undo?: () => void;
	/** Lien proposé à côté du message (le verdict d'une saisie : « Voir »). */
	action?: { label: string; href: string };
}

export interface NotifyOptions {
	message: string;
	kind?: ToastKind;
	icon?: string;
	undo?: () => void;
	action?: { label: string; href: string };
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

/** Délai d'annulation d'une tâche cochée : la bannière reste affichée pendant ce temps. */
const UNDO_MS = 4500;
/**
 * Durée d'affichage selon la nature : une confirmation s'efface vite, une erreur reste de quoi la lire
 * (au moins 8 s) et se ferme d'un toucher ; une bannière avec lien laisse le temps de le toucher.
 */
const DURATION: Record<ToastKind, number> = { ok: 3000, info: 3000, warn: 6500, error: 9000 };

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
	/** Horodatage du dernier geste de l'utilisateur qui change les anneaux du jour (tâche cochée, mesures). */
	lastAction = 0;
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

	/** Note un geste de l'utilisateur : seul un changement qui le suit de près peut être fêté. */
	noteAction() {
		this.lastAction = Date.now();
	}

	/** Affiche une bannière (une seule à la fois : la nouvelle remplace l'ancienne). */
	notify({ message, kind = 'info', icon, undo, action }: NotifyOptions) {
		clearTimeout(this.#timer);
		this.toast = { id: Date.now(), message, kind, icon, undo, action };
		const ms = undo ? Math.max(UNDO_MS, DURATION[kind]) : action ? Math.max(6500, DURATION[kind]) : DURATION[kind];
		this.#timer = setTimeout(() => (this.toast = null), ms);
	}

	/**
	 * Forme courte, conservée pour les écrans existants : `icon` 'check' = confirmation, une autre icône =
	 * information, sans icône = information… sauf si le texte dit visiblement un échec (ancienne façon de
	 * signaler une erreur avec `ui.show(error.message)`) : il est alors présenté comme une erreur.
	 */
	show(message: string, undo?: () => void, icon?: string) {
		if (!icon && !undo && looksLikeError(message)) return this.fail(message);
		this.notify({ message, undo, icon, kind: icon === 'check' ? 'ok' : 'info' });
	}

	/** Échec d'une action : phrase calme en français, bannière qui reste et se ferme d'un toucher. */
	fail(error: unknown, fallback?: string) {
		this.notify({ message: friendlyError(error, fallback), kind: 'error', icon: 'alert' });
	}

	dismiss() {
		clearTimeout(this.#timer);
		this.toast = null;
	}

	/**
	 * Ce que l'appli dit juste après une saisie de mesures : ce qui mérite un regard (lien vers le
	 * paramètre), sinon « dans la plage ». Lit la vue (file d'envoi comprise) : marche hors ligne.
	 */
	reportMeasures(aquarium: Aquarium, saved: SavedValue[], firstTime: boolean) {
		this.noteAction();
		const view = store.view;
		const health = view ? tankHealth(view, aquarium) : null;
		const verdict = measureVerdict({
			aquariumId: aquarium.id,
			saved,
			alerts: health?.alerts ?? [],
			coachTitle: health?.coach?.title ?? null,
			firstTime
		});
		haptic(verdict.level === 'ok' ? 'confirm' : 'warn');
		this.notify({
			message: verdict.message,
			kind: verdict.level === 'ok' ? 'ok' : 'warn',
			icon: verdict.level === 'ok' ? 'check' : 'alert',
			action: verdict.href ? { label: verdict.linkLabel ?? 'Voir', href: verdict.href } : undefined
		});
	}

	/** Coche une tâche : visible tout de suite, envoyée après le délai d'annulation. */
	check(taskId: number, title: string) {
		if (this.checking[taskId]) return;
		// Le retour tactile part tout de suite, dans le geste : rien n'attend l'animation ni le réseau.
		haptic('confirm');
		this.noteAction();
		this.checking[taskId] = true;
		this.#pending.set(
			taskId,
			setTimeout(() => void this.#commit(taskId), UNDO_MS)
		);
		this.notify({ message: taskDone(title), kind: 'ok', icon: 'check', undo: () => this.uncheck(taskId) });
	}

	uncheck(taskId: number) {
		haptic('tick');
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

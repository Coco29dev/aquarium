import { goto } from '$app/navigation';
import {
	FRESH_ONBOARDING,
	TOUR_STEPS,
	clampStep,
	isLastStep,
	parseOnboarding,
	resolveOnboarding,
	type OnboardingState,
	type TourStatus
} from '$lib/domain/onboarding';

const LOCAL_KEY = 'onboarding';

function readLocal(): OnboardingState | null {
	try {
		const stored = parseOnboarding(JSON.parse(localStorage.getItem(LOCAL_KEY) ?? 'null'));
		if (stored) return stored;
		// Ancien drapeau posé par l'écran d'accueil avant que l'état suive le compte.
		return localStorage.getItem('onboarded') === '1' ? { welcomeDone: true, tour: 'pending' } : null;
	} catch {
		return null;
	}
}

/**
 * Premier lancement : état « accueil vu / visite faite » (copie locale + serveur) et progression
 * de la visite guidée. Le serveur fait foi : un compte qui a fait la visite ne la revoit pas sur un
 * autre appareil ; la copie locale évite un clignotement et sert hors ligne.
 */
class Tour {
	/** Réponse du serveur reçue (ou échec réseau) : on peut décider d'afficher ou non l'accueil. */
	loaded = $state(false);
	state = $state<OnboardingState>({ ...FRESH_ONBOARDING });
	/** Étape affichée, ou null quand la visite n'est pas en cours. */
	index = $state<number | null>(null);

	#remote: OnboardingState | null = null;
	#resolved = false;

	get active(): boolean {
		return this.index !== null;
	}
	get step() {
		return this.index === null ? null : TOUR_STEPS[this.index];
	}

	/** Récupère l'état du serveur au lancement de l'appli. */
	async load() {
		try {
			const res = await fetch('/api/settings/onboarding', { signal: AbortSignal.timeout(4000) });
			if (res.ok) this.#remote = parseOnboarding(await res.json());
		} catch {
			// Hors ligne : la copie locale suffit.
		}
		this.loaded = true;
	}

	/**
	 * Fixe l'état de départ une fois les bacs connus (une seule fois par lancement). Un compte
	 * d'avant la visite guidée, qui a déjà ses bacs, est marqué comme installé sans rien lui montrer.
	 */
	resolve(tankCount: number) {
		if (this.#resolved || !this.loaded) return;
		this.#resolved = true;
		this.state = resolveOnboarding(this.#remote, readLocal(), tankCount);
		this.#save(!this.#remote);
	}

	/** L'écran d'accueil a été vu (ou passé avec « Plus tard »). */
	markWelcomeDone() {
		this.state = { ...this.state, welcomeDone: true };
		this.#save(true);
	}

	/** Lance la visite : au premier lancement (automatique) ou depuis Plus › Revoir la visite. */
	start() {
		this.index = 0;
		void this.#show(0);
	}

	next() {
		if (this.index === null) return;
		if (isLastStep(this.index)) return this.finish('done');
		this.index = clampStep(this.index + 1);
		void this.#show(this.index);
	}

	back() {
		if (this.index === null || this.index === 0) return;
		this.index = clampStep(this.index - 1);
		void this.#show(this.index);
	}

	/** Termine ou quitte la visite ; dans les deux cas elle ne se relance plus toute seule. */
	finish(status: Exclude<TourStatus, 'pending'>) {
		this.index = null;
		this.state = { welcomeDone: true, tour: status };
		this.#save(true);
	}

	/** Affiche l'écran qui correspond à l'étape (changer d'onglet montre l'écran derrière la carte). */
	async #show(index: number) {
		const route = TOUR_STEPS[index].route;
		if (route && location.pathname !== route) await goto(route);
	}

	#save(send: boolean) {
		try {
			localStorage.setItem(LOCAL_KEY, JSON.stringify(this.state));
			localStorage.setItem('onboarded', this.state.welcomeDone ? '1' : '0');
		} catch {
			// Stockage indisponible : l'état vaut pour cette session.
		}
		if (!send) return;
		void fetch('/api/settings/onboarding', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(this.state)
		}).catch(() => {
			// Hors ligne : la copie locale fait foi jusqu'au prochain lancement.
		});
	}
}

export const tour = new Tour();

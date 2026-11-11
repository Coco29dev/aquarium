// Premier lancement : état « accueil vu / visite faite » et contenu de la visite guidée.
// Fonctions pures (testées), indépendantes de l'interface : la même logique servira telle quelle
// dans une version empaquetée pour les magasins d'applications.

/** Où en est la visite guidée : à faire, terminée jusqu'au bout, ou quittée en cours de route. */
export type TourStatus = 'pending' | 'done' | 'skipped';

export interface OnboardingState {
	/** L'écran d'accueil (« Bienvenue dans Biotope ») a été vu ou passé. */
	welcomeDone: boolean;
	tour: TourStatus;
}

/** Compte neuf : rien n'a encore été montré. */
export const FRESH_ONBOARDING: OnboardingState = { welcomeDone: false, tour: 'pending' };
/** Compte déjà utilisé : on ne montre jamais l'accueil ni la visite à quelqu'un qui a déjà ses bacs. */
export const SETTLED_ONBOARDING: OnboardingState = { welcomeDone: true, tour: 'done' };

const TOUR_STATUSES: readonly TourStatus[] = ['pending', 'done', 'skipped'];

/** Lit un état venu du réseau ou du stockage local. `null` : rien d'enregistré (compte neuf). */
export function parseOnboarding(raw: unknown): OnboardingState | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	const tour = TOUR_STATUSES.find((s) => s === o.tour);
	if (!tour && typeof o.welcomeDone !== 'boolean') return null;
	return { welcomeDone: o.welcomeDone === true, tour: tour ?? 'pending' };
}

/**
 * Décide de l'état de départ une fois le serveur, la copie locale et le nombre de bacs connus.
 * Le serveur fait foi (le compte suit l'utilisateur d'un appareil à l'autre) ; la copie locale
 * sert hors ligne ; sans aucun des deux, un compte qui a déjà des bacs est considéré comme installé.
 */
export function resolveOnboarding(remote: OnboardingState | null, local: OnboardingState | null, tankCount: number): OnboardingState {
	if (remote) return remote;
	// Ni serveur ni décision locale sur la visite, mais des bacs : compte d'avant la visite guidée.
	if (tankCount > 0 && (!local || local.tour === 'pending')) return { ...SETTLED_ONBOARDING };
	return local ?? { ...FRESH_ONBOARDING };
}

export type TourIcon = 'today' | 'bacs' | 'book' | 'gear' | 'plus' | 'chat' | 'check' | 'drop';

export interface TourStep {
	id: string;
	/** Élément à mettre en lumière (attribut `data-tour`) ; absent : carte centrée, sans projecteur. */
	target?: string;
	/** Écran à afficher derrière la carte pendant cette étape. */
	route?: string;
	icon: TourIcon;
	title: string;
	text: string;
}

/**
 * Parcours en huit étapes (un thème par étape, deux phrases au plus) : l'accueil, les quatre onglets,
 * le bouton de saisie, la bulle de l'assistant, la conclusion. Ordre : du plus quotidien au plus rare.
 */
export const TOUR_STEPS: readonly TourStep[] = [
	{
		id: 'intro',
		icon: 'drop',
		title: 'Petite visite de l’appli',
		text: 'Une minute pour repérer où est quoi. Tu peux quitter quand tu veux et la revoir dans Plus.'
	},
	{
		id: 'aujourdhui',
		target: 'tab-aujourdhui',
		route: '/',
		icon: 'today',
		title: 'Aujourd’hui',
		text: 'Ton point de départ : les tâches du jour, la prochaine action et les alertes de dérive de tous tes bacs.'
	},
	{
		id: 'bacs',
		target: 'tab-bacs',
		route: '/aquariums',
		icon: 'bacs',
		title: 'Bacs',
		text: 'Un suivi par aquarium : mesures et graphes, tâches, vivants, journal. Tout ce qui concerne un bac est dans sa fiche.'
	},
	{
		id: 'assistant',
		target: 'assistant',
		route: '/aquariums',
		icon: 'chat',
		title: 'L’assistant',
		text: 'Pose une question ou envoie une photo : il connaît tes mesures. Cette bulle te suit sur la plupart des écrans.'
	},
	{
		id: 'mesurer',
		target: 'mesurer',
		route: '/aquariums',
		icon: 'plus',
		title: 'Saisir une mesure',
		text: 'Le bouton + est partout. Les dernières valeurs sont préremplies : tu ne touches que ce qui a changé, même hors ligne.'
	},
	{
		id: 'savoir',
		target: 'tab-savoir',
		route: '/encyclopedie',
		icon: 'book',
		title: 'Savoir',
		text: 'Guides pratiques, fiches d’espèces avec compatibilité, idées d’aménagement : de quoi apprendre sans chercher ailleurs.'
	},
	{
		id: 'plus',
		target: 'tab-plus',
		route: '/reglages',
		icon: 'gear',
		title: 'Plus',
		text: 'Calculateurs, dépenses, bilan de la semaine, rappels, sauvegarde et profil. C’est aussi ici que tu rejoues cette visite.'
	},
	{
		id: 'fin',
		route: '/',
		icon: 'check',
		title: 'Tu es prêt',
		text: 'Le plus utile maintenant : décrire ton premier bac. Les paramètres et leurs plages se préparent seuls.'
	}
];

export const clampStep = (index: number, total = TOUR_STEPS.length): number => Math.min(Math.max(0, Math.trunc(index) || 0), total - 1);
export const isLastStep = (index: number, total = TOUR_STEPS.length): boolean => index >= total - 1;

/** Écrans plein écran (feuilles) : pas de barre d'onglets, donc pas de visite. */
export const MODAL_PREFIXES = ['/mesurer', '/aquariums/nouveau', '/bienvenue', '/assistant'] as const;
export const TAB_ROOTS = ['/', '/aquariums', '/encyclopedie', '/reglages'] as const;

/**
 * La visite démarre toute seule sur un écran d'onglet, une fois l'accueil passé et le compte neuf :
 * jamais par-dessus un formulaire, une feuille ou un écran de détail.
 */
export function shouldAutoStartTour(state: OnboardingState, path: string): boolean {
	return state.welcomeDone && state.tour === 'pending' && (TAB_ROOTS as readonly string[]).includes(path);
}

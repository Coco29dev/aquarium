import { goto } from '$app/navigation';

// Retour « comme sur iOS » : le bouton ‹ revient à l'écran d'où l'on vient réellement (bac, fiche,
// guide…), pas à un écran fixe. Le lien d'origine ne sert que de repli quand l'appli a été ouverte
// directement sur cet écran (notification, lien enregistré), sans écran précédent dans l'appli.

const INDEX_KEY = 'sveltekit:history';
/** Écran affiché pour chaque position de l'historique (alimenté par le layout). */
const trail = new Map<number, string>();

/** Position courante dans l'historique géré par SvelteKit (0 : premier écran de la session). */
export function historyIndex(): number {
	if (typeof history === 'undefined') return 0;
	const i = (history.state as Record<string, unknown> | null)?.[INDEX_KEY];
	return typeof i === 'number' ? i : 0;
}

/** À appeler après chaque navigation : mémorise l'écran affiché à la position courante. */
export function recordScreen(path: string): void {
	trail.set(historyIndex(), path);
}

export const canGoBack = (): boolean => historyIndex() > 0;

/** Écran précédent (chemin + paramètres), s'il est connu. */
export function previousScreen(): string | null {
	return trail.get(historyIndex() - 1) ?? null;
}

const STATIC: Record<string, string> = {
	'/': 'Aujourd’hui',
	'/aquariums': 'Bacs',
	'/encyclopedie': 'Encyclopédie',
	'/encyclopedie/especes': 'Espèces',
	'/encyclopedie/idees': 'Idées',
	'/reglages': 'Plus',
	'/outils': 'Calculateurs',
	'/depenses': 'Dépenses',
	'/bilan': 'Bilan',
	'/recherche': 'Recherche',
	'/assistant': 'Assistant'
};

/** Libellé court d'un écran, pour le bouton retour. */
export function screenLabel(screen: string): string {
	const path = screen.split(/[?#]/)[0].replace(/\/$/, '') || '/';
	if (STATIC[path]) return STATIC[path];
	const tank = /^\/aquariums\/\d+(\/[^/]+)?/.exec(path);
	if (tank) {
		const sub = tank[1];
		if (!sub) return 'Bac';
		return { '/inventaire': 'Vivants', '/taches': 'Tâches', '/journal': 'Journal', '/peuplement': 'Peuplement', '/projet': 'Projet' }[sub] ?? 'Bac';
	}
	if (path.startsWith('/encyclopedie/')) return 'Guide';
	return 'Retour';
}

/** Revient à l'écran précédent ; à défaut, va au repli (sans empiler un écran de plus). */
export function goBack(fallback: string): void {
	if (canGoBack()) history.back();
	else void goto(fallback, { replaceState: true });
}

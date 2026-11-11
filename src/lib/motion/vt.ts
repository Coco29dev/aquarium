import { reducedMotion } from './reduced';

/**
 * Lance une View Transition en posant `data-nav` (le type d'animation, lu par layout.css) et d'éventuelles
 * variables CSS sur <html>, puis les retire à la fin, sans qu'une transition ancienne n'efface celles
 * d'une plus récente (double appui rapide). Sans API, ou avec « Réduire les animations », la mise à
 * jour est appliquée sans animation et la fonction renvoie null.
 */
let sequence = 0;

export function beginTransition(kind: string, update: () => unknown, vars: Record<string, string> = {}): ViewTransition | null {
	if (!document.startViewTransition || reducedMotion()) {
		void update();
		return null;
	}
	const root = document.documentElement;
	const id = ++sequence;
	root.dataset.nav = kind;
	for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value);
	const transition = document.startViewTransition(() => update());
	// Une transition abandonnée (nouvel appui, taille de l'écran qui change) rejette ces promesses : sans effet pour nous.
	transition.ready.catch(() => {});
	transition.updateCallbackDone.catch(() => {});
	transition.finished
		.catch(() => {})
		.finally(() => {
			if (id !== sequence) return;
			delete root.dataset.nav;
			for (const key of Object.keys(vars)) root.style.removeProperty(key);
		});
	return transition;
}

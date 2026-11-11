import type { Action } from 'svelte/action';

/**
 * Met en pause les mouvements d'ambiance (classe .ambient : bulles, vagues, poissons) d'un élément
 * quand il est hors de l'écran ou que l'appli passe en arrière-plan : une boucle infinie invisible
 * coûte de la batterie pour rien. La règle CSS associée est dans layout.css ([data-live='off']).
 */
export const ambient: Action<HTMLElement> = (node) => {
	let seen = true;
	const sync = () => (node.dataset.live = seen && !document.hidden ? 'on' : 'off');
	const observer = new IntersectionObserver(
		([entry]) => {
			seen = entry.isIntersecting;
			sync();
		},
		// Une marge évite le clignotement à l'entrée dans l'écran.
		{ rootMargin: '64px' }
	);
	observer.observe(node);
	document.addEventListener('visibilitychange', sync);
	sync();
	return {
		destroy() {
			observer.disconnect();
			document.removeEventListener('visibilitychange', sync);
		}
	};
};

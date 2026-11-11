import { untrack } from 'svelte';
import { reducedMotion } from './reduced';

/**
 * Garde un élément monté le temps de sa sortie animée (feuille, alerte, menu, pastille) : un `{#if}` seul
 * le retire d'un coup. À appeler à l'initialisation du composant.
 *
 *   const view = presence(() => open, 280);
 *   {#if view.rendered}<div style="animation: {view.leaving ? 'fade-out …' : 'fade-in …'}" onanimationend={view.end}>
 *
 * `leaving` vaut true pendant la sortie ; `end` (à brancher sur `animationend`) ou, au plus tard, le
 * délai de secours démonte l'élément. Avec « Réduire les animations », il est démonté tout de suite.
 */
export function presence(open: () => boolean, ms = 280) {
	let rendered = $state(untrack(open));
	let leaving = $state(false);

	$effect(() => {
		if (open()) {
			rendered = true;
			leaving = false;
			return;
		}
		if (!untrack(() => rendered)) return;
		if (reducedMotion()) {
			rendered = false;
			return;
		}
		leaving = true;
		const timer = setTimeout(() => {
			rendered = false;
			leaving = false;
		}, ms + 120);
		return () => clearTimeout(timer);
	});

	return {
		get rendered() {
			return rendered;
		},
		get leaving() {
			return leaving;
		},
		/** À brancher sur `animationend` de l'élément qui sort (ignore les animations des enfants). */
		end(event: AnimationEvent) {
			if (!leaving || event.target !== event.currentTarget) return;
			rendered = false;
			leaving = false;
		}
	};
}

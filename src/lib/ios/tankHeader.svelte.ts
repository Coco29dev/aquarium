import type { Snippet } from 'svelte';

/**
 * Actions propres à l'onglet affiché d'un bac (nouvelle tâche, photo, note…). L'écran actif les
 * dépose ici et le bandeau commun du bac (`aquariums/[id]/+layout.svelte`) les affiche.
 */
export const tankHeader = $state<{ actions: Snippet | null }>({ actions: null });

/** À appeler dans un $effect : dépose les actions, les retire quand l'écran disparaît. */
export function setTankActions(actions: Snippet): () => void {
	tankHeader.actions = actions;
	return () => {
		if (tankHeader.actions === actions) tankHeader.actions = null;
	};
}

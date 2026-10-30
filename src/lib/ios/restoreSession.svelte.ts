import type { RestoreResult } from '$lib/types';

/**
 * État d'une restauration en cours ou terminée, gardé hors du composant : à la fin de la restauration,
 * le cache local est vidé, l'appli affiche un instant son écran de chargement et la page est recréée.
 * Sans cet état partagé, elle repartirait de zéro au lieu d'afficher le résultat.
 */
export const restoreSession = $state<{ running: boolean; result: RestoreResult | null; error: string }>({
	running: false,
	result: null,
	error: ''
});

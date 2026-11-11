/** L'utilisateur demande moins de mouvement (Réglages iOS › Accessibilité › Réduire les animations). */
export function reducedMotion(): boolean {
	return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

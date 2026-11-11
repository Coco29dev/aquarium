import { beginTransition } from './vt';

/** Point d'origine de la goutte : un toucher (clic) ou un élément (son centre). */
export type RevealOrigin = { clientX: number; clientY: number } | Element | null | undefined;

function originOf(origin: RevealOrigin): { x: number; y: number } {
	if (origin && 'clientX' in origin) return { x: origin.clientX, y: origin.clientY };
	if (origin && 'getBoundingClientRect' in origin) {
		const box = origin.getBoundingClientRect();
		return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
	}
	return { x: innerWidth / 2, y: 0 };
}

/**
 * Applique un changement d'apparence (clair ↔ sombre) avec la goutte : un cercle part du doigt et
 * révèle le nouveau thème. `apply` doit changer data-scheme de façon synchrone.
 */
export function revealTheme(apply: () => void, origin?: RevealOrigin) {
	const { x, y } = originOf(origin);
	// Rayon jusqu'au coin le plus éloigné : le cercle couvre tout l'écran à la fin.
	const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
	beginTransition('theme', apply, { '--tx': `${x}px`, '--ty': `${y}px`, '--tr': `${Math.ceil(radius)}px` });
}

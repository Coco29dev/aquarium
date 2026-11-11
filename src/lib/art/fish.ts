/**
 * Géométrie partagée des illustrations de Biotope.
 * Le poisson est dessiné sur une grille de 64 × 64, la tête à DROITE (il avance vers l'avant) :
 * une bulle étirée vers une queue à deux lobes. Les composants de src/lib/art/ et les scènes
 * (Scene, Lagoon) s'en servent pour que la marque, le loader et les silhouettes soient le même dessin.
 */

export const FISH = {
	/** Queue : deux lobes aux pointes adoucies (à tracer avec un trait de 3 de la même couleur). */
	tail: 'M18 33C14.5 28.5 10.5 23 5 19.5 6.5 25.5 7 29.5 9.5 33 7 36.5 6.5 40.5 5 46.5 10.5 43 14.5 37.5 18 33z',
	/** Corps : une bulle étirée vers la queue. */
	body: 'M50 33C50 23.5 41.5 16.5 31.5 16.5 23 16.5 18 22 15.5 30.5v5C18 44 23 49.5 31.5 49.5 41.5 49.5 50 42.5 50 33z',
	/** Nageoire dorsale couchée vers la queue (au-delà de 40 px seulement). */
	dorsal: 'M21 22C19.5 14.5 23.5 9.5 29 8 28.5 12.5 31.5 15 38 17.5z',
	/** Ouïe nacrée. */
	gill: 'M37.5 22.5C34 29 34 37 37.5 43.5',
	/** Silhouette d'un seul tenant (corps + queue), pour un contour pointillé ou une ombre. */
	outline:
		'M50 33C50 23.5 41.5 16.5 31.5 16.5 24.5 16.5 19 20 15.8 27.2 13.5 25 10 22 5 19.5 6.5 25.5 7 29.5 9.5 33 7 36.5 6.5 40.5 5 46.5 10.5 43 14 39.5 15.5 35.5 18 44 23 49.5 31.5 49.5 41.5 49.5 50 42.5 50 33z',
	/** Œil fermé de poisson qui dort. */
	sleepyEye: 'M39.5 28.8q3 2.8 6 0',
	eye: { x: 42.5, y: 28.5, r: 3.2 },
	glint: { x: 43.5, y: 27.4, r: 1.05 },
	/** Centre visuel (sans bulles) et boîte serrée du poisson avec nageoire. */
	center: { x: 27, y: 33 },
	box: '3 7 48 44'
} as const;

/** Eau selon le type de bac : la couleur change, jamais la forme. */
export type WaterVariant = 'douce' | 'plantee' | 'mer' | 'recif';

export const WATER: Record<WaterVariant, string> = {
	douce: 'var(--art-lagon, #19b6c6)',
	plantee: 'var(--art-algue, #3cc79a)',
	mer: 'var(--indigo, #5856d6)',
	recif: 'var(--art-lagon, #19b6c6)'
};

/** Une feuille d'algue, base en (0, 0), pointe vers le haut (grille locale d'environ 24 × 74). */
export const FROND = 'M-5 2C-16-18-2-32-8-50-11-59-6-66 2-72 8-56 18-46 12-28 8-14 14-6 6 2z';
export const FROND_VEIN = 'M-1-4C-3-24 2-40 2-60';

/** Branche de corail, base en (0, 0), à tracer avec un trait épais à bouts ronds. */
export const CORAL = 'M0 2V-26M0-26C0-34-9-37-11-46M0-16C0-23 9-27 12-35M-11-46c-1.5-4 0-7 3-9M12-35c2-3 2-6 1-9M0-26C0-32 3-36 3-42';

/** Étincelle à quatre branches, centrée en (0, 0), rayon 1. */
export const SPARKLE = 'M0-1C.12-.3.3-.12 1 0 .3.12.12.3 0 1-.12.3-.3.12-1 0-.3-.12-.12-.3 0-1z';

/**
 * Bord d'une nappe d'eau qui ondule : `periods` périodes de 84 de large, amplitude 7, depuis (x0, y).
 * Faire glisser le groupe d'une période (84) en boucle donne un mouvement sans couture.
 */
export function swellPath(x0: number, y: number, periods = 5): string {
	return `M${x0} ${y}` + 'c11-7 31-7 42 0s31 7 42 0'.repeat(periods);
}

/** Point sur un cercle (degrés depuis le haut, sens horaire). */
export function onCircle(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
	const t = (deg * Math.PI) / 180;
	return { x: cx + r * Math.sin(t), y: cy - r * Math.cos(t) };
}

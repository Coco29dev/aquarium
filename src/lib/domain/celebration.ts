// « Journée bouclée » : quand célébrer la fermeture des anneaux d'Aujourd'hui, et quand surtout ne pas
// le faire. Fonctions pures (testées) : l'écran ne fait que lire leur réponse.
//
// Règles : une fois par jour au plus ; seulement à la fermeture (l'état d'avant n'était pas bouclé) ;
// jamais parce qu'un total vaut 0 (« rien à faire » n'est pas une réussite) ; jamais pour un changement
// venu d'ailleurs (synchronisation d'un autre appareil) : il faut un geste de l'utilisateur récent.

export interface RingCount {
	done: number;
	total: number;
}

/** Les deux anneaux d'action d'un jour (la stabilité n'en est pas un : on ne la « ferme » pas d'un geste). */
export interface RingsSnapshot {
	/** Jour calendaire (YYYY-MM-DD) auquel se rapporte l'instantané. */
	day: string;
	tasks: RingCount;
	tests: RingCount;
}

/** Un anneau est fermé quand il y avait quelque chose à faire et que tout est fait. */
export const isClosed = (ring: RingCount): boolean => ring.total > 0 && ring.done >= ring.total;

const live = (s: Pick<RingsSnapshot, 'tasks' | 'tests'>): RingCount[] => [s.tasks, s.tests].filter((r) => r.total > 0);

/** Journée bouclée : au moins un anneau avait du travail, et chacun de ceux-là est fermé. */
export function dayClosed(s: Pick<RingsSnapshot, 'tasks' | 'tests'>): boolean {
	const rings = live(s);
	return rings.length > 0 && rings.every(isClosed);
}

/** Fenêtre pendant laquelle un geste de l'utilisateur est réputé à l'origine du changement. */
export const ACTION_WINDOW_MS = 90_000;

export interface CelebrationInput {
	/** Dernier instantané connu de la session (null : on ne sait pas, donc on ne célèbre pas). */
	before: RingsSnapshot | null;
	now: RingsSnapshot;
	/** Dernier jour célébré (gardé sur l'appareil). */
	celebratedDay: string | null;
	/** Horodatage du dernier geste de l'utilisateur (tâche cochée, mesures saisies), 0 si aucun. */
	lastActionAt: number;
	nowMs: number;
}

/** Vrai quand l'anneau vient de se fermer à l'instant, par le fait de l'utilisateur, pour la première fois du jour. */
export function shouldCelebrate({ before, now, celebratedDay, lastActionAt, nowMs }: CelebrationInput): boolean {
	if (!before || before.day !== now.day) return false;
	if (celebratedDay === now.day) return false;
	if (!dayClosed(now)) return false;
	// Avant, il y avait du travail à faire : sinon la « fermeture » ne vient que d'un total qui a changé.
	if (!live(before).some((r) => !isClosed(r))) return false;
	return nowMs - lastActionAt <= ACTION_WINDOW_MS && lastActionAt > 0;
}

import { dayInParis } from './dates';
import type { Feeding } from '../types';

export interface FeedingsToday {
	/** Nombre de repas aujourd'hui (jour calendaire Europe/Paris). */
	count: number;
	/** Date ISO du dernier repas d'aujourd'hui, ou null. */
	last: string | null;
}

/** Repas d'un bac pour le jour calendaire (Paris) de `now`. */
export function feedingsToday(feedings: Feeding[], aquariumId: number, now: Date | number = Date.now()): FeedingsToday {
	const today = dayInParis(now);
	let count = 0;
	let last: string | null = null;
	for (const f of feedings) {
		if (f.aquariumId !== aquariumId || dayInParis(f.fedAt) !== today) continue;
		count++;
		if (!last || f.fedAt > last) last = f.fedAt;
	}
	return { count, last };
}

/**
 * - 'libre'  : pas de consigne pour ce bac ;
 * - 'ok'     : consigne pas encore atteinte ;
 * - 'complet': consigne atteinte, on ne nourrit plus ;
 * - 'trop'   : consigne dépassée (risque de suralimentation).
 */
export type FeedingStatus = 'libre' | 'ok' | 'complet' | 'trop';

export function feedingStatus(count: number, perDay: number | null | undefined): FeedingStatus {
	if (perDay == null || perDay <= 0) return 'libre';
	if (count < perDay) return 'ok';
	if (count === perDay) return 'complet';
	return 'trop';
}

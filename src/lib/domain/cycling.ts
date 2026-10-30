import { DAY_MS } from './dates';
import type { Measurement, Parameter } from '../types';

export type CyclingStage = 'aucune_mesure' | 'demarrage' | 'pic_nitrites' | 'finalisation' | 'pret';

export interface CyclingStatus {
	stage: CyclingStage;
	ready: boolean;
	title: string;
	advice: string;
}

export interface Reading {
	t: number;
	v: number;
}

// En dessous de ce seuil (mg/L), on considère la valeur comme nulle (limite des tests colorimétriques).
const ZERO = 0.05;
const CONFIRM_SPAN_DAYS = 2;

/**
 * Lit ammoniaque, nitrites et nitrates (triés par date) et indique où en est le cyclage.
 * « Prêt » = deux dernières mesures d'ammoniaque et de nitrites à zéro, espacées d'au moins
 * 2 jours, et des nitrates présents (preuve que le cycle tourne).
 */
export function cyclingCoach(readings: { nh3: Reading[]; no2: Reading[]; no3: Reading[] }): CyclingStatus {
	const sort = (list: Reading[]) => [...list].sort((a, b) => a.t - b.t);
	const nh3 = sort(readings.nh3);
	const no2 = sort(readings.no2);
	const no3 = sort(readings.no3);

	if (nh3.length === 0 || no2.length === 0) {
		const missing = [nh3.length === 0 ? 'ammoniaque' : null, no2.length === 0 ? 'nitrites' : null]
			.filter(Boolean)
			.join(' et ');
		return {
			stage: 'aucune_mesure',
			ready: false,
			title: 'Cyclage : mesures manquantes',
			advice: `Mesure ${missing} (et les nitrates) pour que je puisse suivre le cyclage.`
		};
	}

	const lastNh3 = nh3[nh3.length - 1].v;
	const lastNo2 = no2[no2.length - 1].v;
	const lastNo3 = no3.length ? no3[no3.length - 1].v : null;

	if (lastNo2 > ZERO) {
		return {
			stage: 'pic_nitrites',
			ready: false,
			title: 'Cyclage : pic de nitrites',
			advice:
				'Les bactéries des nitrites s’installent. Pas de poissons : attends que les nitrites retombent à 0 (souvent 2 à 4 semaines).'
		};
	}

	if (lastNh3 > ZERO) {
		return {
			stage: 'demarrage',
			ready: false,
			title: 'Cyclage : démarrage',
			advice:
				'De l’ammoniaque est présente et les nitrites n’apparaissent pas encore. Continue d’attendre, pas de poissons.'
		};
	}

	const lastTwo = (list: Reading[]) => list.slice(-2);
	const confirmed = (list: Reading[]) => {
		const [a, b] = lastTwo(list);
		return (
			list.length >= 2 &&
			a.v <= ZERO &&
			b.v <= ZERO &&
			b.t - a.t >= CONFIRM_SPAN_DAYS * DAY_MS
		);
	};

	// Zéro partout ne prouve rien tant qu'aucune source d'ammoniaque n'a nourri les bactéries :
	// un bac neuf rempli d'eau du robinet (déjà riche en nitrates) afficherait « prêt » dès le premier jour.
	const cycleSeen = [...nh3, ...no2].some((x) => x.v > ZERO);

	if (confirmed(nh3) && confirmed(no2) && lastNo3 != null && lastNo3 > 0 && cycleSeen) {
		return {
			stage: 'pret',
			ready: true,
			title: 'Cyclage terminé',
			advice:
				'Ammoniaque et nitrites sont à zéro de façon stable et les nitrates sont présents : le bac peut recevoir ses premiers poissons, par petits groupes.'
		};
	}

	const todo: string[] = [];
	if (!confirmed(nh3) || !confirmed(no2)) {
		todo.push('refais une série ammoniaque + nitrites au moins 2 jours après la précédente');
	}
	if (lastNo3 == null || lastNo3 <= 0) todo.push('mesure les nitrates, ils doivent être présents');
	if (!cycleSeen) {
		todo.push(
			'aucune trace d’ammoniaque ni de nitrites n’a été mesurée : sans source d’ammoniaque (produit dédié ou nourriture), le cyclage n’a pas démarré, et des nitrates peuvent venir de l’eau du robinet'
		);
	}
	return {
		stage: 'finalisation',
		ready: false,
		title: 'Cyclage : presque fini',
		advice: `Ammoniaque et nitrites sont à zéro. Pour confirmer : ${todo.join(' ; ')}.`
	};
}

/** Extrait les relevés NH3/NO2/NO3 d'un aquarium à partir des clés de ses paramètres. */
export function cyclingForAquarium(
	parameters: Parameter[],
	measurements: Measurement[]
): CyclingStatus | null {
	const keyOf = new Map(parameters.map((p) => [p.id, p.key]));
	if (!parameters.some((p) => p.key === 'nh3') || !parameters.some((p) => p.key === 'no2')) {
		return null;
	}
	const pick = (key: string): Reading[] =>
		measurements
			.filter((m) => keyOf.get(m.parameterId) === key)
			.map((m) => ({ t: new Date(m.measuredAt).getTime(), v: m.value }));
	return cyclingCoach({ nh3: pick('nh3'), no2: pick('no2'), no3: pick('no3') });
}

/**
 * Vrai si le bac a déjà été déclaré « prêt » à un moment de son historique. Un pic d'ammoniaque
 * dans un bac mûr (poisson mort, surdosage) est une urgence, pas un cyclage : il ne doit pas être
 * traité comme tel.
 */
export function hasCycled(parameters: Parameter[], measurements: Measurement[]): boolean {
	const keys = new Set(parameters.filter((p) => ['nh3', 'no2', 'no3'].includes(p.key ?? '')).map((p) => p.id));
	const relevant = measurements.filter((m) => keys.has(m.parameterId));
	const instants = [...new Set(relevant.map((m) => new Date(m.measuredAt).getTime()))].sort((a, b) => a - b);
	return instants.some((t) => {
		const status = cyclingForAquarium(
			parameters,
			relevant.filter((m) => new Date(m.measuredAt).getTime() <= t)
		);
		return status?.ready === true;
	});
}

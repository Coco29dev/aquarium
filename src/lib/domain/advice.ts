// Conseils du jour : des lectures de l'encyclopédie choisies d'après l'état des bacs, complétées par
// une découverte qui change chaque jour. Fonctions pures (testées), sans accès au réseau.

export interface AdviceFacts {
	/** Noms des bacs en cyclage. */
	cycling: string[];
	/** Jours depuis le dernier changement d'eau du bac le plus en retard, ou null si inconnu. */
	waterDays: number | null;
	/** Au moins un bac sans mesure depuis 10 jours ou plus. */
	staleTests: boolean;
	/** Une alerte de nitrates (hors plage ou en hausse). */
	nitrates: boolean;
	/** Au moins un poisson dans un bac. */
	hasFish: boolean;
}

export interface AdviceCandidate {
	/** « thème/guide ». */
	ref: string;
	why: string;
}

/** Heure → formule d'accueil. */
export function greeting(hour: number): string {
	if (hour >= 5 && hour < 12) return 'Bonjour';
	if (hour >= 12 && hour < 18) return 'Bon après-midi';
	if (hour >= 18 && hour < 23) return 'Bonsoir';
	return 'Bonne nuit';
}

/** Entier stable pour une date « AAAA-MM-JJ » : la découverte change chaque jour mais pas à chaque affichage. */
export function dayNumber(day: string): number {
	let n = 0;
	for (const c of day) n = (n * 31 + c.charCodeAt(0)) % 100003;
	return n;
}

/** Guides utiles maintenant, du plus urgent au moins urgent (sans doublon). */
export function contextualAdvice(f: AdviceFacts): AdviceCandidate[] {
	const out: AdviceCandidate[] = [];
	if (f.nitrates) out.push({ ref: 'entretien/changement-eau', why: 'Tes nitrates demandent un changement d’eau.' });
	if (f.cycling.length) out.push({ ref: 'demarrer/cycle-azote', why: `${f.cycling.join(', ')} : le cyclage est en cours.` });
	if (f.waterDays != null && f.waterDays >= 14 && !f.nitrates) {
		out.push({ ref: 'entretien/changement-eau', why: `Dernier changement d’eau il y a ${f.waterDays} jours.` });
	}
	if (f.staleTests) out.push({ ref: 'entretien/tests', why: 'Un bac n’a pas été testé depuis plus de 10 jours.' });
	if (!f.hasFish) out.push({ ref: 'demarrer/premiers-poissons', why: 'Prépare l’arrivée des premiers habitants.' });
	return out;
}

/** Découvertes quotidiennes : n guides consécutifs dans la liste, à partir d'un point qui change chaque jour. */
export function dailyPicks<T>(all: T[], day: string, n: number): T[] {
	if (!all.length) return [];
	const start = dayNumber(day) % all.length;
	return Array.from({ length: Math.min(n, all.length) }, (_, i) => all[(start + i * 7) % all.length]).filter(
		(item, i, list) => list.indexOf(item) === i
	);
}

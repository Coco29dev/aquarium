// Voix de Biotope : tous les textes de retour d'action au même endroit, pour que l'appli parle d'une
// seule voix. Tutoiement, phrases courtes, un point final, ni « ! » ni emoji. La gravité se dit par le
// fait (la valeur, la limite), jamais par un adjectif. Fonctions pures (testées).
//
// Les phrases à variantes restent stables toute la journée (même graine : le jour) : le texte ne
// change pas d'un affichage à l'autre, mais l'appli ne se répète pas d'un jour sur l'autre.

import { dayNumber } from '$lib/domain/advice';
import { dayInParis } from '$lib/domain/dates';
import { personalGreeting } from '$lib/domain/profile';
import { fmt } from '$lib/ui';
import type { Parameter } from '$lib/types';

/** Une variante de la liste, choisie d'après le jour (et un sel pour décorréler plusieurs phrases). */
export function variant<T>(list: readonly T[], day: string = dayInParis(), salt = 0): T {
	return list[(dayNumber(day) + salt) % list.length];
}

/** Coupe un intitulé trop long pour qu'une phrase tienne sur deux lignes de bannière. */
export function clip(text: string, max = 46): string {
	const t = text.trim().replace(/[.\s]+$/, '');
	return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** « Nitrates (NO3) » → « Nitrates » : le nom sans sa parenthèse, casse d'origine (début de phrase). */
export function plainName(name: string): string {
	return name.replace(/\s*\([^)]*\)\s*/g, ' ').trim() || name.trim();
}

/** « Nitrates (NO3) » → « nitrates » ; « pH » et les sigles gardent leur casse (milieu de phrase). */
export function shortName(name: string): string {
	const base = plainName(name);
	return /[A-ZÀ-Ý]/.test(base.slice(1)) ? base : base.charAt(0).toLowerCase() + base.slice(1);
}

/** Liste lisible : « a », « a et b », « a, b et c », « a, b et 2 autres ». */
export function enumerate(items: string[], max = 3): string {
	if (items.length <= 1) return items[0] ?? '';
	if (items.length <= max) return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
	const rest = items.length - (max - 1);
	return `${items.slice(0, max - 1).join(', ')} et ${rest} autre${rest > 1 ? 's' : ''}`;
}

// --- Salutation ------------------------------------------------------------------------------------

/**
 * Formule d'accueil. Après la nuit, « Bonne nuit » sonnerait comme un adieu : on dit plutôt
 * « Encore debout ». Après plusieurs jours d'absence, un simple plaisir de revoir, sans reproche.
 */
export function welcome(input: { hour: number; name: string; away?: number }): string {
	const name = input.name.trim();
	if ((input.away ?? 0) >= 5) return name ? `Content de te revoir, ${name}` : 'Content de te revoir';
	if (input.hour < 5) return name ? `Encore debout, ${name} ?` : 'Encore debout ?';
	const base = input.hour < 12 ? 'Bonjour' : input.hour < 18 ? 'Bon après-midi' : 'Bonsoir';
	return personalGreeting(base, name);
}

// --- Erreurs ---------------------------------------------------------------------------------------

const ERRORS = {
	network: 'Pas de réseau pour l’instant. Réessaie dès que la connexion revient.',
	server: 'Le serveur ne répond pas pour l’instant. Réessaie dans un moment.',
	session: 'Ta session a expiré. Reconnecte-toi pour continuer.',
	generic: 'Ça n’a pas marché. Réessaie dans un instant.'
} as const;

/** Vrai pour un message d'exception technique (anglais, code HTTP, JSON) qu'on ne montre pas tel quel. */
function isTechnical(message: string): boolean {
	return (
		/^Erreur \d{3}$/.test(message) ||
		/\b(fetch|network|json|undefined|null|unexpected|syntax|timeout|abort|typeerror|failed|load failed)\b/i.test(message) ||
		message.length > 140
	);
}

/**
 * Message d'erreur à montrer à l'utilisateur : celui d'une règle métier (déjà en français : « La date de
 * mesure est dans le futur. ») est gardé ; un message technique devient une phrase calme.
 */
export function friendlyError(error: unknown, fallback?: string): string {
	const message = (error instanceof Error ? error.message : typeof error === 'string' ? error : '').trim();
	if (/Failed to fetch|NetworkError|Load failed|network/i.test(message)) return ERRORS.network;
	if (/\b401\b|session/i.test(message)) return ERRORS.session;
	if (/\b5\d{2}\b|refusée/i.test(message)) return ERRORS.server;
	if (!message || isTechnical(message)) return fallback ?? ERRORS.generic;
	return /[.?]$/.test(message) ? message : `${message}.`;
}

/** Message sans icône qui dit en fait qu'une action a échoué (appelants qui n'ont pas de type). */
export function looksLikeError(message: string): boolean {
	return /impossible|erreur|échou|refus|invalide|requis|introuvable|dans le futur|n’est pas encore|n'est pas encore/i.test(message);
}

// --- Retours d'action ------------------------------------------------------------------------------

/** Tâche cochée : « Changement d'eau, c'est fait. » */
export function taskDone(title: string, day?: string): string {
	return variant([`${clip(title)}, c’est fait.`, `${clip(title)} : fait.`], day);
}

/** Repas noté (lu par les lecteurs d'écran : le geste lui-même n'affiche pas de bannière). */
export function fed(count: number, perDay?: number | null): string {
	const n = perDay ? `${count} sur ${perDay}` : String(count);
	return `Repas noté. ${n} repas aujourd’hui.`;
}

/** Fin de journée : tout ce qui était à faire est fait. */
export function dayClosed(hour: number, day?: string): string {
	if (hour >= 22 || hour < 5) return 'Tout est fait pour aujourd’hui. Bonne nuit.';
	if (hour >= 18) return variant(['Tout est fait pour aujourd’hui. Bonne soirée.', 'Tout est fait pour aujourd’hui. Repose-toi.'], day);
	return variant(['Tout est fait pour aujourd’hui. Belle journée.', 'Tout est fait pour aujourd’hui. Le bac est tranquille.'], day);
}

/** Aucune tâche aujourd'hui : on dit quoi vient ensuite plutôt que de laisser un vide. */
export const nothingTodayTitle = 'Rien à faire aujourd’hui';
export function nextTaskText(next?: { title: string; when: string } | null): string {
	return next ? `Prochaine tâche : ${clip(next.title, 32)}, ${next.when}.` : 'Profites-en.';
}
export function nothingToday(next?: { title: string; when: string } | null): string {
	return `${nothingTodayTitle}. ${nextTaskText(next)}`;
}

/** Hors ligne : la saisie est gardée, elle partira toute seule. */
export function offline(pending: number): string {
	return pending > 0 ? `Hors ligne · ${pending} saisie${pending > 1 ? 's' : ''} gardée${pending > 1 ? 's' : ''}` : 'Hors ligne';
}
export const allSent = 'Tout est envoyé.';

/** Jalon du parcours atteint. */
export function milestone(label: string): string {
	return `Jalon atteint : ${clip(label, 40)}.`;
}

/** Anniversaire d'un bac (voir `anniversaryOf` dans profile.ts). */
export function anniversary(tankName: string, label: string): string {
	return `${clip(tankName, 26)} fête ses ${label}.`;
}

// --- Textes vides ----------------------------------------------------------------------------------

export const empty = {
	tasksNoneTitle: 'Aucune tâche pour ce bac',
	tasksNoneText: 'Un changement d’eau, un filtre à nettoyer : je te rappelle le bon jour.',
	journalTitle: 'Le journal attend sa première ligne',
	journalText: 'Un changement d’eau, une observation, une photo : tout compte.',
	journalFiltered: 'Rien n’a encore été noté dans cette catégorie.',
	params: 'Aucun paramètre suivi. Ajoutes-en depuis les réglages du bac.',
	noMeasure: 'La première mesure lance la courbe.',
	noMeasureTitle: 'Aucune mesure pour l’instant',
	noMeasureText: 'La première lance la courbe de chaque paramètre.',
	livingTitle: 'Personne dans ce bac pour l’instant',
	livingText: 'Ajoute poissons, plantes ou coraux : je surveille la compatibilité.',
	waterNever: 'Aucun noté. Touche Fait après le prochain.',
	chart: 'Pas encore de mesure : la première lance la courbe.'
} as const;

// --- Verdict après une saisie ----------------------------------------------------------------------

export interface SavedValue {
	parameter: Pick<Parameter, 'id' | 'name' | 'key' | 'unit' | 'min' | 'max' | 'decimals'>;
	value: number;
}

export interface VerdictInput {
	aquariumId: number;
	saved: SavedValue[];
	/** Alertes du bac après la saisie (collectTankAlerts via tankHealth). */
	alerts: { level: 'hors_plage' | 'derive'; parameterId: number; message: string }[];
	/** Titre du coach de cyclage si le bac cycle (« Cyclage : pic de nitrites »). */
	coachTitle?: string | null;
	/** Première saisie de ces paramètres pour ce bac. */
	firstTime?: boolean;
}

export interface Verdict {
	/** 'ok' : rien à signaler ; 'warn' : une valeur à regarder (retour tactile d'attention, bannière orange). */
	level: 'ok' | 'warn';
	message: string;
	/** Lien vers le paramètre à regarder. */
	href?: string;
	linkLabel?: string;
}

const MAX = 80;
/** Conseil à la suite d'un dépassement, pour les seules valeurs où le geste est évident. */
const ADVICE: Record<string, string> = { no3: 'Un changement d’eau l’aiderait.', po4: 'Un changement d’eau l’aiderait.' };

function outOfRange(s: SavedValue): 'above' | 'below' | null {
	const { min, max } = s.parameter;
	if (max != null && s.value > max) return 'above';
	if (min != null && s.value < min) return 'below';
	return null;
}

/**
 * Ce que dit l'appli juste après une saisie : la valeur à regarder en premier, sinon « tout est dans la
 * plage » pour les seules valeurs qui ont une plage, sinon un simple « c'est noté ». Jamais plus que ce
 * qu'on sait : une valeur sans plage n'est pas déclarée « dans la plage ».
 */
export function measureVerdict(input: VerdictInput, day?: string): Verdict {
	const { saved, aquariumId } = input;
	const link = (parameterId: number) => ({ href: `/aquariums/${aquariumId}/parametre/${parameterId}`, linkLabel: 'Voir' });
	const ids = new Set(saved.map((s) => s.parameter.id));

	// 1. Valeurs hors plage (jugées sur ce qui vient d'être saisi).
	const bad = saved.filter((s) => outOfRange(s));
	if (bad.length === 1) {
		const s = bad[0];
		const p = s.parameter;
		const where = outOfRange(s) === 'above' ? `au-dessus de ${fmt(p.max, p.decimals)}` : `en dessous de ${fmt(p.min, p.decimals)}`;
		const unit = p.unit ? ` ${p.unit}` : '';
		const head = `${plainName(p.name)} à ${fmt(s.value, p.decimals)}${unit}, ${where}.`;
		const advice = outOfRange(s) === 'above' && p.key ? ADVICE[p.key] : undefined;
		const full = advice ? `${head} ${advice}` : head;
		return { level: 'warn', message: full.length <= MAX ? full : head, ...link(p.id) };
	}
	if (bad.length > 1) {
		const names = enumerate(bad.map((s) => shortName(s.parameter.name)));
		return { level: 'warn', message: `${bad.length} valeurs hors plage : ${names}.`, ...link(bad[0].parameter.id) };
	}

	// 2. Dérives sur ce qui vient d'être saisi.
	const drifting = input.alerts.filter((a) => a.level === 'derive' && ids.has(a.parameterId));
	if (drifting.length) {
		const a = drifting[0];
		const text = a.message.replace(/\s*\([^)]*\)/, '');
		return { level: 'warn', message: drifting.length > 1 ? `${text}. Et ${drifting.length - 1} autre à surveiller.` : `${text}. À surveiller.`, ...link(a.parameterId) };
	}

	// 3. Première saisie : on dit que la courbe commence.
	if (input.firstTime) {
		return { level: 'ok', message: saved.length > 1 ? 'Premières mesures notées. Les courbes commencent ici.' : 'Première mesure notée. La courbe commence ici.' };
	}

	// 4. Bac en cyclage : l'étape du coach parle mieux qu'un « dans la plage ».
	if (input.coachTitle) {
		const stage = input.coachTitle.replace(/^Cyclage\s*:\s*/i, 'Cyclage : ');
		return { level: 'ok', message: `${variant(['C’est noté.', 'Bien noté.'], day)} ${stage}.` };
	}

	// 5. Tout va bien : seules les valeurs qui ont une plage sont déclarées dans la plage.
	const ranged = saved.filter((s) => s.parameter.min != null || s.parameter.max != null);
	const lead = variant(['C’est noté', 'Bien noté'], day);
	if (ranged.length) return { level: 'ok', message: `${lead} : ${enumerate(ranged.map((s) => shortName(s.parameter.name)))} dans la plage.` };
	return { level: 'ok', message: `${lead} : ${saved.length} mesure${saved.length > 1 ? 's' : ''}.` };
}

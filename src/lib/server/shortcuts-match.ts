// Résolution de noms pour les raccourcis vocaux (Siri, bouton Action) : tolérante aux accents, à la casse
// et aux formulations (« nitrates », « NO3 », « le salon »). Fonctions pures : testées sans base.

export class ShortcutError extends Error {
	constructor(
		message: string,
		public status: 400 | 401 | 404 | 429 = 400
	) {
		super(message);
	}
}

/** Minuscules, sans accents, mots séparés par une espace. */
export function normalize(text: string): string {
	return text
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

const STOP_WORDS = new Set(['le', 'la', 'les', 'l', 'un', 'une', 'mon', 'ma', 'mes', 'du', 'de', 'des', 'bac', 'aquarium']);

/** Retire les petits mots (« le », « mon bac »…) pour comparer l'essentiel. */
function core(text: string): string {
	const words = normalize(text).split(' ').filter(Boolean);
	const kept = words.filter((w) => !STOP_WORDS.has(w));
	return (kept.length ? kept : words).join(' ');
}

/** Texte lisible à voix haute : sans parenthèses ni sigles entre parenthèses (« Nitrates (NO3) » → « Nitrates »). */
export function speakable(text: string): string {
	return text.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}

/** « de tâche », « d'aquarium » : élision devant une voyelle. */
const de = (what: string) => (/^[aeiouyàâéèêëîïôöûü]/i.test(what) ? `d'${what}` : `de ${what}`);

export interface Named {
	id: number;
	name: string;
}

/**
 * Cherche un élément par son nom. Égalité exacte d'abord, puis inclusion dans un sens ou dans l'autre.
 * Plusieurs candidats : erreur qui les liste ; aucun : erreur « introuvable ».
 */
export function matchByName<T extends Named>(items: T[], query: string, what: string): T {
	const q = core(query);
	if (!q) throw new ShortcutError(`Dis-moi quel ${what} : ${items.map((i) => i.name).join(', ')}.`);
	const exact = items.filter((i) => core(i.name) === q);
	if (exact.length === 1) return exact[0];
	if (exact.length > 1) throw ambiguous(exact, what);
	const partial = items.filter((i) => {
		const n = core(i.name);
		return n.includes(q) || q.includes(n);
	});
	if (partial.length === 1) return partial[0];
	if (partial.length > 1) throw ambiguous(partial, what);
	throw new ShortcutError(`Je ne trouve pas ${de(what)} « ${query.trim()} ». Disponibles : ${items.map((i) => i.name).join(', ')}.`, 404);
}

function ambiguous<T extends Named>(items: T[], what: string): ShortcutError {
	return new ShortcutError(`Plusieurs ${what}s correspondent : ${items.map((i) => i.name).join(', ')}. Précise lequel.`, 400);
}

/** Aquarium visé ; sans nom, accepté seulement s'il n'y en a qu'un. */
export function pickAquarium<T extends Named>(items: T[], name?: string | null): T {
	if (!items.length) throw new ShortcutError("Aucun aquarium en eau n'est enregistré.", 404);
	if (!name || !normalize(name)) {
		if (items.length === 1) return items[0];
		throw new ShortcutError(`Quel aquarium ? ${items.map((i) => i.name).join(', ')}.`, 400);
	}
	return matchByName(items, name, 'aquarium');
}

export interface ParameterLike extends Named {
	key: string | null;
}

/** Noms usuels → clé de paramètre. */
const ALIASES: Record<string, string> = {
	nitrate: 'no3',
	nitrates: 'no3',
	no3: 'no3',
	nitrite: 'no2',
	nitrites: 'no2',
	no2: 'no2',
	ammoniac: 'nh3',
	ammoniaque: 'nh3',
	nh3: 'nh3',
	nh4: 'nh3',
	temperature: 'temp',
	temp: 'temp',
	ph: 'ph',
	kh: 'kh',
	gh: 'gh',
	densite: 'salinity',
	salinite: 'salinity',
	calcium: 'ca',
	ca: 'ca',
	magnesium: 'mg',
	mg: 'mg',
	phosphate: 'po4',
	phosphates: 'po4',
	po4: 'po4'
};

export function pickParameter<T extends ParameterLike>(items: T[], query: string, aquariumName: string): T {
	const q = normalize(query);
	if (!q) throw new ShortcutError('Quel paramètre ? Par exemple nitrates, pH ou KH.');
	const byKey = items.find((p) => p.key && normalize(p.key) === q);
	if (byKey) return byKey;
	const alias = ALIASES[q] ?? ALIASES[q.split(' ')[0]];
	if (alias) {
		const found = items.find((p) => p.key === alias);
		if (found) return found;
	}
	const named = items.filter((p) => normalize(p.name) === q || normalize(p.name).includes(q) || q.includes(normalize(p.name)));
	if (named.length === 1) return named[0];
	if (named.length > 1) throw new ShortcutError(`Plusieurs paramètres correspondent : ${named.map((p) => p.name).join(', ')}. Précise lequel.`);
	throw new ShortcutError(
		`Je ne trouve pas le paramètre « ${query.trim()} » pour ${aquariumName}. Disponibles : ${items.map((p) => p.name).join(', ')}.`,
		404
	);
}

/** Lit « 25 », « 25,5 », « 25.5 », « 7,2 pH », « 25 mg/L » : le premier nombre du texte. */
export function parseValue(raw: unknown): number {
	if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
	if (typeof raw !== 'string') throw new ShortcutError('Valeur manquante : donne un nombre, par exemple 25 ou 7,2.');
	const match = /-?\d+(?:[.,]\d+)?/.exec(raw.replace(/\s/g, ' '));
	if (!match) throw new ShortcutError(`Je n'ai pas compris la valeur « ${raw.trim()} ». Donne un nombre, par exemple 25 ou 7,2.`);
	const value = Number(match[0].replace(',', '.'));
	if (!Number.isFinite(value)) throw new ShortcutError(`Valeur invalide : « ${raw.trim()} ».`);
	return value;
}

/** « 1er », « 2e », « 3e »… pour annoncer le repas du jour. */
export function ordinal(n: number): string {
	return n === 1 ? '1er' : `${n}e`;
}

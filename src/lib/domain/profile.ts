// Profil personnel : prénom, niveau, centre d'intérêt et couleur d'accent. Sert à personnaliser
// l'accueil (formule, conseils, parcours) et l'apparence. Fonctions pures (testées).

export type Level = 'debutant' | 'intermediaire' | 'confirme';
export type Interest = 'poissons' | 'plantes' | 'recif' | 'equilibre';
export type AccentId = 'lagon' | 'corail' | 'algue' | 'lilas' | 'ambre';

export interface Profile {
	name: string;
	level: Level | null;
	interest: Interest | null;
	accent: AccentId;
}

export const DEFAULT_PROFILE: Profile = { name: '', level: null, interest: null, accent: 'lagon' };

export const LEVELS: { value: Level; label: string; hint: string }[] = [
	{ value: 'debutant', label: 'Je débute', hint: 'Explications pas à pas, bases d’abord' },
	{ value: 'intermediaire', label: 'J’ai de l’expérience', hint: 'Moins de bases, plus de réglages fins' },
	{ value: 'confirme', label: 'Je suis confirmé', hint: 'Droit au but, seulement l’essentiel' }
];

export const INTERESTS: { value: Interest; label: string; icon: 'fish' | 'leaf' | 'coral' | 'drop' }[] = [
	{ value: 'poissons', label: 'Les poissons', icon: 'fish' },
	{ value: 'plantes', label: 'Les plantes', icon: 'leaf' },
	{ value: 'recif', label: 'Le récif', icon: 'coral' },
	{ value: 'equilibre', label: 'L’équilibre de l’eau', icon: 'drop' }
];

/** Couleurs d'accent proposées ; l'aperçu reprend la teinte en clair (les valeurs réelles sont dans layout.css). */
export const ACCENTS: { id: AccentId; label: string; swatch: string }[] = [
	{ id: 'lagon', label: 'Lagon', swatch: '#0a7385' },
	{ id: 'corail', label: 'Corail', swatch: '#d9483b' },
	{ id: 'algue', label: 'Algue', swatch: '#2f7d4f' },
	{ id: 'lilas', label: 'Lilas', swatch: '#7a4fd0' },
	{ id: 'ambre', label: 'Ambre', swatch: '#b9650a' }
];

const isOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);

/** Lit un profil venu du réseau ou du stockage local, sans jamais échouer. */
export function parseProfile(raw: unknown): Profile {
	const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	return {
		name: typeof o.name === 'string' ? o.name.trim().slice(0, 30) : '',
		level: isOf(['debutant', 'intermediaire', 'confirme'] as const, o.level) ? o.level : null,
		interest: isOf(['poissons', 'plantes', 'recif', 'equilibre'] as const, o.interest) ? o.interest : null,
		accent: isOf(ACCENTS.map((a) => a.id), o.accent) ? o.accent : 'lagon'
	};
}

/** « Bonsoir » → « Bonsoir Corentin ». */
export function personalGreeting(base: string, name: string): string {
	return name.trim() ? `${base} ${name.trim()}` : base;
}

/** Thèmes de l'encyclopédie à mettre en avant d'après le centre d'intérêt. */
const INTEREST_THEMES: Record<Interest, string[]> = {
	poissons: ['vivre', 'sante', 'biotopes'],
	plantes: ['plantes', 'biotopes'],
	recif: ['sante', 'entretien'],
	equilibre: ['entretien', 'sante']
};

/**
 * Classe les lectures « découverte » selon le profil : un confirmé ne revoit pas les bases du
 * démarrage, un débutant les voit d'abord ; le centre d'intérêt passe devant. L'ordre relatif
 * reste celui de l'entrée (la découverte du jour).
 */
export function rankPicks<T extends { theme: { slug: string } }>(all: T[], profile: Pick<Profile, 'level' | 'interest'>): T[] {
	const preferred = profile.interest ? INTEREST_THEMES[profile.interest] : [];
	const score = (item: T) => {
		const slug = item.theme.slug;
		let s = 0;
		if (preferred.includes(slug)) s += 2;
		if (profile.level === 'debutant' && slug === 'demarrer') s += 3;
		return s;
	};
	const kept = profile.level === 'confirme' ? all.filter((i) => i.theme.slug !== 'demarrer') : all;
	return kept.map((item, i) => ({ item, i })).sort((a, b) => score(b.item) - score(a.item) || a.i - b.i).map((x) => x.item);
}

// --- Parcours d'aquariophile -------------------------------------------------------------------

export interface JourneyFacts {
	tanks: number;
	measurements: number;
	waterChanges: number;
	arrivals: number;
	/** Âge du plus ancien bac suivi, en jours. */
	daysTracked: number;
	/** Meilleur score de stabilité sur 30 jours, ou null. */
	stability: number | null;
	covers: number;
}

export interface Milestone {
	id: string;
	label: string;
	hint: string;
	done: boolean;
	href: string;
}

/** Jalons adaptés au niveau : les bases pour un débutant, la maîtrise fine pour un confirmé. */
export function milestones(level: Level | null, f: JourneyFacts): Milestone[] {
	const m = (id: string, label: string, hint: string, done: boolean, href: string): Milestone => ({ id, label, hint, done, href });
	if (level === 'confirme') {
		return [
			m('tanks', 'Deux bacs suivis', 'Ajoute un second bac', f.tanks >= 2, '/aquariums/nouveau'),
			m('mesures', '30 mesures notées', 'Chaque mesure affine les alertes', f.measurements >= 30, '/mesurer'),
			m('eau', '10 changements d’eau', 'Note-les pour voir ton rythme', f.waterChanges >= 10, '/aquariums'),
			m('stable', 'Stabilité de 85 %', 'Des valeurs qui bougent peu sur 30 jours', (f.stability ?? 0) >= 85, '/aquariums'),
			m('vivants', '10 habitants accueillis', 'Poissons, invertébrés, plantes', f.arrivals >= 10, '/aquariums'),
			m('six-mois', 'Six mois de suivi', 'Le temps fait les beaux bacs', f.daysTracked >= 180, '/aquariums')
		];
	}
	if (level === 'intermediaire') {
		return [
			m('mesures', '10 mesures notées', 'De quoi voir les tendances', f.measurements >= 10, '/mesurer'),
			m('eau', '3 changements d’eau', 'Note-les dans le journal du bac', f.waterChanges >= 3, '/aquariums'),
			m('vivants', '5 habitants accueillis', 'Ajoute-les depuis la base d’espèces', f.arrivals >= 5, '/aquariums'),
			m('stable', 'Stabilité de 70 %', 'Des valeurs qui bougent peu sur 30 jours', (f.stability ?? 0) >= 70, '/aquariums'),
			m('photo', 'Une photo de couverture', 'Choisis la plus belle de ton bac', f.covers >= 1, '/aquariums'),
			m('trois-mois', 'Trois mois de suivi', 'Le cyclage est loin derrière toi', f.daysTracked >= 90, '/aquariums')
		];
	}
	return [
		m('bac', 'Ton premier bac décrit', 'Type d’eau, volume, mise en eau', f.tanks >= 1, '/aquariums/nouveau'),
		m('mesure', 'Ta première mesure', 'Deux touches suffisent', f.measurements >= 1, '/mesurer'),
		m('eau', 'Un premier changement d’eau', 'Le geste qui compte le plus', f.waterChanges >= 1, '/aquariums'),
		m('habitant', 'Un premier habitant', 'Choisis-le dans la base d’espèces', f.arrivals >= 1, '/aquariums'),
		m('semaine', 'Une semaine de suivi', 'Les bonnes habitudes s’installent', f.daysTracked >= 7, '/aquariums'),
		m('mois', 'Un mois de suivi', 'Ton bac a pris son rythme', f.daysTracked >= 30, '/aquariums')
	];
}

export function nextMilestone(list: Milestone[]): Milestone | null {
	return list.find((x) => !x.done) ?? null;
}

// --- Jalons atteints et anniversaires de bac ---------------------------------------------------------
// Des petits moments positifs et rares : ni série, ni compteur de jours manqués, rien qui se « perde ».

/**
 * Jalons passés à « fait » depuis la dernière fois. `previous` est la liste des identifiants déjà
 * faits la dernière fois (null : première fois, on prend l'état actuel comme point de départ sans rien
 * annoncer, pour ne pas fêter d'un coup tout ce qui était déjà acquis).
 */
export function newlyDone(previous: string[] | null, list: Milestone[]): Milestone[] {
	if (previous === null) return [];
	const known = new Set(previous);
	return list.filter((m) => m.done && !known.has(m.id));
}

/** Identifiants des jalons faits, pour garder l'état d'une fois sur l'autre. */
export const doneIds = (list: Milestone[]): string[] => list.filter((m) => m.done).map((m) => m.id);

/** Jours d'âge d'un bac à fêter : 30, 100, puis chaque année. */
const FIRST_ANNIVERSARIES = [30, 100] as const;
/** Un anniversaire reste affiché ce nombre de jours (jour J compris) : on n'ouvre pas l'appli tous les jours. */
export const ANNIVERSARY_WINDOW = 3;

export interface Anniversary {
	/** Âge fêté, en jours (30, 100, 365, 730…). */
	days: number;
	/** « 30 jours », « 100 jours », « 1 an », « 2 ans ». */
	label: string;
}

/** Anniversaire à montrer pour un bac d'âge `age` (jours depuis la mise en eau), ou null. */
export function anniversaryOf(age: number | null | undefined): Anniversary | null {
	if (age == null || age < FIRST_ANNIVERSARIES[0]) return null;
	for (const days of FIRST_ANNIVERSARIES) {
		if (age >= days && age < days + ANNIVERSARY_WINDOW) return { days, label: `${days} jours` };
	}
	if (age >= 365) {
		const years = Math.floor(age / 365);
		if (age - years * 365 < ANNIVERSARY_WINDOW) return { days: years * 365, label: years === 1 ? '1 an' : `${years} ans` };
	}
	return null;
}

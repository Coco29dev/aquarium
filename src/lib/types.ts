export type WaterType = 'douce' | 'plantee' | 'mer' | 'recif';

export const WATER_TYPE_LABELS: Record<WaterType, string> = {
	douce: 'Eau douce',
	plantee: 'Eau douce plantée',
	mer: 'Eau de mer',
	recif: 'Récif'
};

export interface Aquarium {
	id: number;
	name: string;
	waterType: WaterType;
	volumeL: number | null;
	startedOn: string | null; // YYYY-MM-DD
	/** Photo de couverture (voir /api/photos/<id>), ou null. */
	coverPhotoId: number | null;
	/** Nombre de repas par jour visé pour ce bac, ou null (pas de consigne). Absent d'un ancien cache : null. */
	feedingsPerDay?: number | null;
	/** Étape de vie : en projet, en cyclage ou actif. Absent d'un ancien cache : traiter comme 'actif'. */
	stage: AquariumStage;
}

export type AquariumStage = 'projet' | 'cyclage' | 'actif';

export const STAGE_LABELS: Record<AquariumStage, string> = {
	projet: 'En projet',
	cyclage: 'En cyclage',
	actif: 'Actif'
};

/** Élément de la liste de projet d'un bac pas encore en eau. */
export interface ProjectItem {
	id: number;
	/** Identifiant du bac (nom de la colonne de rattachement de la ressource générique). */
	scopeId?: number;
	kind: 'equipement' | 'espece' | 'budget' | 'etape';
	label: string;
	done: boolean;
	amount: number | null;
	speciesId: number | null;
	notes: string | null;
	position: number;
}

export interface Parameter {
	id: number;
	aquariumId: number;
	key: string | null; // nh3, no2, no3, temp, ph… (sert au coach de cyclage)
	name: string;
	unit: string;
	min: number | null;
	max: number | null;
	driftPerWeek: number | null; // variation max acceptable sur 7 jours
	decimals: number;
	step: number;
	position: number;
	/** Attente du réactif d'un test, en secondes (minuteur du pas à pas), ou null. */
	testWaitSeconds?: number | null;
}

export interface Measurement {
	/** Présent pour les mesures venant du serveur ; absent des saisies encore en file d'envoi. */
	id?: number;
	parameterId: number;
	aquariumId: number;
	value: number;
	measuredAt: string; // ISO
	clientId?: string;
}

export interface Task {
	id: number;
	aquariumId: number;
	title: string;
	kind: string;
	everyDays: number;
	nextDue: string; // YYYY-MM-DD
	active: boolean;
}

export interface Snapshot {
	generatedAt: string;
	aquariums: Aquarium[];
	parameters: Parameter[];
	measurements: Measurement[];
	tasks: Task[];
	/** Absent d'un ancien cache local. */
	consumables?: ConsumableRow[];
	/** Réalisations de tâches récentes (absent d'un ancien cache local). */
	completions?: Completion[];
	/** Journal d'événements des 180 derniers jours, 1000 au plus (absent d'un ancien cache local). */
	events?: AquariumEvent[];
	/** Nourrissages des 14 derniers jours (absent d'un ancien cache local). */
	feedings?: Feeding[];
}

export interface Feeding {
	id?: number;
	aquariumId: number;
	fedAt: string; // ISO
	note?: string | null;
	clientId?: string;
}

export type EventKind =
	| 'changement_eau'
	| 'appoint'
	| 'dosage'
	| 'eclairage'
	| 'co2'
	| 'maintenance'
	| 'habitant_ajout'
	| 'habitant_depart'
	| 'etape'
	| 'note';

/** Un fait daté dans la vie d'un bac. Le schéma de `payload` dépend de `kind` : voir domain/events.ts. */
export interface AquariumEvent {
	id?: number;
	aquariumId: number;
	kind: EventKind;
	at: string; // ISO
	payload: Record<string, unknown>;
	note?: string | null;
	/** 'tache' : créé en cochant une tâche ; 'auto' : déduit d'une autre saisie ; 'manuel' : saisi tel quel. */
	source?: 'manuel' | 'tache' | 'auto';
	sourceRef?: number | null;
	clientId?: string;
}

export interface Completion {
	taskId: number;
	doneAt: string; // ISO
	note?: string | null;
}

/** Opérations saisies hors ligne, renvoyées à l'ouverture suivante. */
export type SyncOp =
	| { type: 'feeding'; clientId: string; aquariumId: number; fedAt: string; note?: string }
	| {
			type: 'measurement';
			clientId: string;
			aquariumId: number;
			parameterId: number;
			value: number;
			measuredAt: string;
	  }
	| { type: 'completion'; clientId: string; taskId: number; doneAt: string; note?: string }
	| {
			type: 'event';
			clientId: string;
			aquariumId: number;
			kind: EventKind;
			at: string;
			payload: Record<string, unknown>;
			note?: string;
	  };

export type SpeciesKind = 'poisson' | 'corail' | 'invertebre' | 'plante' | 'autre';
export type Temperament = 'paisible' | 'semi-agressif' | 'agressif';
export type Diet = 'carnivore' | 'omnivore' | 'herbivore' | 'filtreur' | 'autre';
export type Zone = 'haut' | 'milieu' | 'bas' | 'tous';

export const KIND_LABELS: Record<SpeciesKind, string> = {
	poisson: 'Poisson',
	corail: 'Corail / anémone',
	invertebre: 'Invertébré',
	plante: 'Plante',
	autre: 'Autre'
};

export interface Species {
	id: number;
	source: 'fishbase' | 'sealifebase' | 'maison' | 'noyau';
	scientificName: string;
	nameFr: string | null;
	nameEn: string | null;
	kind: SpeciesKind;
	fresh: boolean;
	brackish: boolean;
	salt: boolean;
	maxLengthCm: number | null;
	lifespanYears: number | null;
	tempMin: number | null;
	tempMax: number | null;
	phMin: number | null;
	phMax: number | null;
	minTankL: number | null;
	temperament: Temperament | null;
	diet: Diet | null;
	zone: Zone | null;
	groupMin: number | null;
	reefSafe: boolean | null;
	bioloadG: number | null;
	notes: string | null;
	/** Champs déduits de FishBase, à confirmer. */
	estimated: string[];
	description: string | null;
	/** Provenance et milieu naturel (ex. « Amazonie, eaux noires »). */
	origin: string | null;
	/** 1 : facile, 2 : intermédiaire, 3 : exigeant. */
	difficulty: 1 | 2 | 3 | null;
	/** Conseils d'entretien : alimentation, décor, reproduction, cohabitation. */
	care: string | null;
	/** Plantes : 1 faible, 2 moyenne, 3 forte. */
	light: 1 | 2 | 3 | null;
	/** Plantes : 0 inutile, 1 conseillé, 2 indispensable. */
	co2: 0 | 1 | 2 | null;
	/** Dans le noyau encyclopédique (visible par défaut). */
	curated: boolean;
	/** 'claude' : rédigé par Claude, à vérifier ; 'verifie' : confirmé par l'utilisateur. */
	dataQuality: 'claude' | 'verifie' | null;
	hasPhoto: boolean;
	photoAuthor: string | null;
	photoLicense: string | null;
	photoSource: string | null;
}

export interface ConsumableRow {
	id: number;
	equipmentId: number;
	aquariumId: number;
	name: string;
	installedOn: string | null;
	replaceEveryDays: number | null;
	unitPrice: number | null;
	/** Dates (installation → remplacement) des remplacements passés. */
	history: { installedOn: string; replacedOn: string }[];
}

/** Réglages des rappels (stockés côté serveur). */
export interface NotificationSettings {
	/** Heure du récapitulatif quotidien, 'HH:MM' (Europe/Paris). */
	summaryTime: string;
	/** Début et fin des heures de silence ('HH:MM'), ou null. */
	quietStart: string | null;
	quietEnd: string | null;
	/** Bacs concernés ; null = tous. */
	aquariumIds: number[] | null;
	/** Sujet ntfy.sh de repli, ou null. */
	ntfyTopic: string | null;
	/** Bilan du dimanche : activé ? (défaut oui) */
	weeklyReport: boolean;
	/** Heure d'envoi du bilan le dimanche, 'HH:MM' (Europe/Paris). */
	weeklyTime: string;
}

/** État de la sauvegarde hebdomadaire. */
export interface BackupStatus {
	lastBackupAt: string | null;
	key: string | null;
	bytes: number | null;
	/** Stockage objet (bucket) configuré ; sinon la sauvegarde va sur le disque local du service. */
	configured: boolean;
}

// --- Restauration, sauvegardes, raccourcis --------------------------------------

export interface RestorePreview {
	valid: boolean;
	exportedAt: string | null;
	/** Lignes par table dans le fichier (clé d'export). */
	counts: Record<string, number>;
	/** Lignes actuellement en base, mêmes clés. */
	current: Record<string, number>;
	warnings: string[];
	errors: string[];
}

export interface RestoreResult {
	ok: true;
	counts: Record<string, number>;
	/** Clé de la sauvegarde de sécurité faite juste avant la restauration. */
	safetyBackup: string;
}

export interface BackupListItem {
	key: string;
	at: string | null;
	bytes: number | null;
	kind: 'hebdo' | 'avant-restauration';
}

export interface ShortcutToken {
	id: number;
	label: string;
	createdAt: string;
	lastUsedAt: string | null;
}

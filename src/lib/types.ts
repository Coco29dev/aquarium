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
}

export interface Completion {
	taskId: number;
	doneAt: string; // ISO
	note?: string | null;
}

/** Opérations saisies hors ligne, renvoyées à l'ouverture suivante. */
export type SyncOp =
	| {
			type: 'measurement';
			clientId: string;
			aquariumId: number;
			parameterId: number;
			value: number;
			measuredAt: string;
	  }
	| { type: 'completion'; clientId: string; taskId: number; doneAt: string; note?: string };

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
}

/** État de la sauvegarde hebdomadaire. */
export interface BackupStatus {
	lastBackupAt: string | null;
	key: string | null;
	bytes: number | null;
	/** Stockage objet (bucket) configuré ; sinon la sauvegarde va sur le disque local du service. */
	configured: boolean;
}

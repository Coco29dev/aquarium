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
	source: 'fishbase' | 'sealifebase' | 'maison';
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

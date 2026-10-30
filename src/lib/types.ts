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

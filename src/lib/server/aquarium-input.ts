import { error } from '@sveltejs/kit';
import { PARAMETER_TEMPLATES, TASK_KINDS } from '$lib/templates';
import type { AquariumStage, ProjectItem, WaterType } from '$lib/types';

// Validation du corps de POST /api/aquariums (création d'un bac, avec ses éléments de départ).
// Sans accès à la base : les fonctions de data.ts font le reste.

type Body = Record<string, unknown>;

export interface NewAquariumInput {
	name: string;
	waterType: WaterType;
	volumeL: number | null;
	startedOn: string | null;
	stage: AquariumStage;
	tasks: { title: string; kind: string; everyDays: number; nextDue?: string }[];
	measurements: { parameterKey: string; value: number; measuredAt?: string }[];
	inhabitants: { kind: 'faune' | 'flore'; species: string; speciesId?: number; quantity: number; arrivedOn?: string }[];
	lastWaterChangeOn?: string;
	projectItems: Omit<ProjectItem, 'id' | 'scopeId'>[];
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ITEMS = 60;

const isObject = (v: unknown): v is Body => typeof v === 'object' && v !== null && !Array.isArray(v);

function list(value: unknown, field: string): Body[] {
	if (value === undefined || value === null) return [];
	if (!Array.isArray(value) || value.length > MAX_ITEMS) error(400, `Liste invalide : ${field}`);
	if (!value.every(isObject)) error(400, `Liste invalide : ${field}`);
	return value as Body[];
}

function str(v: unknown, field: string, max = 200): string {
	if (typeof v !== 'string' || !v.trim() || v.length > max) error(400, `Champ invalide : ${field}`);
	return v.trim();
}

function day(v: unknown, field: string): string {
	if (typeof v !== 'string' || !DAY.test(v)) error(400, `Date invalide : ${field}`);
	return v;
}

function positiveInt(v: unknown, field: string, max = 1_000_000): number {
	if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > max) error(400, `Champ invalide : ${field}`);
	return v;
}

export function parseStage(value: unknown): AquariumStage {
	if (value !== 'projet' && value !== 'cyclage' && value !== 'actif') error(400, 'Étape invalide');
	return value;
}

/** Valide et normalise le corps d'une création de bac. */
export function parseNewAquarium(body: Body, today: string): NewAquariumInput {
	const waterTypeValue = body.waterType;
	if (waterTypeValue !== 'douce' && waterTypeValue !== 'plantee' && waterTypeValue !== 'mer' && waterTypeValue !== 'recif') {
		error(400, "Type d'eau invalide");
	}
	const stage = body.stage === undefined ? 'actif' : parseStage(body.stage);
	const volume = body.volumeL;
	if (volume !== undefined && volume !== null && volume !== '' && (typeof volume !== 'number' || !Number.isFinite(volume) || volume <= 0)) {
		error(400, 'Champ invalide : volumeL');
	}
	let startedOn: string | null = body.startedOn ? day(body.startedOn, 'startedOn') : null;
	if (stage === 'projet') startedOn = null;
	else if (stage === 'cyclage' && !startedOn) startedOn = today;

	const out: NewAquariumInput = {
		name: str(body.name, 'name'),
		waterType: waterTypeValue as WaterType,
		volumeL: typeof volume === 'number' ? volume : null,
		startedOn,
		stage,
		tasks: [],
		measurements: [],
		inhabitants: [],
		projectItems: []
	};

	// Un bac en projet n'est pas en eau : ni tâche, ni mesure, ni habitant.
	if (stage !== 'projet') {
		const kinds: string[] = TASK_KINDS.map((k) => k.value);
		out.tasks = list(body.tasks, 'tasks').map((t) => {
			const kind = typeof t.kind === 'string' && kinds.includes(t.kind) ? t.kind : 'autre';
			return {
				title: str(t.title, 'tasks.title'),
				kind,
				everyDays: positiveInt(t.everyDays, 'tasks.everyDays', 365),
				...(t.nextDue ? { nextDue: day(t.nextDue, 'tasks.nextDue') } : {})
			};
		});

		const keys = new Set((PARAMETER_TEMPLATES[out.waterType] ?? []).map((p) => p.key));
		out.measurements = list(body.measurements, 'measurements').map((m) => {
			const parameterKey = str(m.parameterKey, 'measurements.parameterKey', 40);
			if (!keys.has(parameterKey)) error(400, `Paramètre inconnu pour ce type d'eau : ${parameterKey}`);
			if (typeof m.value !== 'number' || !Number.isFinite(m.value)) error(400, 'Champ invalide : measurements.value');
			if (m.measuredAt !== undefined) {
				if (typeof m.measuredAt !== 'string' || Number.isNaN(Date.parse(m.measuredAt))) error(400, 'Date invalide : measurements.measuredAt');
				if (Date.parse(m.measuredAt) > Date.now() + 5 * 60 * 1000) error(400, 'La date de mesure est dans le futur');
			}
			return { parameterKey, value: m.value, ...(m.measuredAt ? { measuredAt: new Date(m.measuredAt as string).toISOString() } : {}) };
		});

		out.inhabitants = list(body.inhabitants, 'inhabitants').map((h) => {
			if (h.kind !== 'faune' && h.kind !== 'flore') error(400, 'Champ invalide : inhabitants.kind');
			return {
				kind: h.kind,
				species: str(h.species, 'inhabitants.species'),
				...(h.speciesId != null ? { speciesId: positiveInt(h.speciesId, 'inhabitants.speciesId') } : {}),
				quantity: positiveInt(h.quantity ?? 1, 'inhabitants.quantity'),
				...(h.arrivedOn ? { arrivedOn: day(h.arrivedOn, 'inhabitants.arrivedOn') } : {})
			};
		});

		if (body.lastWaterChangeOn) {
			const d = day(body.lastWaterChangeOn, 'lastWaterChangeOn');
			if (d > today) error(400, 'La date du dernier changement d’eau est dans le futur');
			out.lastWaterChangeOn = d;
		}
	}

	out.projectItems = list(body.projectItems, 'projectItems').map((p) => {
		if (p.kind !== 'equipement' && p.kind !== 'espece' && p.kind !== 'budget' && p.kind !== 'etape') error(400, 'Champ invalide : projectItems.kind');
		if (p.amount != null && (typeof p.amount !== 'number' || !Number.isFinite(p.amount) || p.amount < 0 || p.amount > 1e9)) {
			error(400, 'Champ invalide : projectItems.amount');
		}
		return {
			kind: p.kind,
			label: str(p.label, 'projectItems.label'),
			done: p.done === true,
			amount: typeof p.amount === 'number' ? p.amount : null,
			speciesId: p.speciesId != null ? positiveInt(p.speciesId, 'projectItems.speciesId') : null,
			notes: typeof p.notes === 'string' && p.notes.trim() ? p.notes.trim().slice(0, 1000) : null,
			position: 0
		};
	});
	return out;
}

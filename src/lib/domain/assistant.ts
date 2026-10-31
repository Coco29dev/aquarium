import { collectTankAlerts } from './drift';
import { cyclingForAquarium } from './cycling';
import { dueTasks } from './tasks';
import { dayInParis, daysBetween, TIMEZONE } from './dates';
import { feedingsToday } from './feeding';
import type { Aquarium, AquariumEvent, Completion, Feeding, Measurement, Parameter, Task } from '../types';
import { WATER_TYPE_LABELS } from '../types';

// Logique pure de l'assistant (sans accès base ni réseau) : outils, contexte du bac, historique affichable.

/** Outils qui modifient des données : chacun attend la confirmation de l'utilisateur avant d'agir. */
export const WRITE_TOOLS = ['noter_mesure', 'terminer_tache', 'noter_repas', 'ajouter_note'] as const;
/** Outils de lecture : exécutés tout de suite. */
export const READ_TOOLS = ['historique_parametre'] as const;

export type AssistantToolName = (typeof WRITE_TOOLS)[number] | (typeof READ_TOOLS)[number];

export const isWriteTool = (name: string): boolean => (WRITE_TOOLS as readonly string[]).includes(name);

/** Résultat renvoyé au modèle quand l'utilisateur refuse une action. */
export const REFUSED_TEXT = "L'utilisateur a refusé cette action : ne la refais pas sans qu'il le demande.";

const fr = (value: number, decimals = 2) => value.toLocaleString('fr-FR', { maximumFractionDigits: decimals });
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Phrase courte décrivant une action, montrée sur la carte de confirmation. */
export function describeAction(name: string, input: Record<string, unknown>): string {
	switch (name) {
		case 'noter_mesure': {
			const value = typeof input.valeur === 'number' ? fr(input.valeur) : '?';
			const when = str(input.date);
			return `Noter ${str(input.parametre) || 'une mesure'} : ${value}${when ? ` (${when})` : ''}`;
		}
		case 'terminer_tache':
			return `Cocher la tâche « ${str(input.tache) || '?'} »`;
		case 'noter_repas': {
			const note = str(input.note);
			return `Noter un repas${note ? ` (${note})` : ''}`;
		}
		case 'ajouter_note':
			return `Ajouter une note : « ${str(input.texte).slice(0, 120) || '?'} »`;
		default:
			return name;
	}
}

// --- Événements de flux (serveur → écran) --------------------------------------------------

export interface PendingAction {
	id: string;
	name: string;
	label: string;
	input: Record<string, unknown>;
}

export type ActionStatus = 'pending' | 'done' | 'refused' | 'error';

export type AssistantEvent =
	| { type: 'text'; text: string }
	| { type: 'action'; id: string; label: string; status: Exclude<ActionStatus, 'pending'>; detail: string }
	| { type: 'pending'; actions: PendingAction[] }
	| { type: 'done' }
	| { type: 'error'; message: string };

// --- Historique ----------------------------------------------------------------------------

export interface StoredMessage {
	id: number;
	role: 'user' | 'assistant';
	/** JSON des blocs de contenu (ou simple texte). */
	content: string;
}

interface Block {
	type?: string;
	text?: string;
	id?: string;
	name?: string;
	input?: Record<string, unknown>;
	tool_use_id?: string;
	content?: unknown;
	is_error?: boolean;
}

export function parseBlocks(content: string): Block[] {
	try {
		const value: unknown = JSON.parse(content);
		if (typeof value === 'string') return [{ type: 'text', text: value }];
		return Array.isArray(value) ? (value as Block[]) : [];
	} catch {
		return [{ type: 'text', text: content }];
	}
}

const resultText = (content: unknown): string => {
	if (typeof content === 'string') return content;
	if (Array.isArray(content)) return content.map((b) => (b && typeof b === 'object' && 'text' in b ? String((b as Block).text ?? '') : '')).join('');
	return '';
};

export type DisplayItem =
	| { kind: 'user'; key: string; text: string }
	| { kind: 'assistant'; key: string; text: string }
	| { kind: 'action'; key: string; id: string; name: string; label: string; status: ActionStatus; detail: string };

/** Ce que l'écran affiche : les textes échangés et les actions proposées (avec leur issue). */
export function toDisplay(rows: StoredMessage[]): DisplayItem[] {
	const results = new Map<string, Block>();
	for (const row of rows) {
		if (row.role !== 'user') continue;
		for (const b of parseBlocks(row.content)) if (b.type === 'tool_result' && b.tool_use_id) results.set(b.tool_use_id, b);
	}
	const items: DisplayItem[] = [];
	for (const row of rows) {
		const blocks = parseBlocks(row.content);
		if (row.role === 'user') {
			if (blocks.some((b) => b.type === 'tool_result')) continue;
			// Le premier bloc est le contexte du bac, ajouté par le serveur : seul le dernier texte est celui de l'utilisateur.
			const texts = blocks.filter((b) => b.type === 'text');
			const last = texts[texts.length - 1];
			if (last?.text) items.push({ kind: 'user', key: `m${row.id}`, text: last.text });
			continue;
		}
		const text = blocks
			.filter((b) => b.type === 'text' && b.text)
			.map((b) => b.text)
			.join('');
		if (text.trim()) items.push({ kind: 'assistant', key: `m${row.id}`, text });
		for (const b of blocks) {
			if (b.type !== 'tool_use' || !b.id || !b.name || !isWriteTool(b.name)) continue;
			const result = results.get(b.id);
			const detail = result ? resultText(result.content) : '';
			const status: ActionStatus = !result ? 'pending' : detail === REFUSED_TEXT ? 'refused' : result.is_error ? 'error' : 'done';
			items.push({ kind: 'action', key: `a${b.id}`, id: b.id, name: b.name, label: describeAction(b.name, b.input ?? {}), status, detail });
		}
	}
	return items;
}

/** Appels d'écriture du dernier message de l'assistant qui attendent encore une réponse. */
export function pendingActions(rows: StoredMessage[]): PendingAction[] {
	const last = rows[rows.length - 1];
	if (!last || last.role !== 'assistant') return [];
	return parseBlocks(last.content)
		.filter((b) => b.type === 'tool_use' && b.id && b.name && isWriteTool(b.name))
		.map((b) => ({ id: b.id!, name: b.name!, label: describeAction(b.name!, b.input ?? {}), input: b.input ?? {} }));
}

// --- Contexte du bac -----------------------------------------------------------------------

export interface ContextInhabitant {
	kind: 'faune' | 'flore';
	species: string;
	quantity: number;
	arrivedOn: string | null;
	notes: string | null;
}

export interface ContextInput {
	aquarium: Aquarium;
	parameters: Parameter[];
	measurements: Measurement[];
	tasks: Task[];
	completions?: Completion[];
	events?: AquariumEvent[];
	feedings?: Feeding[];
	inhabitants: ContextInhabitant[];
	now?: number;
}

const ago = (iso: string, now: number): string => {
	const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
	if (minutes < 60) return `il y a ${Math.max(minutes, 1)} min`;
	if (minutes < 48 * 60) return `il y a ${Math.round(minutes / 60)} h`;
	return `il y a ${Math.round(minutes / 1440)} j`;
};

const EVENT_LABELS: Record<string, string> = {
	changement_eau: "changement d'eau",
	appoint: 'appoint',
	dosage: 'dosage',
	eclairage: 'éclairage',
	co2: 'CO₂',
	maintenance: 'maintenance',
	habitant_ajout: 'arrivée',
	habitant_depart: 'départ',
	etape: 'étape',
	note: 'note'
};

/**
 * Résumé de l'état d'un bac, joint à chaque message de l'utilisateur. Court (quelques centaines de
 * tokens) : dernières valeurs, alertes, cyclage, tâches, habitants et derniers faits du journal.
 */
export function buildContext(input: ContextInput): string {
	const now = input.now ?? Date.now();
	const { aquarium } = input;
	const parameters = input.parameters.filter((p) => p.aquariumId === aquarium.id);
	const measurements = input.measurements.filter((m) => m.aquariumId === aquarium.id);
	const tasks = input.tasks.filter((t) => t.aquariumId === aquarium.id);
	const events = (input.events ?? []).filter((e) => e.aquariumId === aquarium.id);
	const completions = input.completions ?? [];
	const today = dayInParis(now);

	const lines: string[] = [];
	const stamp = new Date(now).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: TIMEZONE });
	lines.push(`[Contexte du bac, relevé le ${stamp}]`);

	const age = aquarium.startedOn ? `, en eau depuis ${daysBetween(aquarium.startedOn, today)} jours` : '';
	const volume = aquarium.volumeL ? `, ${fr(aquarium.volumeL, 1)} L` : '';
	lines.push(`Bac « ${aquarium.name} » : ${WATER_TYPE_LABELS[aquarium.waterType]}${volume}${age}, étape ${aquarium.stage ?? 'actif'}.`);

	const alive = input.inhabitants.filter((i) => i.quantity > 0);
	lines.push(
		alive.length
			? `Habitants : ${alive.map((i) => `${i.quantity} ${i.species}${i.kind === 'flore' ? ' (plante)' : ''}${i.notes ? ` [${i.notes.slice(0, 60)}]` : ''}`).join(' ; ')}.`
			: 'Habitants : aucun enregistré.'
	);

	if (parameters.length) {
		lines.push('Paramètres (dernière mesure, plage visée) :');
		for (const p of parameters) {
			const last = measurements.filter((m) => m.parameterId === p.id).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0];
			const range = p.min != null || p.max != null ? `plage ${p.min != null ? fr(p.min) : '…'} à ${p.max != null ? fr(p.max) : '…'}` : 'pas de plage';
			const unit = p.unit ? ` ${p.unit}` : '';
			lines.push(`- ${p.name} : ${last ? `${fr(last.value, Math.max(p.decimals, 2))}${unit} (${ago(last.measuredAt, now)})` : 'jamais mesuré'} ; ${range}`);
		}
	}

	const alerts = collectTankAlerts({ parameters, measurements, tasks, completions, events }, now);
	if (alerts.length) lines.push(`Alertes : ${alerts.map((a) => a.message).join(' ; ')}.`);
	const cycling = cyclingForAquarium(parameters, measurements);
	if (cycling && cycling.stage !== 'aucune_mesure' && aquarium.stage !== 'actif') lines.push(`Cyclage : ${cycling.title}. ${cycling.advice}`);

	const due = dueTasks(tasks, now);
	if (due.length) lines.push(`Tâches à faire : ${due.map((t) => `${t.title} (prévue ${t.nextDue})`).join(' ; ')}.`);
	const later = tasks
		.filter((t) => t.active && t.nextDue > today)
		.sort((a, b) => a.nextDue.localeCompare(b.nextDue))
		.slice(0, 3);
	if (later.length) lines.push(`Prochaines tâches : ${later.map((t) => `${t.title} (${t.nextDue})`).join(' ; ')}.`);

	if (input.feedings) {
		const { count } = feedingsToday(input.feedings, aquarium.id, now);
		lines.push(`Repas aujourd'hui : ${count}${aquarium.feedingsPerDay ? ` sur ${aquarium.feedingsPerDay} prévus` : ''}.`);
	}

	const recent = [...events].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
	if (recent.length) {
		lines.push(
			'Journal récent : ' +
				recent.map((e) => `${ago(e.at, now)} ${EVENT_LABELS[e.kind] ?? e.kind}${e.note ? ` (${e.note.slice(0, 80)})` : ''}`).join(' ; ') +
				'.'
		);
	}
	return lines.join('\n');
}

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

/** Photos jointes à un message au plus. */
export const MAX_IMAGES = 4;
/** Texte du message quand l'utilisateur n'envoie qu'une photo (l'API refuse un texte vide). */
export const PHOTO_ONLY_TEXT = 'Voici une photo.';

// --- Conversations ---------------------------------------------------------------------------

export interface ThreadSummary {
	id: number;
	aquariumId: number;
	title: string | null;
	/** Début du premier message de l'utilisateur, pour une conversation sans titre. */
	preview: string;
	updatedAt: string; // ISO
	/** Messages écrits par l'utilisateur dans la conversation. */
	messages: number;
	/** Photos envoyées dans la conversation (supprimées avec elle). */
	images: number;
}

export const threadLabel = (t: Pick<ThreadSummary, 'title' | 'preview'>): string => t.title?.trim() || t.preview.trim().slice(0, 60) || 'Nouvelle conversation';

/** Premier message de l'utilisateur d'une conversation, tel qu'il l'a écrit (sans le contexte joint). */
export function firstUserText(rows: StoredMessage[]): string {
	const first = rows.find((r) => r.role === 'user' && !parseBlocks(r.content).some((b) => b.type === 'tool_result'));
	if (!first) return '';
	const texts = parseBlocks(first.content).filter((b) => b.type === 'text');
	return texts[texts.length - 1]?.text ?? '';
}

export interface ThreadGroup {
	label: string;
	threads: ThreadSummary[];
}

/** Regroupe par ancienneté (jours calendaires de Paris), les plus récentes d'abord. */
export function groupByRecency(threads: ThreadSummary[], now: number = Date.now()): ThreadGroup[] {
	const today = dayInParis(now);
	const buckets: ThreadGroup[] = [
		{ label: "Aujourd'hui", threads: [] },
		{ label: 'Hier', threads: [] },
		{ label: '7 derniers jours', threads: [] },
		{ label: '30 derniers jours', threads: [] },
		{ label: 'Plus ancien', threads: [] }
	];
	for (const t of [...threads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
		const age = daysBetween(dayInParis(t.updatedAt), today);
		buckets[age <= 0 ? 0 : age === 1 ? 1 : age <= 7 ? 2 : age <= 30 ? 3 : 4].threads.push(t);
	}
	return buckets.filter((b) => b.threads.length);
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
	| { type: 'thread'; id: number }
	| { type: 'text'; text: string }
	/** Ce que l'assistant est en train de faire (lecture d'un historique…), le temps d'un outil de lecture. */
	| { type: 'status'; text: string }
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
	/** Instant d'écriture (ISO), quand la lecture l'a demandé : sert aux repères d'heure de la conversation. */
	at?: string;
}

interface Block {
	type?: string;
	/** Bloc maison `x_image` : la photo est dans le stockage, le serveur la remplace par une image à l'envoi à Claude. */
	attachment_id?: number;
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
	| { kind: 'user'; key: string; text: string; images: number[]; at?: string }
	| { kind: 'assistant'; key: string; text: string; at?: string }
	| { kind: 'action'; key: string; id: string; name: string; label: string; status: ActionStatus; detail: string; at?: string };

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
			const images = blocks.filter((b) => b.type === 'x_image' && typeof b.attachment_id === 'number').map((b) => b.attachment_id!);
			if (last?.text) items.push({ kind: 'user', key: `m${row.id}`, text: last.text, images, at: row.at });
			continue;
		}
		const text = blocks
			.filter((b) => b.type === 'text' && b.text)
			.map((b) => b.text)
			.join('');
		if (text.trim()) items.push({ kind: 'assistant', key: `m${row.id}`, text, at: row.at });
		for (const b of blocks) {
			if (b.type !== 'tool_use' || !b.id || !b.name || !isWriteTool(b.name)) continue;
			const result = results.get(b.id);
			const detail = result ? resultText(result.content) : '';
			const status: ActionStatus = !result ? 'pending' : detail === REFUSED_TEXT ? 'refused' : result.is_error ? 'error' : 'done';
			items.push({ kind: 'action', key: `a${b.id}`, id: b.id, name: b.name, label: describeAction(b.name, b.input ?? {}), status, detail, at: row.at });
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

// --- Affichage de la conversation ------------------------------------------------------------

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

/** Ce que l'écran dit pendant qu'un outil de lecture tourne. */
export function describeRead(name: string, input: Record<string, unknown>): string {
	if (name === 'historique_parametre') {
		const parameter = str(input.parametre);
		return parameter ? `Je relis l’historique (${parameter})…` : 'Je relis l’historique des mesures…';
	}
	return 'Je regarde ton bac…';
}

/** Une ligne de la conversation : un message, une action, ou un repère d'heure entre deux échanges éloignés. */
export type ChatEntry = DisplayItem | { kind: 'time'; key: string; label: string };

const clock = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE });

/** « Aujourd’hui 14:32 », « Hier 09:10 », « lundi 18:05 », « 3 nov. 18:05 » (heure de Paris). */
export function timeMarkLabel(iso: string, now: number = Date.now()): string {
	const age = daysBetween(dayInParis(iso), dayInParis(now));
	if (age <= 0) return `Aujourd’hui ${clock(iso)}`;
	if (age === 1) return `Hier ${clock(iso)}`;
	const sameYear = dayInParis(iso).slice(0, 4) === dayInParis(now).slice(0, 4);
	const format: Intl.DateTimeFormatOptions = age < 7 ? { weekday: 'long' } : sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' };
	return `${new Date(iso).toLocaleDateString('fr-FR', { ...format, timeZone: TIMEZONE })} ${clock(iso)}`;
}

/** Quand une conversation a été active, pour la liste : l'heure aujourd'hui, puis « Hier », le jour, la date. */
export function threadWhen(iso: string, now: number = Date.now()): string {
	const age = daysBetween(dayInParis(iso), dayInParis(now));
	if (age <= 0) return clock(iso);
	if (age === 1) return 'Hier';
	if (age < 7) return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', timeZone: TIMEZONE });
	const sameYear = dayInParis(iso).slice(0, 4) === dayInParis(now).slice(0, 4);
	return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), timeZone: TIMEZONE });
}

/** Écart à partir duquel un nouveau repère d'heure est posé dans la conversation. */
export const TIME_GAP_MS = 60 * 60_000;

/**
 * Intercale un repère d'heure au début de la conversation et chaque fois que deux messages sont séparés
 * d'une heure ou plus, comme Messages. Les éléments sans heure (affichés pendant le flux) n'en reçoivent pas.
 */
export function withTimeMarks(items: DisplayItem[], now: number = Date.now(), gap: number = TIME_GAP_MS): ChatEntry[] {
	const out: ChatEntry[] = [];
	let previous: number | null = null;
	for (const item of items) {
		const at = item.at ? Date.parse(item.at) : NaN;
		if (!Number.isNaN(at)) {
			if (previous === null || at - previous >= gap) out.push({ kind: 'time', key: `t${item.key}`, label: timeMarkLabel(item.at!, now) });
			previous = at;
		}
		out.push(item);
	}
	return out;
}

export type SuggestionIcon = 'alert' | 'today' | 'cycle' | 'flask' | 'chart' | 'bacs';

export interface PromptSuggestion {
	/** Texte court de la puce. */
	label: string;
	/** Message envoyé à l'assistant quand on la touche. */
	prompt: string;
	icon: SuggestionIcon;
}

export interface SuggestionInput {
	/** Paramètres en alerte (hors plage ou en dérive), déjà en noms simples : « Nitrates », « pH ». */
	alerts: string[];
	/** Tâches à faire maintenant. */
	due: number;
	/** Le bac est en cyclage. */
	cycling: boolean;
	/** Au moins une mesure a été saisie. */
	measured: boolean;
}

/** Trois propositions de première question, tirées de l'état du bac : une alerte, le cyclage, les tâches, sinon des classiques. */
export function suggestPrompts(input: SuggestionInput): PromptSuggestion[] {
	const out: PromptSuggestion[] = [];
	if (input.alerts.length === 1) {
		out.push({ icon: 'alert', label: `${input.alerts[0]} à regarder`, prompt: `J’ai une alerte sur ${input.alerts[0]}. Qu’est-ce que je dois faire ?` });
	} else if (input.alerts.length > 1) {
		out.push({ icon: 'alert', label: `${input.alerts.length} valeurs à regarder`, prompt: `J’ai plusieurs alertes (${input.alerts.slice(0, 3).join(', ')}). Par quoi commencer ?` });
	}
	if (input.cycling) out.push({ icon: 'cycle', label: 'Où en est le cyclage ?', prompt: 'Où en est le cyclage de mon bac ? Quand pourrai-je ajouter des poissons ?' });
	if (input.due > 0) out.push({ icon: 'today', label: 'Que faire aujourd’hui ?', prompt: 'Que dois-je faire aujourd’hui sur ce bac ?' });
	if (!input.measured) out.push({ icon: 'flask', label: 'Quelles mesures faire ?', prompt: 'Quelles mesures devrais-je faire en premier sur ce bac ?' });
	const classics: PromptSuggestion[] = [
		{ icon: 'bacs', label: 'Où en est mon bac ?', prompt: 'Où en est mon bac ?' },
		...(input.measured ? [{ icon: 'chart', label: 'Mes valeurs sont bonnes ?', prompt: 'Mes valeurs sont-elles correctes ?' } satisfies PromptSuggestion] : []),
		{ icon: 'today', label: 'Que faire cette semaine ?', prompt: 'Que dois-je faire cette semaine ?' }
	];
	for (const suggestion of classics) if (out.length < 3 && !out.some((o) => o.icon === suggestion.icon)) out.push(suggestion);
	return out.slice(0, 3);
}

/** Titre et texte de l'alerte de confirmation avant de supprimer une ou plusieurs conversations. */
export function describeDeletion(threads: Pick<ThreadSummary, 'title' | 'preview' | 'images'>[]): { title: string; message: string } {
	const photos = threads.reduce((sum, t) => sum + t.images, 0);
	const withPhotos = photos > 0 ? `, avec ${photos} ${plural(photos, 'photo', 'photos')}` : '';
	const kept = photos > 0 ? ' Les photos déjà ajoutées à la galerie du bac restent.' : '';
	if (threads.length === 1) {
		const label = threadLabel(threads[0]);
		return { title: 'Supprimer cette conversation ?', message: `« ${label.length > 40 ? `${label.slice(0, 39).trimEnd()}…` : label} » sera supprimée définitivement${withPhotos}.${kept}` };
	}
	return { title: `Supprimer ${threads.length} conversations ?`, message: `Ces ${threads.length} conversations seront supprimées définitivement${withPhotos}.${kept}` };
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

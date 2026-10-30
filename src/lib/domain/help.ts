// Fiche « Demander de l'aide » : un résumé du bac en Markdown léger, prêt à coller sur un forum ou Discord.
// C'est ce qu'on demande d'abord à quelqu'un qui pose une question : type de bac, paramètres, peuplement,
// matériel et dernières actions. Fonction pure ; aucune donnée personnelle (ni nom de bac, ni identité).

import { analyzeParameter, collectAlerts, slopePerDay } from './drift';
import { dayInParis, daysBetween, DAY_MS } from './dates';
import { daysSinceEvent, eventSummary } from './events';
import { WATER_TYPE_LABELS, type Aquarium, type AquariumEvent, type Completion, type Measurement, type Parameter, type Snapshot, type Task } from '../types';

export interface HelpInhabitant {
	kind: 'faune' | 'flore';
	species: string;
	quantity: number;
	arrivedOn?: string | null;
	leftOn?: string | null;
}

export interface HelpEquipment {
	name: string;
	category?: string | null;
}

export interface HelpOptions {
	days: 14 | 30;
	include: { params: boolean; stock: boolean; equipment: boolean; actions: boolean; alerts: boolean };
	question: string;
}

export interface HelpInput extends HelpOptions {
	view: Pick<Snapshot, 'aquariums' | 'parameters' | 'measurements' | 'tasks'> & {
		completions?: Completion[];
		events?: AquariumEvent[];
	};
	aquariumId: number;
	inhabitants: HelpInhabitant[];
	equipment: HelpEquipment[];
	/** Instant de référence (millisecondes) ; défaut : maintenant. */
	now?: number;
}

const MAX_EQUIPMENT = 8;
const MAX_ACTIONS = 15;
const RECENT_ARRIVAL_DAYS = 14;

const num = (value: number, decimals: number) =>
	value.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const short = (iso: string | number) =>
	new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' });

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

function ageText(aquarium: Pick<Aquarium, 'startedOn' | 'stage'>, today: string): string {
	if ((aquarium.stage ?? 'actif') === 'projet') return 'bac en projet, pas encore en eau';
	if (!aquarium.startedOn) return 'date de mise en eau inconnue';
	const days = Math.max(0, daysBetween(aquarium.startedOn, today));
	if (days < 60) return `en eau depuis ${days} ${plural(days, 'jour', 'jours')}`;
	const months = Math.round(days / 30.44);
	return `en eau depuis ${months} mois`;
}

function relative(iso: string, now: number): string {
	const d = daysBetween(dayInParis(iso), dayInParis(now));
	if (d <= 0) return "aujourd'hui";
	if (d === 1) return 'hier';
	return `il y a ${d} j`;
}

interface Row {
	parameter: Parameter;
	last: Measurement | null;
	trend: string;
	state: string;
	alert: boolean;
}

function trendOf(parameter: Parameter, list: Measurement[], now: number): string {
	const since = now - 7 * DAY_MS;
	const points = list
		.map((m) => ({ t: new Date(m.measuredAt).getTime(), v: m.value }))
		.filter((p) => p.t >= since && p.t <= now);
	if (points.length < 3 || points[points.length - 1].t - points[0].t < 2 * DAY_MS) return '—';
	const slope = slopePerDay(points);
	if (slope == null) return '—';
	const change = slope * 7;
	const width = parameter.min != null && parameter.max != null ? parameter.max - parameter.min : null;
	const flat = width && width > 0 ? Math.abs(change) < 0.1 * width : Math.abs(change) < 10 ** -parameter.decimals;
	if (flat) return 'stable';
	return `${change > 0 ? '↑' : '↓'} ${num(Math.abs(change), parameter.decimals)}${parameter.unit ? ` ${parameter.unit}` : ''}`;
}

function rowsFor(aquarium: Aquarium, input: HelpInput, now: number): Row[] {
	const parameters = input.view.parameters.filter((p) => p.aquariumId === aquarium.id);
	return parameters.map((parameter) => {
		const list = input.view.measurements
			.filter((m) => m.parameterId === parameter.id)
			.sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
		const last = list.length ? list[list.length - 1] : null;
		const alert = analyzeParameter(parameter, list, now);
		let state = '—';
		if (last) {
			if (alert?.level === 'hors_plage') state = parameter.max != null && last.value > parameter.max ? 'hors plage (au-dessus)' : 'hors plage (en dessous)';
			else if (alert?.level === 'derive') state = 'dérive rapide';
			else state = parameter.min != null || parameter.max != null ? 'dans la plage' : 'ok';
		}
		return { parameter, last, trend: trendOf(parameter, list, now), state, alert: Boolean(alert) };
	});
}

function plage(p: Parameter): string {
	if (p.min == null && p.max == null) return '—';
	return `${p.min != null ? num(p.min, p.decimals) : '…'}–${p.max != null ? num(p.max, p.decimals) : '…'}`;
}

/** Texte à coller dans une demande d'aide. */
export function buildHelpText(input: HelpInput): string {
	const now = input.now ?? Date.now();
	const today = dayInParis(now);
	const aquarium = input.view.aquariums.find((a) => a.id === input.aquariumId);
	if (!aquarium) return '';
	const { include, days } = input;
	const since = now - days * DAY_MS;
	const lines: string[] = [];

	const volume = aquarium.volumeL ? ` · ${num(aquarium.volumeL, 0)} L` : '';
	lines.push(`**${WATER_TYPE_LABELS[aquarium.waterType]}${volume} · ${ageText(aquarium, today)}**`);
	const stage = aquarium.stage ?? 'actif';
	if (stage === 'cyclage') lines.push('Étape : cyclage en cours, pas encore de poissons.');
	const question = input.question.trim();
	if (question) {
		lines.push('', '**Ma question**', question);
	}

	const rows = rowsFor(aquarium, input, now);

	if (include.params) {
		const measured = rows.filter((r) => r.last);
		lines.push('', '**Paramètres**');
		if (!measured.length) lines.push('Aucune mesure enregistrée pour le moment.');
		else {
			lines.push('| Paramètre | Dernière valeur | Mesurée | Plage visée | Tendance 7 j | État |', '| --- | --- | --- | --- | --- | --- |');
			for (const r of measured) {
				const p = r.parameter;
				const value = `${num(r.last!.value, p.decimals)}${p.unit ? ` ${p.unit}` : ''}`;
				lines.push(`| ${p.name} | ${value} | ${relative(r.last!.measuredAt, now)} | ${plage(p)} | ${r.trend} | ${r.state} |`);
			}
		}

		// Historique des paramètres concernés : hors plage, en dérive, et ceux du cycle de l'azote en cyclage.
		const cycleKeys = new Set(stage === 'cyclage' ? ['nh3', 'no2', 'no3'] : []);
		const concerned = rows.filter((r) => r.alert || cycleKeys.has(r.parameter.key ?? ''));
		const history: string[] = [];
		for (const r of concerned) {
			const p = r.parameter;
			const values = input.view.measurements
				.filter((m) => m.parameterId === p.id && new Date(m.measuredAt).getTime() >= since)
				.sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
				.map((m) => `${num(m.value, p.decimals)} (${short(m.measuredAt)})`);
			if (values.length) history.push(`- ${p.name}${p.unit ? ` (${p.unit})` : ''} : ${values.join(', ')}`);
		}
		if (history.length) lines.push('', `**Mesures des ${days} derniers jours**`, ...history);
	}

	if (include.alerts) {
		const alerts = collectAlerts(
			input.view.parameters.filter((p) => p.aquariumId === aquarium.id),
			input.view.measurements.filter((m) => m.aquariumId === aquarium.id),
			now
		);
		lines.push('', '**Alertes en cours**');
		if (!alerts.length) lines.push('Aucune alerte.');
		else for (const a of alerts) lines.push(`- ${a.message}`);
	}

	if (include.stock) {
		const present = input.inhabitants.filter((h) => !h.leftOn);
		lines.push('', '**Peuplement**');
		if (!present.length) lines.push('Aucun habitant enregistré.');
		for (const h of present) {
			const recent = h.arrivedOn ? daysBetween(h.arrivedOn, today) <= RECENT_ARRIVAL_DAYS : false;
			const arrival = h.arrivedOn ? (recent ? ` — **arrivé ${relative(`${h.arrivedOn}T12:00:00Z`, now)}**` : ` (arrivé le ${short(`${h.arrivedOn}T12:00:00Z`)})`) : '';
			lines.push(`- ${h.quantity} × ${h.species}${arrival}`);
		}
		const departures = (input.view.events ?? []).filter(
			(e) => e.aquariumId === aquarium.id && e.kind === 'habitant_depart' && new Date(e.at).getTime() >= since
		);
		if (departures.length) {
			lines.push('', `Départs et pertes des ${days} derniers jours :`);
			for (const e of departures) lines.push(`- ${short(e.at)} : ${eventSummary(e).replace(/^Départ · /, '')}`);
		}
	}

	if (include.equipment && input.equipment.length) {
		lines.push('', '**Matériel**');
		for (const e of input.equipment.slice(0, MAX_EQUIPMENT)) lines.push(`- ${e.name}${e.category && e.category !== 'autre' ? ` (${e.category})` : ''}`);
		if (input.equipment.length > MAX_EQUIPMENT) lines.push(`- … et ${input.equipment.length - MAX_EQUIPMENT} autre${input.equipment.length - MAX_EQUIPMENT > 1 ? 's' : ''}`);
	}

	if (include.actions) {
		const events = (input.view.events ?? []).filter(
			(e) => e.aquariumId === aquarium.id && new Date(e.at).getTime() >= since && e.kind !== 'habitant_depart'
		);
		// Les changements d'eau cochés existent à la fois comme réalisation et comme événement : on ne garde que l'événement.
		const taskById = new Map<number, Task>(input.view.tasks.map((t) => [t.id, t]));
		const done = (input.view.completions ?? [])
			.map((c) => ({ c, task: taskById.get(c.taskId) }))
			.filter((x): x is { c: Completion; task: Task } => Boolean(x.task) && x.task!.aquariumId === aquarium.id && x.task!.kind !== 'eau' && new Date(x.c.doneAt).getTime() >= since);
		const items = [
			...events.map((e) => ({ at: e.at, text: eventSummary(e) })),
			...done.map(({ c, task }) => ({ at: c.doneAt, text: task.title }))
		].sort((a, b) => b.at.localeCompare(a.at));

		lines.push('', `**Dernières actions (${days} jours)**`);
		const waterDays = daysSinceEvent(input.view.events ?? [], aquarium.id, 'changement_eau', now);
		lines.push(waterDays == null ? 'Dernier changement d’eau : non enregistré.' : `Dernier changement d’eau : ${waterDays === 0 ? "aujourd'hui" : `il y a ${waterDays} j`}.`);
		for (const item of items.slice(0, MAX_ACTIONS)) lines.push(`- ${short(item.at)} : ${item.text}`);
		if (!items.length) lines.push('Rien d’enregistré sur la période.');
	}

	lines.push('', '_Résumé généré avec l’appli Aquarium._');
	return lines.join('\n');
}

import { describe, expect, it } from 'vitest';
import {
	REFUSED_TEXT,
	buildContext,
	describeAction,
	describeDeletion,
	describeRead,
	firstUserText,
	groupByRecency,
	isWriteTool,
	pendingActions,
	suggestPrompts,
	threadLabel,
	threadWhen,
	timeMarkLabel,
	toDisplay,
	withTimeMarks,
	type DisplayItem,
	type StoredMessage,
	type ThreadSummary
} from './assistant';
import { frenchSpaces, renderMarkdown } from './markdown';
import type { Aquarium, Measurement, Parameter, Task } from '../types';

const NOW = Date.parse('2026-10-31T12:00:00Z');
const row = (id: number, role: 'user' | 'assistant', content: unknown): StoredMessage => ({ id, role, content: JSON.stringify(content) });

describe('outils', () => {
	it("sépare lecture et écriture", () => {
		expect(isWriteTool('noter_mesure')).toBe(true);
		expect(isWriteTool('historique_parametre')).toBe(false);
		expect(isWriteTool('inconnu')).toBe(false);
	});

	it('décrit les actions pour la carte de confirmation', () => {
		expect(describeAction('noter_mesure', { parametre: 'pH', valeur: 7.2 })).toBe('Noter pH : 7,2');
		expect(describeAction('terminer_tache', { tache: "changement d'eau" })).toContain("changement d'eau");
		expect(describeAction('noter_repas', {})).toBe('Noter un repas');
	});
});

describe('historique affichable', () => {
	const ask = row(1, 'user', [
		{ type: 'text', text: '[Contexte du bac]' },
		{ type: 'text', text: 'Nitrates à 25' }
	]);
	const propose = row(2, 'assistant', [
		{ type: 'thinking', thinking: '', signature: 'x' },
		{ type: 'text', text: 'Je le note.' },
		{ type: 'tool_use', id: 't1', name: 'noter_mesure', input: { parametre: 'nitrates', valeur: 25 } }
	]);

	it('masque le contexte et les raisonnements, garde le texte et l’action en attente', () => {
		const items = toDisplay([ask, propose]);
		expect(items.map((i) => i.kind)).toEqual(['user', 'assistant', 'action']);
		expect(items[0]).toMatchObject({ text: 'Nitrates à 25' });
		expect(items[2]).toMatchObject({ status: 'pending', name: 'noter_mesure' });
	});

	it('reporte l’issue des actions et masque les résultats d’outils', () => {
		const done = row(3, 'user', [{ type: 'tool_result', tool_use_id: 't1', content: 'Nitrates noté.' }]);
		const items = toDisplay([ask, propose, done]);
		expect(items).toHaveLength(3);
		expect(items[2]).toMatchObject({ status: 'done', detail: 'Nitrates noté.' });
		const refused = row(3, 'user', [{ type: 'tool_result', tool_use_id: 't1', content: REFUSED_TEXT }]);
		expect(toDisplay([ask, propose, refused])[2]).toMatchObject({ status: 'refused' });
		const failed = row(3, 'user', [{ type: 'tool_result', tool_use_id: 't1', content: 'Paramètre inconnu', is_error: true }]);
		expect(toDisplay([ask, propose, failed])[2]).toMatchObject({ status: 'error' });
	});

	it('repère les actions en attente seulement tant que rien n’a répondu', () => {
		expect(pendingActions([ask, propose])).toHaveLength(1);
		expect(pendingActions([ask, propose, row(3, 'user', [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }])])).toHaveLength(0);
		expect(pendingActions([ask])).toHaveLength(0);
		const reading = row(2, 'assistant', [{ type: 'tool_use', id: 't9', name: 'historique_parametre', input: {} }]);
		expect(pendingActions([ask, reading])).toHaveLength(0);
	});
});

describe('contexte du bac', () => {
	const aquarium: Aquarium = { id: 1, name: 'Salon', waterType: 'plantee', volumeL: 120, startedOn: '2026-08-01', coverPhotoId: null, stage: 'actif', feedingsPerDay: 1 };
	const parameters: Parameter[] = [
		{ id: 10, aquariumId: 1, key: 'ph', name: 'pH', unit: '', min: 6.5, max: 7.5, driftPerWeek: 0.5, decimals: 1, step: 0.1, position: 0 },
		{ id: 11, aquariumId: 2, key: 'ph', name: 'pH autre bac', unit: '', min: 6.5, max: 7.5, driftPerWeek: 0.5, decimals: 1, step: 0.1, position: 0 }
	];
	const measurements: Measurement[] = [
		{ parameterId: 10, aquariumId: 1, value: 8.1, measuredAt: '2026-10-31T09:00:00.000Z' },
		{ parameterId: 11, aquariumId: 2, value: 7, measuredAt: '2026-10-31T09:00:00.000Z' }
	];
	const tasks: Task[] = [{ id: 1, aquariumId: 1, title: "Changement d'eau", kind: 'eau', everyDays: 7, nextDue: '2026-10-30', active: true }];

	it('résume le bac demandé, ses alertes et ses tâches dues, sans mêler l’autre bac', () => {
		const text = buildContext({
			aquarium,
			parameters,
			measurements,
			tasks,
			inhabitants: [{ kind: 'faune', species: 'Néon', quantity: 8, arrivedOn: null, notes: null }],
			now: NOW
		});
		expect(text).toContain('Bac « Salon »');
		expect(text).toContain('120 L');
		expect(text).toContain('8 Néon');
		expect(text).toContain('pH : 8,1');
		expect(text).toContain('Alertes');
		expect(text).toContain("Changement d'eau");
		expect(text).not.toContain('autre bac');
	});

	it('reste valable pour un bac vide', () => {
		const text = buildContext({ aquarium, parameters: [], measurements: [], tasks: [], inhabitants: [], now: NOW });
		expect(text).toContain('Habitants : aucun enregistré');
	});
});

describe('markdown', () => {
	it('échappe le HTML', () => {
		expect(renderMarkdown('<img src=x onerror=alert(1)>')).not.toContain('<img');
	});
	it('met en forme gras, listes et paragraphes', () => {
		expect(renderMarkdown('**Attention** : test\n\n- un\n- deux')).toBe('<p><strong>Attention</strong>\u00a0: test</p><ul><li>un</li><li>deux</li></ul>');
		expect(renderMarkdown('1. a\n2. b')).toBe('<ol><li>a</li><li>b</li></ol>');
	});
});

describe('typographie française', () => {
	it('lie la ponctuation haute au mot qui la précède', () => {
		expect(frenchSpaces('Quel bac ? Oui : voilà !')).toBe('Quel bac\u00a0? Oui\u00a0: voilà\u00a0!');
		expect(frenchSpaces('« bonjour »')).toBe('«\u00a0bonjour\u00a0»');
	});

	it('s’applique au texte rendu, sans toucher aux balises', () => {
		expect(renderMarkdown('**Attention** : nitrates ?')).toBe('<p><strong>Attention</strong>\u00a0: nitrates\u00a0?</p>');
	});
});

describe('photos dans la conversation', () => {
	const withPhoto = row(1, 'user', [
		{ type: 'x_image', attachment_id: 7 },
		{ type: 'x_image', attachment_id: 8 },
		{ type: 'text', text: '[Contexte du bac]' },
		{ type: 'text', text: 'Que penses-tu de cette plante ?' }
	]);

	it("affiche les photos jointes à côté du texte de l'utilisateur", () => {
		expect(toDisplay([withPhoto])[0]).toMatchObject({ kind: 'user', text: 'Que penses-tu de cette plante ?', images: [7, 8] });
	});

	it('un message sans photo a une liste vide', () => {
		expect(toDisplay([row(1, 'user', [{ type: 'text', text: 'ctx' }, { type: 'text', text: 'Salut' }])])[0]).toMatchObject({ images: [] });
	});

	it("retrouve la première question, sans le contexte ni les résultats d'outils", () => {
		const result = row(2, 'user', [{ type: 'tool_result', tool_use_id: 't', content: 'ok' }]);
		expect(firstUserText([result, withPhoto])).toBe('Que penses-tu de cette plante ?');
		expect(firstUserText([])).toBe('');
	});
});

describe('conversations', () => {
	const t = (id: number, updatedAt: string, title: string | null = null, preview = '', images = 0): ThreadSummary => ({ id, aquariumId: 1, title, preview, updatedAt, messages: 2, images });
	const now = Date.parse('2026-10-31T12:00:00Z');

	it('range les conversations par ancienneté, les plus récentes d’abord', () => {
		const groups = groupByRecency(
			[t(1, '2026-10-31T08:00:00Z'), t(2, '2026-10-30T20:00:00Z'), t(3, '2026-10-27T10:00:00Z'), t(4, '2026-10-10T10:00:00Z'), t(5, '2026-08-01T10:00:00Z'), t(6, '2026-10-31T11:00:00Z')],
			now
		);
		expect(groups.map((g) => g.label)).toEqual(["Aujourd'hui", 'Hier', '7 derniers jours', '30 derniers jours', 'Plus ancien']);
		expect(groups[0].threads.map((x) => x.id)).toEqual([6, 1]);
	});

	it('omet les groupes vides', () => {
		expect(groupByRecency([t(1, '2026-10-31T08:00:00Z')], now).map((g) => g.label)).toEqual(["Aujourd'hui"]);
	});

	it('nomme une conversation par son titre, sinon par son premier message', () => {
		expect(threadLabel(t(1, '', 'Nitrates en hausse', 'blabla'))).toBe('Nitrates en hausse');
		expect(threadLabel(t(1, '', null, 'Mes nitrates montent, que faire ?'))).toBe('Mes nitrates montent, que faire ?');
		expect(threadLabel(t(1, '', '  ', ''))).toBe('Nouvelle conversation');
	});
});

describe('repères d’heure', () => {
	// 31 octobre 2026, 13 h à Paris (CET, UTC+1 depuis le 25 octobre).
	const now = Date.parse('2026-10-31T12:00:00Z');
	const said = (key: string, at?: string): DisplayItem => ({ kind: 'assistant', key, text: 'x', at });

	it('dit le jour à la manière de Messages, à l’heure de Paris', () => {
		expect(timeMarkLabel('2026-10-31T08:32:00Z', now)).toBe('Aujourd’hui 09:32');
		expect(timeMarkLabel('2026-10-30T17:05:00Z', now)).toBe('Hier 18:05');
		expect(timeMarkLabel('2026-10-28T08:10:00Z', now)).toBe('mercredi 09:10');
		expect(timeMarkLabel('2026-10-03T08:10:00Z', now)).toBe('3 oct. 10:10');
		expect(timeMarkLabel('2025-12-24T08:10:00Z', now)).toBe('24 déc. 2025 09:10');
	});

	it('résume la date d’une conversation pour la liste', () => {
		expect(threadWhen('2026-10-31T08:32:00Z', now)).toBe('09:32');
		expect(threadWhen('2026-10-30T17:05:00Z', now)).toBe('Hier');
		expect(threadWhen('2026-10-28T08:10:00Z', now)).toBe('mercredi');
		expect(threadWhen('2026-10-03T08:10:00Z', now)).toBe('3 oct.');
		expect(threadWhen('2025-12-24T08:10:00Z', now)).toBe('24 déc. 2025');
	});

	it('pose un repère au début, puis après une heure de silence seulement', () => {
		const entries = withTimeMarks([said('a', '2026-10-31T08:00:00Z'), said('b', '2026-10-31T08:20:00Z'), said('c', '2026-10-31T10:00:00Z')], now);
		expect(entries.map((e) => e.kind)).toEqual(['time', 'assistant', 'assistant', 'time', 'assistant']);
	});

	it('ne repère pas ce qui n’a pas d’heure (message en cours de flux)', () => {
		const entries = withTimeMarks([said('a', '2026-10-31T08:00:00Z'), said('live')], now);
		expect(entries.map((e) => e.kind)).toEqual(['time', 'assistant', 'assistant']);
		expect(withTimeMarks([said('live')], now).map((e) => e.kind)).toEqual(['assistant']);
	});

	it('transmet l’heure des lignes de la base à l’affichage', () => {
		const items = toDisplay([{ ...row(1, 'user', [{ type: 'text', text: 'ctx' }, { type: 'text', text: 'Salut' }]), at: '2026-10-31T08:00:00Z' }]);
		expect(items[0]).toMatchObject({ at: '2026-10-31T08:00:00Z' });
	});
});

describe('propositions de première question', () => {
	it('met l’alerte en tête, puis complète avec des classiques jusqu’à trois', () => {
		const out = suggestPrompts({ alerts: ['Nitrates'], due: 0, cycling: false, measured: true });
		expect(out).toHaveLength(3);
		expect(out[0]).toMatchObject({ icon: 'alert', label: 'Nitrates à regarder' });
		expect(out[0].prompt).toContain('Nitrates');
	});

	it('résume plusieurs alertes en une seule proposition', () => {
		const out = suggestPrompts({ alerts: ['Nitrates', 'pH', 'KH', 'GH'], due: 0, cycling: false, measured: true });
		expect(out[0].label).toBe('4 valeurs à regarder');
		expect(out[0].prompt).toContain('Nitrates, pH, KH');
		expect(out[0].prompt).not.toContain('GH');
	});

	it('parle de cyclage et de tâches quand c’est le cas', () => {
		const icons = suggestPrompts({ alerts: [], due: 2, cycling: true, measured: true }).map((s) => s.icon);
		expect(icons.slice(0, 2)).toEqual(['cycle', 'today']);
	});

	it('invite à mesurer un bac sans mesure, sans parler de valeurs à juger', () => {
		const out = suggestPrompts({ alerts: [], due: 0, cycling: false, measured: false });
		expect(out[0].icon).toBe('flask');
		expect(out.some((s) => s.icon === 'chart')).toBe(false);
	});

	it('ne propose jamais deux fois la même chose', () => {
		const out = suggestPrompts({ alerts: [], due: 1, cycling: false, measured: true });
		expect(new Set(out.map((s) => s.icon)).size).toBe(out.length);
	});
});

describe('suppression de conversations', () => {
	const thread = (title: string | null, images: number) => ({ title, preview: '', images });

	it('nomme la conversation et prévient pour les photos', () => {
		const one = describeDeletion([thread('Nitrates en hausse', 3)]);
		expect(one.title).toBe('Supprimer cette conversation ?');
		expect(one.message).toContain('« Nitrates en hausse »');
		expect(one.message).toContain('avec 3 photos');
		expect(one.message).toContain('galerie du bac');
	});

	it('reste simple sans photo et accorde le singulier', () => {
		expect(describeDeletion([thread('Salut', 0)]).message).not.toContain('photo');
		expect(describeDeletion([thread('Salut', 1)]).message).toContain('avec 1 photo.');
	});

	it('compte les conversations et les photos d’une sélection', () => {
		const many = describeDeletion([thread('A', 2), thread('B', 0), thread(null, 1)]);
		expect(many.title).toBe('Supprimer 3 conversations ?');
		expect(many.message).toContain('avec 3 photos');
	});

	it('raccourcit un très long titre dans le message', () => {
		const message = describeDeletion([thread('x'.repeat(80), 0)]).message;
		expect(message.length).toBeLessThan(120);
		expect(message).toContain('…');
	});
});

describe('texte d’attente', () => {
	it('dit quel historique est relu', () => {
		expect(describeRead('historique_parametre', { parametre: 'nitrates' })).toContain('nitrates');
		expect(describeRead('historique_parametre', {})).toContain('mesures');
		expect(describeRead('autre', {})).toBe('Je regarde ton bac…');
	});
});

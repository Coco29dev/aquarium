import { describe, expect, it } from 'vitest';
import {
	allSent,
	anniversary,
	clip,
	dayClosed,
	empty,
	enumerate,
	fed,
	friendlyError,
	looksLikeError,
	measureVerdict,
	milestone,
	nextTaskText,
	nothingToday,
	nothingTodayTitle,
	offline,
	shortName,
	taskDone,
	variant,
	welcome,
	type SavedValue
} from './voice';

const EMOJI = /\p{Extended_Pictographic}/u;
const DAYS = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'];

/** Vérifie la charte sur une phrase : un point final ou une question, pas de « ! », pas d'emoji, 80 caractères au plus. */
function expectVoice(text: string) {
	expect(text, text).not.toContain('!');
	expect(EMOJI.test(text), text).toBe(false);
	expect(text.length, text).toBeLessThanOrEqual(80);
	expect(text.trim(), text).toBe(text);
}

const param = (over: Partial<SavedValue['parameter']> = {}): SavedValue['parameter'] => ({
	id: 1, name: 'Nitrates (NO3)', key: 'no3', unit: 'mg/L', min: 0, max: 40, decimals: 0, ...over
});

describe('charte de la voix', () => {
	it('ne met ni « ! » ni emoji et tient en 80 caractères, pour tous les jours', () => {
		for (const day of DAYS) {
			expectVoice(taskDone('Changement d’eau', day));
			expectVoice(taskDone('Nettoyage du filtre et des tuyaux, rinçage à l’eau du bac', day));
			for (const hour of [2, 8, 14, 19, 23]) expectVoice(dayClosed(hour, day));
			expectVoice(welcome({ hour: 9, name: 'Corentin' }));
		}
		for (const h of [0, 4, 7, 13, 20, 23]) {
			expectVoice(welcome({ hour: h, name: 'Corentin' }));
			expectVoice(welcome({ hour: h, name: '' }));
		}
		expectVoice(welcome({ hour: 9, name: 'Corentin', away: 9 }));
		expectVoice(fed(2, 3));
		expectVoice(fed(1));
		expectVoice(nothingToday());
		expectVoice(nothingTodayTitle);
		expectVoice(nextTaskText({ title: 'Nettoyage du filtre', when: 'dans 3 j' }));
		expectVoice(nothingToday({ title: 'Nettoyage du filtre', when: 'dans 3 j' }));
		expectVoice(offline(0));
		expectVoice(offline(2));
		expectVoice(allSent);
		expectVoice(milestone('Un premier changement d’eau'));
		expectVoice(anniversary('Salon', '100 jours'));
		for (const text of [empty.journalTitle, empty.journalText, empty.journalFiltered, empty.params, empty.noMeasure, empty.chart, empty.tasksNoneTitle, empty.tasksNoneText, empty.livingTitle, empty.livingText, empty.noMeasureTitle, empty.noMeasureText, empty.waterNever]) expectVoice(text);
	});

	it('garde la même phrase toute la journée et change d’un jour à l’autre', () => {
		for (const day of DAYS) expect(taskDone('Filtre', day)).toBe(taskDone('Filtre', day));
		expect(new Set(DAYS.map((d) => taskDone('Filtre', d))).size).toBeGreaterThan(1);
		expect(new Set(DAYS.map((d) => dayClosed(15, d))).size).toBeGreaterThan(1);
		expect(variant(['a', 'b', 'c'], '2026-11-02', 0)).toBe(variant(['a', 'b', 'c'], '2026-11-02', 0));
	});
});

describe('texte', () => {
	it('coupe les intitulés trop longs et retire le point final', () => {
		expect(clip('Changement d’eau.')).toBe('Changement d’eau');
		expect(clip('x'.repeat(60)).length).toBe(46);
		expect(clip('x'.repeat(60)).endsWith('…')).toBe(true);
	});
	it('met le nom d’un paramètre en milieu de phrase', () => {
		expect(shortName('Nitrates (NO3)')).toBe('nitrates');
		expect(shortName('pH')).toBe('pH');
		expect(shortName('KH')).toBe('KH');
		expect(shortName('Température')).toBe('température');
	});
	it('énumère avec « et »', () => {
		expect(enumerate(['a'])).toBe('a');
		expect(enumerate(['a', 'b'])).toBe('a et b');
		expect(enumerate(['a', 'b', 'c'])).toBe('a, b et c');
		expect(enumerate(['a', 'b', 'c', 'd', 'e'])).toBe('a, b et 3 autres');
	});
});

describe('salutation', () => {
	it('suit l’heure sans dire « Bonne nuit » à l’ouverture', () => {
		expect(welcome({ hour: 7, name: 'Corentin' })).toBe('Bonjour Corentin');
		expect(welcome({ hour: 14, name: '' })).toBe('Bon après-midi');
		expect(welcome({ hour: 19, name: 'Corentin' })).toBe('Bonsoir Corentin');
		expect(welcome({ hour: 23, name: 'Corentin' })).toBe('Bonsoir Corentin');
		expect(welcome({ hour: 2, name: 'Corentin' })).toBe('Encore debout, Corentin ?');
		expect(welcome({ hour: 2, name: '' })).toBe('Encore debout ?');
	});
	it('se réjouit du retour après quelques jours, sans reproche', () => {
		expect(welcome({ hour: 9, name: 'Corentin', away: 5 })).toBe('Content de te revoir, Corentin');
		expect(welcome({ hour: 9, name: '', away: 12 })).toBe('Content de te revoir');
		expect(welcome({ hour: 9, name: 'Corentin', away: 4 })).toBe('Bonjour Corentin');
	});
});

describe('erreurs', () => {
	it('garde un message métier déjà en français', () => {
		expect(friendlyError(new Error('La date de mesure est dans le futur.'))).toBe('La date de mesure est dans le futur.');
		expect(friendlyError(new Error('Envoi impossible'))).toBe('Envoi impossible.');
	});
	it('remplace un message technique par une phrase calme', () => {
		expect(friendlyError(new Error('Synchronisation refusée (500)'))).toMatch(/serveur/);
		expect(friendlyError(new Error('Erreur 503'))).toMatch(/serveur/);
		expect(friendlyError(new TypeError('Failed to fetch'))).toMatch(/réseau/);
		expect(friendlyError(new Error('Erreur 404'))).toMatch(/Ça n’a pas marché/);
		expect(friendlyError(new Error('Unexpected token < in JSON'))).toMatch(/Ça n’a pas marché/);
		expect(friendlyError(undefined)).toMatch(/Ça n’a pas marché/);
		expect(friendlyError(new Error('Erreur 404'), 'Photo introuvable.')).toBe('Photo introuvable.');
	});
	it('toutes les phrases calmes respectent la charte', () => {
		for (const e of [new TypeError('Failed to fetch'), new Error('Erreur 500'), new Error('401'), new Error('')]) expectVoice(friendlyError(e));
	});
	it('reconnaît un message d’échec sans type', () => {
		expect(looksLikeError('Annulation impossible hors connexion.')).toBe(true);
		expect(looksLikeError('Connexion requise pour modifier la configuration.')).toBe(true);
		expect(looksLikeError('Événement supprimé')).toBe(false);
		expect(looksLikeError('Repas annulé')).toBe(false);
	});
});

describe('textes d’état', () => {
	it('annonce la prochaine tâche plutôt qu’un vide', () => {
		expect(nothingToday({ title: 'Filtre', when: 'dans 3 j' })).toBe('Rien à faire aujourd’hui. Prochaine tâche : Filtre, dans 3 j.');
		expect(nothingToday(null)).toBe('Rien à faire aujourd’hui. Profites-en.');
	});
	it('dit « Bonne nuit » en fin de journée seulement', () => {
		expect(dayClosed(23)).toContain('Bonne nuit');
		expect(dayClosed(10, '2026-11-02')).not.toContain('Bonne nuit');
		expect(dayClosed(20, '2026-11-02')).toMatch(/soirée|Repose-toi/);
	});
	it('compte les saisies gardées hors ligne', () => {
		expect(offline(1)).toBe('Hors ligne · 1 saisie gardée');
		expect(offline(3)).toBe('Hors ligne · 3 saisies gardées');
	});
});

describe('verdict après une saisie', () => {
	const ok = (parameter: SavedValue['parameter'], value: number): SavedValue => ({ parameter, value });
	const base = { aquariumId: 7, alerts: [] as { level: 'hors_plage' | 'derive'; parameterId: number; message: string }[] };

	it('dit « dans la plage » seulement pour les valeurs qui ont une plage', () => {
		const v = measureVerdict({ ...base, saved: [ok(param(), 20), ok(param({ id: 2, name: 'pH', key: 'ph', unit: '', min: 6.5, max: 7.5, decimals: 1 }), 7)] }, '2026-11-02');
		expect(v.level).toBe('ok');
		expect(v.message).toMatch(/nitrates et pH dans la plage\.$/);
		expect(v.href).toBeUndefined();
		const sans = measureVerdict({ ...base, saved: [ok(param({ min: null, max: null }), 20)] }, '2026-11-02');
		expect(sans.message).toMatch(/1 mesure\.$/);
		expect(sans.message).not.toContain('plage');
	});

	it('signale une valeur au-dessus de sa limite, avec le conseil et le lien', () => {
		const v = measureVerdict({ ...base, saved: [ok(param(), 42)] });
		expect(v.level).toBe('warn');
		expect(v.message).toBe('Nitrates à 42 mg/L, au-dessus de 40. Un changement d’eau l’aiderait.');
		expect(v.href).toBe('/aquariums/7/parametre/1');
		expectVoice(v.message);
	});

	it('signale une valeur sous sa limite, sans conseil inventé', () => {
		const v = measureVerdict({ ...base, saved: [ok(param({ id: 3, name: 'Température', key: 'temp', unit: '°C', min: 24, max: 27, decimals: 1 }), 22.5)] });
		expect(v.message).toBe('Température à 22,5 °C, en dessous de 24,0.');
		expect(v.level).toBe('warn');
	});

	it('garde la casse de pH en début de phrase', () => {
		const v = measureVerdict({ ...base, saved: [ok(param({ id: 2, name: 'pH', key: 'ph', unit: '', min: 6.5, max: 7.5, decimals: 1 }), 8.1)] });
		expect(v.message.startsWith('pH à 8,1')).toBe(true);
	});

	it('regroupe plusieurs valeurs hors plage', () => {
		const v = measureVerdict({ ...base, saved: [ok(param(), 55), ok(param({ id: 2, name: 'Phosphates (PO4)', key: 'po4', max: 1, decimals: 1 }), 2)] });
		expect(v.message).toBe('2 valeurs hors plage : nitrates et phosphates.');
		expect(v.href).toBe('/aquariums/7/parametre/1');
	});

	it('signale une dérive sur une valeur saisie, pas sur une autre', () => {
		const alerts = [{ level: 'derive' as const, parameterId: 1, message: 'Nitrates (NO3) monte de 8 mg/L sur 7 jours' }];
		const v = measureVerdict({ ...base, alerts, saved: [ok(param(), 30)] });
		expect(v.level).toBe('warn');
		expect(v.message).toBe('Nitrates monte de 8 mg/L sur 7 jours. À surveiller.');
		const other = measureVerdict({ ...base, alerts, saved: [ok(param({ id: 9, name: 'pH', key: 'ph' }), 7)] }, '2026-11-02');
		expect(other.level).toBe('ok');
	});

	it('annonce le début des courbes à la première saisie', () => {
		expect(measureVerdict({ ...base, firstTime: true, saved: [ok(param(), 10)] }).message).toBe('Première mesure notée. La courbe commence ici.');
		expect(measureVerdict({ ...base, firstTime: true, saved: [ok(param(), 10), ok(param({ id: 2 }), 1)] }).message).toMatch(/^Premières mesures/);
	});

	it('une valeur hors plage prime sur la première saisie', () => {
		expect(measureVerdict({ ...base, firstTime: true, saved: [ok(param(), 99)] }).level).toBe('warn');
	});

	it('cite l’étape du cyclage', () => {
		const v = measureVerdict({ ...base, coachTitle: 'Cyclage : pic de nitrites', saved: [ok(param({ min: null, max: null, id: 4, name: 'Nitrites (NO2)', key: 'no2' }), 1)] }, '2026-11-02');
		expect(v.level).toBe('ok');
		expect(v.message).toMatch(/Cyclage : pic de nitrites\.$/);
		expectVoice(v.message);
	});

	it('toutes les phrases du verdict respectent la charte', () => {
		for (const day of DAYS) {
			expectVoice(measureVerdict({ ...base, saved: [ok(param(), 20)] }, day).message);
			expectVoice(measureVerdict({ ...base, saved: [ok(param({ min: null, max: null }), 20)] }, day).message);
		}
	});
});

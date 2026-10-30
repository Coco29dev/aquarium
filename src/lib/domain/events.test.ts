import { describe, expect, it } from 'vitest';
import {
	EVENT_KINDS,
	EVENT_META,
	chartMarkers,
	daysSinceEvent,
	eventSummary,
	eventsBetween,
	lastEvent,
	noonParisIso,
	validateEventPayload
} from './events';
import type { AquariumEvent } from '../types';

const ev = (over: Partial<AquariumEvent>): AquariumEvent => ({
	aquariumId: 1,
	kind: 'changement_eau',
	at: '2026-10-20T10:00:00.000Z',
	payload: {},
	...over
});

describe('EVENT_META', () => {
	it('couvre tous les types avec libellé, icône et couleur système', () => {
		for (const kind of EVENT_KINDS) {
			const meta = EVENT_META[kind];
			expect(meta.label.length).toBeGreaterThan(0);
			expect(meta.icon.length).toBeGreaterThan(0);
			expect(meta.color).toMatch(/^var\(--[a-z]+\)$/);
		}
	});
});

describe('validateEventPayload', () => {
	it('accepte un changement d’eau vide ou complet', () => {
		expect(validateEventPayload('changement_eau', {})).toBeNull();
		expect(
			validateEventPayload('changement_eau', { percent: 30, litres: 72, source: 'osmose', tempDiffC: -1.5, conditioner: true })
		).toBeNull();
	});
	it('refuse un pourcentage hors limites ou une origine inconnue', () => {
		expect(validateEventPayload('changement_eau', { percent: 0 })).toMatch(/pourcentage/);
		expect(validateEventPayload('changement_eau', { percent: 120 })).toMatch(/dépasser/);
		expect(validateEventPayload('changement_eau', { source: 'pluie' })).toMatch(/origine/);
	});
	it('refuse un champ inconnu et un payload qui n’est pas un objet', () => {
		expect(validateEventPayload('appoint', { foo: 1 })).toBe('Champ inconnu : foo.');
		expect(validateEventPayload('appoint', [])).toMatch(/invalides/);
		expect(validateEventPayload('appoint', null)).toMatch(/invalides/);
	});
	it('exige produit, dose et unité pour un dosage', () => {
		expect(validateEventPayload('dosage', { product: 'Calcium', amount: 6, unit: 'mL' })).toBeNull();
		expect(validateEventPayload('dosage', { amount: 6, unit: 'mL' })).toMatch(/produit/);
		expect(validateEventPayload('dosage', { product: 'Calcium', unit: 'mL' })).toBe('La dose est obligatoire.');
		expect(validateEventPayload('dosage', { product: 'Calcium', amount: 6 })).toBe("L'unité est obligatoire.");
		expect(validateEventPayload('habitant_ajout', { species: 'Néon' })).toBe('La quantité est obligatoire.');
		expect(validateEventPayload('dosage', { product: 'Calcium', amount: 0, unit: 'mL' })).toMatch(/dose/);
		expect(validateEventPayload('dosage', { product: 'Calcium', amount: 6, unit: 'cuillères' })).toMatch(/unité/);
	});
	it('exige au moins un réglage pour l’éclairage et le CO₂, avec des heures valides', () => {
		expect(validateEventPayload('eclairage', {})).toMatch(/au moins un réglage/);
		expect(validateEventPayload('eclairage', { photoperiodH: 8, startTime: '10:00', endTime: '18:00', intensityPct: 55 })).toBeNull();
		expect(validateEventPayload('eclairage', { startTime: '25:00' })).toMatch(/HH:MM/);
		expect(validateEventPayload('eclairage', { intensityPct: 140 })).toMatch(/dépasser/);
		expect(validateEventPayload('co2', {})).toMatch(/au moins un réglage/);
		expect(validateEventPayload('co2', { bubblesPerSecond: 2, onTime: '09:00', offTime: '16:00' })).toBeNull();
	});
	it('valide les habitants, la cause n’étant permise qu’au départ', () => {
		expect(validateEventPayload('habitant_ajout', { species: 'Néon', quantity: 10 })).toBeNull();
		expect(validateEventPayload('habitant_ajout', { species: 'Néon', quantity: 0 })).toMatch(/quantité/);
		expect(validateEventPayload('habitant_ajout', { species: 'Néon', quantity: 2.5 })).toMatch(/entier/);
		expect(validateEventPayload('habitant_ajout', { species: 'Néon', quantity: 1, cause: 'mort' })).toBe('Champ inconnu : cause.');
		expect(validateEventPayload('habitant_depart', { species: 'Néon', quantity: 1, cause: 'mort' })).toBeNull();
		expect(validateEventPayload('habitant_depart', { species: 'Néon', quantity: 1, cause: 'ennui' })).toMatch(/cause/);
	});
	it('valide entretien, étape et note', () => {
		expect(validateEventPayload('maintenance', { what: 'Rinçage du préfiltre' })).toBeNull();
		expect(validateEventPayload('maintenance', {})).toMatch(/intervention/);
		expect(validateEventPayload('etape', { label: 'Fin du cyclage' })).toBeNull();
		expect(validateEventPayload('etape', { label: '   ' })).toMatch(/étape/);
		expect(validateEventPayload('note', {})).toBeNull();
		expect(validateEventPayload('note', { x: 1 })).toBe('Champ inconnu : x.');
	});
	it('refuse un payload trop volumineux', () => {
		expect(validateEventPayload('maintenance', { what: 'a'.repeat(200) , z: 'b'.repeat(2500) })).toMatch(/volumineux/);
	});
});

describe('eventSummary', () => {
	it('résume un changement d’eau', () => {
		expect(eventSummary(ev({ payload: { percent: 30, litres: 72, source: 'osmose' } }))).toBe(
			"Changement d'eau · 30 % (72 L) · eau d'osmose"
		);
		expect(eventSummary(ev({ payload: {} }))).toBe("Changement d'eau");
		expect(eventSummary(ev({ payload: { litres: 20, tempDiffC: 1.5, conditioner: true } }))).toBe(
			"Changement d'eau · 20 L · écart de 1,5 °C en plus · conditionneur ajouté"
		);
	});
	it('résume dosage, éclairage, CO₂ et appoint', () => {
		expect(eventSummary(ev({ kind: 'dosage', payload: { product: 'Calcium', amount: 6, unit: 'mL' } }))).toBe('Dosage · Calcium · 6 mL');
		expect(eventSummary(ev({ kind: 'eclairage', payload: { photoperiodH: 8, startTime: '10:00', endTime: '18:00', intensityPct: 55 } }))).toBe(
			'Éclairage · 8 h · 10:00–18:00 · 55 %'
		);
		expect(eventSummary(ev({ kind: 'co2', payload: { bubblesPerSecond: 2, onTime: '09:00', offTime: '16:00' } }))).toBe(
			'CO₂ · 2 bulles par s · 09:00–16:00'
		);
		expect(eventSummary(ev({ kind: 'appoint', payload: { litres: 1.5 } }))).toBe('Appoint · 1,5 L');
	});
	it('résume habitants, étape et note', () => {
		expect(eventSummary(ev({ kind: 'habitant_ajout', payload: { species: 'Néon cardinal', quantity: 15 } }))).toBe('Arrivée · 15 × Néon cardinal');
		expect(eventSummary(ev({ kind: 'habitant_depart', payload: { species: 'Néon cardinal', quantity: 1, cause: 'mort' } }))).toBe(
			'Départ · 1 × Néon cardinal · mort'
		);
		expect(eventSummary(ev({ kind: 'etape', payload: { label: 'Fin du cyclage' } }))).toBe('Étape · Fin du cyclage');
		expect(eventSummary(ev({ kind: 'note', note: 'Algues sur la vitre' }))).toBe('Note · Algues sur la vitre');
		expect(eventSummary(ev({ kind: 'note' }))).toBe('Note');
	});
});

describe('requêtes sur les événements', () => {
	const events = [
		ev({ id: 3, at: '2026-10-27T09:00:00.000Z' }),
		ev({ id: 1, at: '2026-10-13T09:00:00.000Z' }),
		ev({ id: 2, at: '2026-10-20T09:00:00.000Z', kind: 'dosage', payload: { product: 'KH', amount: 5, unit: 'mL' } }),
		ev({ id: 4, aquariumId: 2, at: '2026-10-29T09:00:00.000Z' })
	];
	const now = Date.parse('2026-10-30T10:00:00Z');

	it('trouve le dernier événement d’un type pour un bac, quel que soit l’ordre', () => {
		expect(lastEvent(events, 1, 'changement_eau')?.id).toBe(3);
		expect(lastEvent(events, 2, 'changement_eau')?.id).toBe(4);
		expect(lastEvent(events, 2, 'dosage')).toBeNull();
	});
	it('compte les jours calendaires depuis le dernier événement', () => {
		expect(daysSinceEvent(events, 1, 'changement_eau', now)).toBe(3);
		expect(daysSinceEvent(events, 2, 'changement_eau', now)).toBe(1);
		expect(daysSinceEvent(events, 1, 'appoint', now)).toBeNull();
	});
	it('ne renvoie jamais un nombre de jours négatif', () => {
		const future = [ev({ at: '2026-10-30T10:03:00.000Z' })];
		expect(daysSinceEvent(future, 1, 'changement_eau', now)).toBe(0);
	});
	it('filtre par période, bac et type, du plus ancien au plus récent', () => {
		const from = Date.parse('2026-10-14T00:00:00Z');
		const to = Date.parse('2026-10-28T00:00:00Z');
		expect(eventsBetween(events, from, to, { aquariumId: 1 }).map((e) => e.id)).toEqual([2, 3]);
		expect(eventsBetween(events, from, to, { aquariumId: 1, kinds: ['dosage'] }).map((e) => e.id)).toEqual([2]);
	});
	it('fabrique des repères de graphe triés avec leur résumé', () => {
		const markers = chartMarkers(events, { kinds: ['changement_eau'], aquariumId: 1, from: Date.parse('2026-10-01T00:00:00Z') });
		expect(markers.map((m) => m.kind)).toEqual(['changement_eau', 'changement_eau']);
		expect(markers[0].t).toBeLessThan(markers[1].t);
		expect(markers[0].label).toBe("Changement d'eau");
		expect(chartMarkers(events, { to: Date.parse('2026-10-14T00:00:00Z') })).toHaveLength(1);
	});
});

describe('noonParisIso', () => {
	it('place midi à l’heure de Paris, été comme hiver', () => {
		expect(noonParisIso('2026-07-14')).toBe('2026-07-14T12:00:00+02:00');
		expect(noonParisIso('2026-01-10')).toBe('2026-01-10T12:00:00+01:00');
	});
	it('gère les jours de changement d’heure', () => {
		expect(noonParisIso('2026-03-29')).toBe('2026-03-29T12:00:00+02:00');
		expect(noonParisIso('2026-10-25')).toBe('2026-10-25T12:00:00+01:00');
	});
	it('reste un instant valable', () => {
		expect(new Date(noonParisIso('2026-10-28')).toISOString()).toBe('2026-10-28T11:00:00.000Z');
	});
});

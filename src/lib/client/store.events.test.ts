import { describe, expect, it } from 'vitest';
import { store } from './store.svelte';
import type { Snapshot } from '../types';
import type { OutboxItem } from './db';

const snapshot = (): Snapshot => ({
	generatedAt: '2026-10-30T10:00:00.000Z',
	aquariums: [{ id: 1, name: 'Salon', waterType: 'plantee', volumeL: 240, startedOn: '2025-03-12', coverPhotoId: null, stage: 'actif' }],
	parameters: [],
	measurements: [],
	tasks: [
		{ id: 10, aquariumId: 1, title: "Changement d'eau", kind: 'eau', everyDays: 7, nextDue: '2026-10-30', active: true },
		{ id: 11, aquariumId: 1, title: 'Tests', kind: 'test', everyDays: 7, nextDue: '2026-10-30', active: true }
	],
	events: [{ id: 1, aquariumId: 1, kind: 'changement_eau', at: '2026-10-23T10:00:00.000Z', payload: {}, source: 'tache' }]
});

describe('vue du journal d’événements avec la file d’envoi', () => {
	it('ajoute tout de suite un événement saisi hors ligne, trié par date', () => {
		store.snapshot = snapshot();
		store.pending = [
			{
				type: 'event',
				clientId: 'c1',
				aquariumId: 1,
				kind: 'dosage',
				at: '2026-10-29T08:00:00.000Z',
				payload: { product: 'Fer', amount: 2, unit: 'mL' },
				note: 'matin',
				seq: 1
			} as OutboxItem
		];
		const events = store.view?.events ?? [];
		expect(events.map((e) => e.kind)).toEqual(['changement_eau', 'dosage']);
		expect(events[1]).toMatchObject({ clientId: 'c1', source: 'manuel', note: 'matin' });
	});

	it('cocher une tâche « eau » crée un changement d’eau provisoire, pas une tâche d’un autre type', () => {
		store.snapshot = snapshot();
		store.pending = [
			{ type: 'completion', clientId: 'c2', taskId: 10, doneAt: '2026-10-30T09:00:00.000Z', seq: 2 } as OutboxItem,
			{ type: 'completion', clientId: 'c3', taskId: 11, doneAt: '2026-10-30T09:05:00.000Z', seq: 3 } as OutboxItem
		];
		const events = store.view?.events ?? [];
		expect(events).toHaveLength(2);
		expect(events[1]).toMatchObject({ kind: 'changement_eau', source: 'tache', clientId: 'c2', aquariumId: 1 });
	});

	it('refuse un événement invalide ou futur sans rien mettre en file', async () => {
		store.snapshot = snapshot();
		store.pending = [];
		await expect(store.addEvent(1, 'dosage', { product: 'Fer' })).rejects.toThrow(/dose/);
		await expect(store.addEvent(1, 'note', {}, { at: '2099-01-01T00:00:00Z' })).rejects.toThrow(/futur/);
		expect(store.pending).toHaveLength(0);
	});

	it('fonctionne avec un ancien cache sans événements', () => {
		const old = snapshot();
		delete old.events;
		store.snapshot = old;
		store.pending = [];
		expect(store.view?.events).toEqual([]);
	});
});

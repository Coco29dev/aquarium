import { describe, expect, it } from 'vitest';
import { exportedState, validateExport } from './restore-validate';

const base = () => ({
	exportedAt: '2026-10-30T10:00:00.000Z',
	aquariums: [{ id: 1, name: 'Salon', water_type: 'plantee', cover_photo_id: null }],
	parameters: [{ id: 1, aquarium_id: 1, name: 'pH' }],
	measurements: [{ id: 1, aquarium_id: 1, parameter_id: 1, value: 7, measured_at: '2026-10-29T10:00:00.000Z' }],
	recurringTasks: [{ id: 1, aquarium_id: 1, title: 'Eau' }],
	taskCompletions: [{ id: 1, task_id: 1, done_at: '2026-10-29T10:00:00.000Z' }],
	events: [{ id: 1, aquarium_id: 1, kind: 'note', at: '2026-10-29T10:00:00.000Z', payload: {} }]
});

describe('validateExport', () => {
	it('accepte un export complet et compte les lignes', () => {
		const r = validateExport({ ...base(), photos: [], inhabitants: [], equipment: [], consumables: [], consumableReplacements: [], expenses: [], notes: [], feedings: [], projectItems: [] });
		expect(r.errors).toEqual([]);
		expect(r.counts.measurements).toBe(1);
		expect(r.counts.events).toBe(1);
		expect(r.exportedAt).toBe('2026-10-30T10:00:00.000Z');
	});
	it('refuse ce qui n’est pas un export', () => {
		expect(validateExport(null).errors[0]).toMatch(/n'est pas une sauvegarde/);
		expect(validateExport([]).errors.length).toBe(1);
		expect(validateExport({ foo: 1 }).errors[0]).toMatch(/liste des aquariums/);
	});
	it('tolère un ancien export sans événements et le signale', () => {
		const old = base() as Record<string, unknown>;
		delete old.events;
		const r = validateExport(old);
		expect(r.errors).toEqual([]);
		expect(r.counts.events).toBe(0);
		expect(r.warnings.some((w) => w.includes('événements'))).toBe(true);
	});
	it('détecte les identifiants en double et les lignes sans id', () => {
		const dup = base();
		dup.parameters.push({ id: 1, aquarium_id: 1, name: 'KH' });
		expect(validateExport(dup).errors.join(' ')).toMatch(/en double/);
		const noId = base() as Record<string, unknown>;
		noId.notes = [{ body: 'x' }];
		expect(validateExport(noId).errors.join(' ')).toMatch(/sans identifiant/);
	});
	it('détecte les références cassées entre tables', () => {
		const broken = base();
		broken.measurements.push({ id: 2, aquarium_id: 1, parameter_id: 99, value: 1, measured_at: '2026-10-29T10:00:00.000Z' });
		const r = validateExport(broken);
		expect(r.errors.join(' ')).toMatch(/mesures.*« paramètres » absents? du fichier \(ex\. id 99\)/);
	});
	it('accepte une dépense sans aquarium mais pas une note orpheline', () => {
		const ok = { ...base(), expenses: [{ id: 1, aquarium_id: null, label: 'x', amount: 1 }] };
		expect(validateExport(ok).errors).toEqual([]);
		const bad = { ...base(), notes: [{ id: 1, aquarium_id: 42, body: 'x' }] };
		expect(validateExport(bad).errors.join(' ')).toMatch(/notes/);
	});
	it('avertit des photos (fichiers non restaurés) et des couvertures introuvables', () => {
		const withPhotos = {
			...base(),
			aquariums: [{ id: 1, name: 'Salon', water_type: 'douce', cover_photo_id: 7 }],
			photos: [{ id: 1, aquarium_id: 1, storage_key: 'a', content_type: 'image/jpeg', bytes: 1 }]
		};
		const r = validateExport(withPhotos);
		expect(r.errors).toEqual([]);
		expect(r.warnings.join(' ')).toMatch(/pas les fichiers/);
		expect(r.warnings.join(' ')).toMatch(/couverture introuvable/);
	});
	it('ignore les clés inconnues avec un avertissement', () => {
		const r = validateExport({ ...base(), surprise: [] });
		expect(r.warnings.join(' ')).toMatch(/« surprise » inconnue/);
	});
});

describe('exportedState', () => {
	it('lit les réglages inclus dans l’export', () => {
		expect(exportedState({ appState: { notification_settings: { summaryTime: '08:30' } } }, 'notification_settings')).toEqual({ summaryTime: '08:30' });
		expect(exportedState({}, 'notification_settings')).toBeNull();
	});
});

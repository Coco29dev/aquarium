import { describe, expect, it } from 'vitest';
import { analyzeParameter, collectTankAlerts, lastWaterChanges } from './drift';
import { backupDue, freshAlerts, isPushService } from './notifications';
import { daysBetween } from './dates';
import type { Completion, Measurement, Parameter, Task } from '../types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-30T10:00:00Z');
const at = (daysBefore: number) => new Date(NOW - daysBefore * DAY).toISOString();

const param = (id: number, key: string, min: number | null, max: number | null, driftPerWeek: number | null): Parameter => ({
	id, aquariumId: 1, key, name: key, unit: '', min, max, driftPerWeek, decimals: 1, step: 0.1, position: id
});
const m = (parameterId: number, value: number, daysBefore: number): Measurement => ({
	parameterId, aquariumId: 1, value, measuredAt: at(daysBefore)
});
const waterTask: Task = { id: 7, aquariumId: 1, title: 'Eau', kind: 'eau', everyDays: 7, nextDue: '2026-11-01', active: true };

describe('dérive et changement d’eau', () => {
	const no3 = param(1, 'no3', 10, 100, 10);
	// Dent de scie : 90 → 40 (changement d'eau il y a 3 jours) → 42.
	const data = [m(1, 90, 6), m(1, 88, 4.5), m(1, 40, 3), m(1, 41, 1.5), m(1, 42, 0)];

	it('sans repère, la chute due au changement d’eau fausse la pente', () => {
		expect(analyzeParameter(no3, data, NOW)?.level).toBe('derive');
	});
	it('avec le repère, seule la période après le changement compte', () => {
		expect(analyzeParameter(no3, data, NOW, NOW - 3 * DAY)).toBeNull();
	});
	it('retrouve le dernier changement d’eau de chaque bac', () => {
		const completions: Completion[] = [
			{ taskId: 7, doneAt: at(10) },
			{ taskId: 7, doneAt: at(3) },
			{ taskId: 99, doneAt: at(0) }
		];
		expect(lastWaterChanges([waterTask], completions).get(1)).toBe(NOW - 3 * DAY);
	});
});

describe('alertes pendant le cyclage', () => {
	const params = [param(1, 'nh3', 0, 0.05, null), param(2, 'no2', 0, 0.1, null), param(3, 'ph', 6.5, 7.8, null)];
	const measurements = [m(1, 1, 0), m(2, 0, 0), m(3, 9, 0)];

	it('ne signale pas l’ammoniac attendu, mais garde les autres paramètres', () => {
		const alerts = collectTankAlerts({ parameters: params, measurements, tasks: [] }, NOW);
		expect(alerts.map((a) => a.parameterId)).toEqual([3]);
	});
	it('signale un pic d’ammoniac dans un bac qui a déjà cyclé', () => {
		const all = [...params, param(4, 'no3', 0, 40, null)];
		const history = [
			m(1, 0.5, 20), m(2, 0.5, 20),
			m(1, 0, 8), m(2, 0, 8), m(4, 10, 8),
			m(1, 0, 5), m(2, 0, 5), m(4, 10, 5),
			m(1, 1, 0), m(2, 0, 0), m(4, 10, 0), m(3, 7, 0)
		];
		const alerts = collectTankAlerts({ parameters: all, measurements: history, tasks: [] }, NOW);
		expect(alerts.map((a) => a.parameterId)).toContain(1);
	});
});

describe('alertes déjà notifiées', () => {
	const alerts = [{ parameterId: 1, level: 'derive' }, { parameterId: 2, level: 'hors_plage' }];
	it('écarte une alerte notifiée hier, garde les nouvelles', () => {
		const fresh = freshAlerts(alerts, { '1:derive': '2026-10-29' }, '2026-10-30', daysBetween);
		expect(fresh.map((a) => a.parameterId)).toEqual([2]);
	});
	it('la répète après 3 jours', () => {
		const fresh = freshAlerts(alerts, { '1:derive': '2026-10-27' }, '2026-10-30', daysBetween);
		expect(fresh).toHaveLength(2);
	});
});

describe('sauvegarde due', () => {
	const now = new Date('2026-11-01T04:00:00Z');
	it('part s’il n’y en a jamais eu, passé 3 h 10', () => {
		expect(backupDue(null, now, 4 * 60)).toBe(true);
		expect(backupDue(null, now, 3 * 60)).toBe(false);
	});
	it('rattrape une sauvegarde manquée', () => {
		expect(backupDue('2026-10-20T03:10:00Z', now, 4 * 60)).toBe(true);
	});
	it('attend une semaine entre deux sauvegardes', () => {
		expect(backupDue('2026-10-29T03:10:00Z', now, 4 * 60)).toBe(false);
	});
});

describe('services de push acceptés', () => {
	it('accepte Apple, Google, Mozilla', () => {
		expect(isPushService('https://web.push.apple.com/abc')).toBe(true);
		expect(isPushService('https://fcm.googleapis.com/fcm/send/x')).toBe(true);
		expect(isPushService('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
	});
	it('refuse le reste', () => {
		expect(isPushService('https://exemple.com/push')).toBe(false);
		expect(isPushService('http://web.push.apple.com/x')).toBe(false);
		expect(isPushService('https://web.push.apple.com.evil.com/x')).toBe(false);
		expect(isPushService('pas une url')).toBe(false);
	});
});

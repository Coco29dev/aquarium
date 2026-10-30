import { describe, expect, it } from 'vitest';
import { inQuietHours, minutesOf, parisMinutes, parisWeekday, parseNotificationSettings, skipDue, summaryDue, weeklyDue } from './notifications';
import { addDays } from './dates';

describe('heures de silence', () => {
	it('gère une plage dans la journée', () => {
		const s = { quietStart: '12:00', quietEnd: '14:00' };
		expect(inQuietHours(s, minutesOf('13:00'))).toBe(true);
		expect(inQuietHours(s, minutesOf('14:00'))).toBe(false);
		expect(inQuietHours(s, minutesOf('11:59'))).toBe(false);
	});
	it('gère une plage qui passe minuit', () => {
		const s = { quietStart: '22:00', quietEnd: '07:00' };
		expect(inQuietHours(s, minutesOf('23:30'))).toBe(true);
		expect(inQuietHours(s, minutesOf('06:59'))).toBe(true);
		expect(inQuietHours(s, minutesOf('07:00'))).toBe(false);
		expect(inQuietHours(s, minutesOf('12:00'))).toBe(false);
	});
	it('ne fait rien sans plage', () => {
		expect(inQuietHours({ quietStart: null, quietEnd: null }, 0)).toBe(false);
	});
});

describe('récapitulatif quotidien', () => {
	const s = { summaryTime: '08:30', quietStart: null, quietEnd: null };
	it("part à partir de l'heure choisie, une fois par jour", () => {
		expect(summaryDue(s, minutesOf('08:29'), false)).toBe(false);
		expect(summaryDue(s, minutesOf('08:30'), false)).toBe(true);
		expect(summaryDue(s, minutesOf('15:00'), false)).toBe(true);
		expect(summaryDue(s, minutesOf('15:00'), true)).toBe(false);
	});
	it('attend la fin des heures de silence', () => {
		const quiet = { summaryTime: '07:00', quietStart: '22:00', quietEnd: '09:00' };
		expect(summaryDue(quiet, minutesOf('08:00'), false)).toBe(false);
		expect(summaryDue(quiet, minutesOf('09:00'), false)).toBe(true);
	});
	it("lit l'heure de Paris", () => {
		expect(parisMinutes(Date.parse('2026-10-30T07:30:00Z'))).toBe(minutesOf('08:30'));
	});
});

describe('validation des réglages', () => {
	it('complète avec les valeurs par défaut', () => {
		expect(parseNotificationSettings({})).toEqual({
			summaryTime: '08:30',
			quietStart: null,
			quietEnd: null,
			aquariumIds: null,
			ntfyTopic: null,
			weeklyReport: true,
			weeklyTime: '18:00'
		});
	});
	it('valide le bilan hebdomadaire', () => {
		expect(parseNotificationSettings({ weeklyReport: false, weeklyTime: '19:15' })).toMatchObject({ weeklyReport: false, weeklyTime: '19:15' });
		expect(() => parseNotificationSettings({ weeklyReport: 'oui' })).toThrow();
		expect(() => parseNotificationSettings({ weeklyTime: '7h' })).toThrow();
	});
	it('refuse les valeurs invalides', () => {
		expect(() => parseNotificationSettings({ summaryTime: '25:00' })).toThrow();
		expect(() => parseNotificationSettings({ aquariumIds: [0] })).toThrow();
		expect(() => parseNotificationSettings({ ntfyTopic: 'a b' })).toThrow();
	});
});

describe('ignorer une occurrence', () => {
	it('repousse d’un cycle depuis aujourd’hui si la tâche est en retard', () => {
		expect(skipDue('2026-10-28', '2026-10-30', 7, addDays)).toBe('2026-11-06');
	});
	it('repousse d’un cycle depuis l’échéance si elle est à venir', () => {
		expect(skipDue('2026-11-02', '2026-10-30', 7, addDays)).toBe('2026-11-09');
	});
});

describe('bilan de la semaine', () => {
	const s = { weeklyReport: true, weeklyTime: '18:00', quietStart: null, quietEnd: null };
	it('lit le jour de la semaine à Paris', () => {
		expect(parisWeekday(Date.parse('2026-11-01T12:00:00Z'))).toBe(0); // dimanche
		expect(parisWeekday(Date.parse('2026-10-30T12:00:00Z'))).toBe(5); // vendredi
		expect(parisWeekday(Date.parse('2026-10-31T23:30:00Z'))).toBe(0); // minuit passé à Paris
	});
	it('part le dimanche à partir de l’heure réglée, une fois', () => {
		expect(weeklyDue(s, 0, minutesOf('17:59'), false)).toBe(false);
		expect(weeklyDue(s, 0, minutesOf('18:00'), false)).toBe(true);
		expect(weeklyDue(s, 0, minutesOf('21:00'), false)).toBe(true);
		expect(weeklyDue(s, 0, minutesOf('18:05'), true)).toBe(false);
	});
	it('ne part pas un autre jour ni s’il est désactivé', () => {
		expect(weeklyDue(s, 1, minutesOf('18:30'), false)).toBe(false);
		expect(weeklyDue({ ...s, weeklyReport: false }, 0, minutesOf('18:30'), false)).toBe(false);
	});
	it('respecte les heures de silence', () => {
		const quiet = { ...s, quietStart: '17:00', quietEnd: '19:00' };
		expect(weeklyDue(quiet, 0, minutesOf('18:30'), false)).toBe(false);
		expect(weeklyDue(quiet, 0, minutesOf('19:00'), false)).toBe(true);
	});
});

import { describe, expect, it } from 'vitest';
import { analyzeParameter, driftThreshold, isReassuring, slopePerDay } from './drift';
import { cyclingCoach } from './cycling';
import { addDays, dayInParis, daysBetween } from './dates';
import { dueTasks, nextDueAfter } from './tasks';
import type { Parameter, Task } from '../types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-30T10:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

const ph: Parameter = {
	id: 1,
	aquariumId: 1,
	key: 'ph',
	name: 'pH',
	unit: '',
	min: 6.5,
	max: 7.8,
	driftPerWeek: 0.5,
	decimals: 1,
	step: 0.1,
	position: 0
};

describe('slopePerDay', () => {
	it('calcule la pente d’une droite', () => {
		const pts = [0, 1, 2, 3].map((d) => ({ t: d * DAY, v: 7 - 0.1 * d }));
		expect(slopePerDay(pts)).toBeCloseTo(-0.1);
	});
	it('renvoie null sans assez de points ou sans étalement', () => {
		expect(slopePerDay([{ t: 0, v: 1 }])).toBeNull();
		expect(slopePerDay([{ t: 5, v: 1 }, { t: 5, v: 2 }])).toBeNull();
	});
});

describe('analyzeParameter', () => {
	it('ne dit rien sans mesure', () => {
		expect(analyzeParameter(ph, [], NOW)).toBeNull();
	});
	it('signale une valeur hors plage', () => {
		const alert = analyzeParameter(ph, [{ value: 8.2, measuredAt: daysAgo(0) }], NOW);
		expect(alert?.level).toBe('hors_plage');
		expect(alert?.message).toContain('au-dessus');
	});
	it('signale une valeur sous la plage', () => {
		const alert = analyzeParameter(ph, [{ value: 6.1, measuredAt: daysAgo(0) }], NOW);
		expect(alert?.message).toContain('en dessous');
	});
	it('détecte une dérive rapide encore dans la plage', () => {
		const alert = analyzeParameter(
			ph,
			[
				{ value: 7.6, measuredAt: daysAgo(6) },
				{ value: 7.3, measuredAt: daysAgo(3) },
				{ value: 7.0, measuredAt: daysAgo(0) }
			],
			NOW
		);
		expect(alert?.level).toBe('derive');
		expect(alert?.change7d).toBeCloseTo(-0.7, 1);
		expect(alert?.message).toContain('baisse');
	});
	it('ignore une variation lente', () => {
		const alert = analyzeParameter(
			ph,
			[
				{ value: 7.2, measuredAt: daysAgo(6) },
				{ value: 7.1, measuredAt: daysAgo(3) },
				{ value: 7.1, measuredAt: daysAgo(0) }
			],
			NOW
		);
		expect(alert).toBeNull();
	});
	it('exige 3 points étalés sur 2 jours', () => {
		const two = [
			{ value: 7.6, measuredAt: daysAgo(6) },
			{ value: 7.0, measuredAt: daysAgo(0) }
		];
		expect(analyzeParameter(ph, two, NOW)).toBeNull();
		const tight = [
			{ value: 7.6, measuredAt: daysAgo(1) },
			{ value: 7.3, measuredAt: daysAgo(0.5) },
			{ value: 7.0, measuredAt: daysAgo(0) }
		];
		expect(analyzeParameter(ph, tight, NOW)).toBeNull();
	});
	it('ne signale pas une baisse rapide des nitrites pendant le cyclage', () => {
		const no2: Parameter = { ...ph, key: 'no2', name: 'Nitrites', min: 0, max: 0.1, driftPerWeek: null, decimals: 2 };
		const alert = analyzeParameter(
			no2,
			[
				{ value: 0.8, measuredAt: daysAgo(6) },
				{ value: 0.3, measuredAt: daysAgo(3) },
				{ value: 0.05, measuredAt: daysAgo(0) }
			],
			NOW
		);
		expect(alert).toBeNull();
	});
	it('ne signale pas un retour rapide vers le milieu de la plage', () => {
		expect(isReassuring(ph, 7.0, 0.6)).toBe(true);
		expect(isReassuring(ph, 7.0, -0.6)).toBe(false);
		expect(isReassuring(ph, 6.2, 0.6)).toBe(false);
	});
	it('utilise 25 % de la plage quand aucun seuil n’est défini', () => {
		expect(driftThreshold({ driftPerWeek: null, min: 6, max: 8 })).toBeCloseTo(0.5);
		expect(driftThreshold({ driftPerWeek: null, min: null, max: 8 })).toBeNull();
	});
});

describe('cyclingCoach', () => {
	const r = (daysBefore: number, v: number) => ({ t: NOW - daysBefore * DAY, v });

	it('demande des mesures quand il en manque', () => {
		expect(cyclingCoach({ nh3: [], no2: [], no3: [] }).stage).toBe('aucune_mesure');
		expect(cyclingCoach({ nh3: [r(0, 1)], no2: [], no3: [] }).advice).toContain('nitrites');
	});
	it('démarrage : ammoniaque seule', () => {
		expect(cyclingCoach({ nh3: [r(0, 2)], no2: [r(0, 0)], no3: [] }).stage).toBe('demarrage');
	});
	it('pic de nitrites', () => {
		expect(cyclingCoach({ nh3: [r(0, 0)], no2: [r(0, 1)], no3: [r(0, 5)] }).stage).toBe(
			'pic_nitrites'
		);
	});
	it('presque fini avec une seule série à zéro', () => {
		const s = cyclingCoach({ nh3: [r(0, 0)], no2: [r(0, 0)], no3: [r(0, 10)] });
		expect(s.stage).toBe('finalisation');
		expect(s.ready).toBe(false);
	});
	it('prêt après deux séries à zéro espacées de 2 jours avec des nitrates', () => {
		const s = cyclingCoach({
			nh3: [r(3, 0.5), r(2, 0), r(0, 0)],
			no2: [r(3, 0), r(2, 0), r(0, 0)],
			no3: [r(0, 15)]
		});
		expect(s.stage).toBe('pret');
		expect(s.ready).toBe(true);
	});
	it('pas prêt sans nitrates', () => {
		const s = cyclingCoach({ nh3: [r(3, 0), r(0, 0)], no2: [r(3, 0), r(0, 0)], no3: [r(0, 0)] });
		expect(s.ready).toBe(false);
		expect(s.advice).toContain('nitrates');
	});
	it('pas prêt si les deux séries sont trop rapprochées', () => {
		const s = cyclingCoach({
			nh3: [r(1, 0), r(0, 0)],
			no2: [r(1, 0), r(0, 0)],
			no3: [r(0, 10)]
		});
		expect(s.ready).toBe(false);
	});
});

describe('dates et tâches', () => {
	it('calcule le jour à Paris autour de minuit', () => {
		expect(dayInParis('2026-10-30T22:30:00Z')).toBe('2026-10-30');
		expect(dayInParis('2026-10-30T23:30:00Z')).toBe('2026-10-31');
	});
	it('ajoute des jours à travers le changement d’heure', () => {
		expect(addDays('2026-10-24', 3)).toBe('2026-10-27');
		expect(addDays('2026-10-31', 2)).toBe('2026-11-02');
		expect(daysBetween('2026-10-25', '2026-10-26')).toBe(1);
	});

	const task = (id: number, nextDue: string, active = true): Task => ({
		id,
		aquariumId: 1,
		title: `t${id}`,
		kind: 'autre',
		everyDays: 7,
		nextDue,
		active
	});

	it('liste les tâches dues ou en retard, les plus anciennes d’abord', () => {
		const due = dueTasks(
			[task(1, '2026-10-31'), task(2, '2026-10-30'), task(3, '2026-10-20'), task(4, '2026-10-01', false)],
			NOW
		);
		expect(due.map((t) => t.id)).toEqual([3, 2]);
	});
	it('replanifie depuis le jour de réalisation', () => {
		expect(nextDueAfter('2026-10-30T10:00:00Z', 7)).toBe('2026-11-06');
	});
});

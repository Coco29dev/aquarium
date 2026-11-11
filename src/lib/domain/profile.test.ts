import { describe, expect, it } from 'vitest';
import { ANNIVERSARY_WINDOW, DEFAULT_PROFILE, anniversaryOf, doneIds, milestones, newlyDone, nextMilestone, parseProfile, personalGreeting, rankPicks } from './profile';

const facts = { tanks: 1, measurements: 0, waterChanges: 0, arrivals: 0, daysTracked: 0, stability: null, covers: 0 };

describe('parseProfile', () => {
	it('retombe sur le profil vide pour une valeur invalide', () => {
		expect(parseProfile(null)).toEqual(DEFAULT_PROFILE);
		expect(parseProfile({ level: 'dieu', interest: 3, accent: 'rose', name: 4 })).toEqual(DEFAULT_PROFILE);
	});
	it('garde les valeurs valides et rogne le prénom', () => {
		const p = parseProfile({ name: '  Corentin  ', level: 'confirme', interest: 'recif', accent: 'corail' });
		expect(p).toEqual({ name: 'Corentin', level: 'confirme', interest: 'recif', accent: 'corail' });
		expect(parseProfile({ name: 'x'.repeat(80) }).name).toHaveLength(30);
	});
});

describe('personalGreeting', () => {
	it('ajoute le prénom seulement s’il existe', () => {
		expect(personalGreeting('Bonsoir', 'Corentin')).toBe('Bonsoir Corentin');
		expect(personalGreeting('Bonsoir', '  ')).toBe('Bonsoir');
	});
});

describe('rankPicks', () => {
	const all = ['demarrer', 'entretien', 'plantes', 'sante', 'vivre'].map((slug) => ({ theme: { slug } }));
	const order = (p: Parameters<typeof rankPicks>[1]) => rankPicks(all, p).map((x) => x.theme.slug);
	it('garde l’ordre sans profil', () => expect(order({ level: null, interest: null })).toEqual(['demarrer', 'entretien', 'plantes', 'sante', 'vivre']));
	it('écarte les bases pour un confirmé', () => expect(order({ level: 'confirme', interest: null })).not.toContain('demarrer'));
	it('met les bases devant pour un débutant', () => expect(order({ level: 'debutant', interest: 'plantes' })[0]).toBe('demarrer'));
	it('met le centre d’intérêt devant', () => expect(order({ level: 'intermediaire', interest: 'plantes' })[0]).toBe('plantes'));
});

describe('milestones', () => {
	it('propose les bases à un débutant et avance avec les données', () => {
		const list = milestones('debutant', facts);
		expect(nextMilestone(list)?.id).toBe('mesure');
		const later = milestones('debutant', { ...facts, measurements: 3, waterChanges: 1, arrivals: 2, daysTracked: 40 });
		expect(nextMilestone(later)).toBeNull();
	});
	it('exige davantage d’un confirmé', () => {
		const done = milestones('confirme', { ...facts, measurements: 10 }).filter((m) => m.done);
		expect(done).toHaveLength(0);
		expect(milestones('confirme', { ...facts, stability: 90 }).find((m) => m.id === 'stable')?.done).toBe(true);
	});
	it('sans niveau, se comporte comme un débutant', () => {
		expect(milestones(null, facts).map((m) => m.id)).toEqual(milestones('debutant', facts).map((m) => m.id));
	});
});

describe('jalons atteints', () => {
	it('ne fête rien la première fois : l’état actuel devient le point de départ', () => {
		const list = milestones('debutant', { ...facts, measurements: 3, waterChanges: 1 });
		expect(newlyDone(null, list)).toEqual([]);
	});
	it('annonce seulement ce qui vient de passer à fait', () => {
		const before = milestones('debutant', { ...facts, measurements: 1 });
		const after = milestones('debutant', { ...facts, measurements: 1, waterChanges: 1 });
		expect(newlyDone(doneIds(before), after).map((m) => m.id)).toEqual(['eau']);
		expect(newlyDone(doneIds(after), after)).toEqual([]);
	});
	it('ne dit rien d’un jalon qui repasse à non fait (aucune perte)', () => {
		const full = milestones('debutant', { ...facts, measurements: 1, waterChanges: 1 });
		const fewer = milestones('debutant', { ...facts, measurements: 0, waterChanges: 0 });
		expect(newlyDone(doneIds(full), fewer)).toEqual([]);
	});
});

describe('anniversaires de bac', () => {
	it('fête 30 jours, 100 jours, puis chaque année', () => {
		expect(anniversaryOf(30)).toEqual({ days: 30, label: '30 jours' });
		expect(anniversaryOf(100)).toEqual({ days: 100, label: '100 jours' });
		expect(anniversaryOf(365)).toEqual({ days: 365, label: '1 an' });
		expect(anniversaryOf(730)).toEqual({ days: 730, label: '2 ans' });
	});
	it('reste affiché quelques jours pour qui n’ouvre pas l’appli le jour J', () => {
		expect(anniversaryOf(30 + ANNIVERSARY_WINDOW - 1)?.days).toBe(30);
		expect(anniversaryOf(30 + ANNIVERSARY_WINDOW)).toBeNull();
		expect(anniversaryOf(366)?.label).toBe('1 an');
		expect(anniversaryOf(365 + ANNIVERSARY_WINDOW)).toBeNull();
	});
	it('ne dit rien les autres jours, ni sans date de mise en eau', () => {
		for (const age of [0, 1, 29, 60, 99, 200, 364, 500]) expect(anniversaryOf(age)).toBeNull();
		expect(anniversaryOf(null)).toBeNull();
		expect(anniversaryOf(undefined)).toBeNull();
	});
});

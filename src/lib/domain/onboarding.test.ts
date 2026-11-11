import { describe, expect, it } from 'vitest';
import {
	FRESH_ONBOARDING,
	SETTLED_ONBOARDING,
	TOUR_STEPS,
	clampStep,
	isLastStep,
	parseOnboarding,
	resolveOnboarding,
	shouldAutoStartTour
} from './onboarding';

describe('parseOnboarding', () => {
	it('renvoie null quand rien n’est enregistré ou que la valeur est inutilisable', () => {
		expect(parseOnboarding(null)).toBeNull();
		expect(parseOnboarding('oui')).toBeNull();
		expect(parseOnboarding({ tour: 'fini' })).toBeNull();
	});
	it('lit un état valide et complète ce qui manque', () => {
		expect(parseOnboarding({ welcomeDone: true, tour: 'skipped' })).toEqual({ welcomeDone: true, tour: 'skipped' });
		expect(parseOnboarding({ tour: 'done' })).toEqual({ welcomeDone: false, tour: 'done' });
		expect(parseOnboarding({ welcomeDone: true })).toEqual({ welcomeDone: true, tour: 'pending' });
	});
});

describe('resolveOnboarding', () => {
	it('le serveur fait foi, puis la copie locale', () => {
		const remote = { welcomeDone: true, tour: 'done' as const };
		expect(resolveOnboarding(remote, FRESH_ONBOARDING, 0)).toEqual(remote);
		expect(resolveOnboarding(null, { welcomeDone: true, tour: 'skipped' }, 0)).toEqual({ welcomeDone: true, tour: 'skipped' });
	});
	it('un compte neuf sans bac voit tout', () => expect(resolveOnboarding(null, null, 0)).toEqual(FRESH_ONBOARDING));
	it('un compte déjà utilisé n’est jamais dérangé', () => {
		expect(resolveOnboarding(null, null, 2)).toEqual(SETTLED_ONBOARDING);
		expect(resolveOnboarding(null, { welcomeDone: true, tour: 'pending' }, 2)).toEqual(SETTLED_ONBOARDING);
	});
});

describe('shouldAutoStartTour', () => {
	const ready = { welcomeDone: true, tour: 'pending' as const };
	it('démarre sur un écran d’onglet une fois l’accueil passé', () => {
		expect(shouldAutoStartTour(ready, '/')).toBe(true);
		expect(shouldAutoStartTour(ready, '/aquariums')).toBe(true);
	});
	it('attend l’accueil, ne rejoue pas, et reste hors des formulaires et détails', () => {
		expect(shouldAutoStartTour({ welcomeDone: false, tour: 'pending' }, '/')).toBe(false);
		expect(shouldAutoStartTour({ welcomeDone: true, tour: 'done' }, '/')).toBe(false);
		expect(shouldAutoStartTour({ welcomeDone: true, tour: 'skipped' }, '/')).toBe(false);
		expect(shouldAutoStartTour(ready, '/aquariums/nouveau')).toBe(false);
		expect(shouldAutoStartTour(ready, '/aquariums/3')).toBe(false);
		expect(shouldAutoStartTour(ready, '/bienvenue')).toBe(false);
	});
});

describe('parcours', () => {
	it('a des étapes uniques, commence et finit sans projecteur', () => {
		const ids = TOUR_STEPS.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(TOUR_STEPS[0].target).toBeUndefined();
		expect(TOUR_STEPS.at(-1)?.target).toBeUndefined();
	});
	it('garde l’index dans les bornes', () => {
		expect(clampStep(-3)).toBe(0);
		expect(clampStep(99)).toBe(TOUR_STEPS.length - 1);
		expect(clampStep(Number.NaN)).toBe(0);
		expect(isLastStep(TOUR_STEPS.length - 1)).toBe(true);
		expect(isLastStep(0)).toBe(false);
	});
});

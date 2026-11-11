import { expect, test, type Page } from '@playwright/test';

// Mouvement et retours d'état : mouvement réduit, bulle de l'assistant, navigations rapprochées, pastille hors ligne.
// Ce fichier passe avant parcours.spec.ts (ordre alphabétique) et ne doit rien laisser dans la base :
// l'état « visite faite » est simulé côté navigateur (route interceptée), aucune donnée n'est créée sur le serveur.

const PASSWORD = 'e2e-secret';
const SETTLED = { welcomeDone: true, tour: 'done' };

async function login(page: Page) {
	// Compte « installé » vu du navigateur seulement : l'appli ne redirige pas vers l'accueil et ne lance pas la visite.
	await page.route('**/api/settings/onboarding', (route) => route.fulfill({ json: SETTLED }));
	await page.goto('/login');
	await page.getByPlaceholder('Requis').fill(PASSWORD);
	await page.getByRole('button', { name: 'Se connecter' }).click();
	await page.waitForURL((u) => !u.pathname.startsWith('/login'));
	await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
}

/** Animations qui ne s'arrêtent jamais, hors indicateurs d'attente (.busy : un souffle d'opacité autorisé). */
const infiniteAnimations = (page: Page) =>
	page.evaluate(() =>
		document
			.getAnimations()
			.filter((a) => {
				const effect = a.effect as KeyframeEffect | null;
				return effect?.getComputedTiming().iterations === Infinity && !effect.target?.closest('.busy');
			})
			.map((a) => (a as CSSAnimation).animationName ?? a.constructor.name)
	);

test.describe('mouvement réduit', () => {
	test.use({ reducedMotion: 'reduce' });

	test('aucune animation infinie hors .busy, voile de démarrage retiré', async ({ page }) => {
		await login(page);
		await expect(page.locator('#boot')).toHaveCount(0);
		expect(await infiniteAnimations(page)).toEqual([]);
		// L'écran d'accueil (bulles, poisson, vagues) est la plus chargée en boucles : coupée aussi.
		await page.goto('/bienvenue');
		await expect(page.getByRole('heading', { name: 'Bienvenue dans Biotope' })).toBeVisible();
		expect(await infiniteAnimations(page)).toEqual([]);
	});
});

test('témoin : sans mouvement réduit, l’écran d’accueil boucle bien (le test ci-dessus est sensible)', async ({ page }) => {
	await login(page);
	await page.goto('/bienvenue');
	await expect(page.getByRole('heading', { name: 'Bienvenue dans Biotope' })).toBeVisible();
	expect((await infiniteAnimations(page)).length).toBeGreaterThan(0);
});

test('bulle de l’assistant : la transition couvre translate (sinon elle saute de côté)', async ({ page }) => {
	await login(page);
	const bubble = page.getByRole('link', { name: 'Ouvrir l’assistant' });
	await expect(bubble).toBeVisible();
	const property = await bubble.evaluate((el) => getComputedStyle(el).transitionProperty);
	expect(property).toContain('translate');
});

test('deux navigations rapprochées : pas d’erreur, l’état de transition est nettoyé', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await login(page);
	await page.evaluate(() => {
		// Deux appuis dans la même image : le second remplace le premier avant la fin de sa transition.
		(document.querySelector('a[href="/aquariums"]') as HTMLElement).click();
		(document.querySelector('a[href="/encyclopedie"]') as HTMLElement).click();
	});
	await page.waitForURL('**/encyclopedie');
	await expect.poll(() => page.evaluate(() => document.documentElement.dataset.nav ?? null), { timeout: 5000 }).toBeNull();
	// Et on peut continuer à naviguer normalement.
	await page.getByRole('link', { name: 'Plus' }).click();
	await page.waitForURL('**/reglages');
	expect(errors).toEqual([]);
});

test('barre d’onglets : la pilule suit l’onglet actif (--i)', async ({ page }) => {
	await login(page);
	const pill = page.locator('.tab-pill');
	const index = () => pill.evaluate((el) => (el.parentElement as HTMLElement).style.getPropertyValue('--i').trim());
	expect(await index()).toBe('0');
	await page.getByRole('link', { name: 'Savoir' }).click();
	await page.waitForURL('**/encyclopedie');
	// L'écran change dans la transition : le rang suit un instant plus tard.
	await expect.poll(index).toBe('2');
});

test('pastille d’état : hors ligne avec le compte des saisies, puis « Tout est envoyé »', async ({ page, context }) => {
	await login(page);
	// Le magasin de l'appli : même module que celui de l'interface (dev), pour simuler des saisies en attente.
	const setPending = (count: number) =>
		page.evaluate(async (n) => {
			const url = '/src/lib/client/store.svelte.ts';
			const { store } = await import(/* @vite-ignore */ url);
			store.pending = Array.from({ length: n }, (_, i) => ({
				type: 'measurement',
				parameterId: 1,
				aquariumId: 1,
				value: 7,
				measuredAt: new Date().toISOString(),
				clientId: `e2e-motion-${i}`
			}));
		}, count);
	const status = page.getByRole('status').filter({ hasText: /Hors ligne|envoi|envoyé/ });

	// Hors ligne, sans saisie : le texte seul ; avec des saisies : le compte, au pluriel.
	await context.setOffline(true);
	await expect(status).toHaveText('Hors ligne');
	await setPending(1);
	await expect(status).toHaveText('Hors ligne · 1 saisie gardée');
	await setPending(2);
	await expect(status).toHaveText('Hors ligne · 2 saisies gardées');

	// Retour en ligne : la file simulée est vidée avant que l'appli ne tente de l'envoyer.
	await setPending(0);
	await context.setOffline(false);
	await expect(status).toHaveCount(0, { timeout: 5000 });

	// En ligne, file qui se vide : « Tout est envoyé » deux secondes, sans autre bannière.
	await setPending(1);
	await expect(status).toHaveText('1 saisie en cours d’envoi');
	await setPending(0);
	await expect(status).toHaveText('Tout est envoyé');
	await expect(status).toHaveCount(0, { timeout: 5000 });
});

// Aucune donnée en cache : le squelette de l'écran Aujourd'hui apparaît après 150 ms, jamais le rond d'attente.
test('chargement lent : squelette annoncé, puis l’écran', async ({ page }) => {
	await page.route('**/api/sync', async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 1500));
		await route.continue();
	});
	await login(page);
	const loading = page.getByRole('status', { name: 'Chargement' });
	await expect(loading).toBeVisible();
	expect(await loading.locator('.sk').count()).toBe(3);
	// Le voile de démarrage est retiré (son fondu dure 300 ms) ; le squelette cède la place à l'écran.
	await expect(page.locator('#boot')).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'Aucun bac pour l’instant' })).toBeVisible({ timeout: 10_000 });
	await expect(loading).toHaveCount(0);
});

// Ni cache ni réseau : un état vide illustré avec « Réessayer », qui relance la synchronisation.
test('sans cache ni connexion : état vide et « Réessayer »', async ({ page }) => {
	const failing = () => page.route('**/api/sync', (route) => route.abort());
	await failing();
	await login(page);
	await expect(page.getByRole('heading', { name: 'Rien à afficher pour l’instant' })).toBeVisible({ timeout: 10_000 });
	await page.unroute('**/api/sync');
	await page.getByRole('button', { name: 'Réessayer' }).click();
	await expect(page.getByRole('heading', { name: 'Aucun bac pour l’instant' })).toBeVisible({ timeout: 10_000 });
});

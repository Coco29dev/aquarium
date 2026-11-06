import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'e2e-secret';

async function login(page: Page) {
	await page.goto('/login');
	await page.getByPlaceholder('Requis').fill(PASSWORD);
	await page.getByRole('button', { name: 'Se connecter' }).click();
	await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

test.describe.configure({ mode: 'serial' });

test('accès protégé : API fermée et mauvais mot de passe refusé', async ({ page, request }) => {
	expect((await request.get('/api/aquariums')).status()).toBe(401);
	await page.goto('/login');
	await expect(page.getByRole('heading', { name: 'Biotope' })).toBeVisible();
	await page.getByPlaceholder('Requis').fill('mauvais');
	await page.getByRole('button', { name: 'Se connecter' }).click();
	await expect(page.getByRole('alert')).toBeVisible();
});

test('première ouverture : visite en quatre pages puis état vide', async ({ page }) => {
	await login(page);
	await page.waitForURL('**/bienvenue');
	await expect(page.getByRole('heading', { name: 'Bienvenue dans Biotope' })).toBeVisible();
	await expect(page.getByRole('tab')).toHaveCount(5);
	for (let i = 1; i <= 4; i++) {
		await page.getByRole('button', { name: 'Continuer' }).click();
		// Le défilement est animé : on attend d'être arrivé avant de recliquer.
		await expect(page.getByRole('tab', { name: `Page ${i + 1}` })).toHaveAttribute('aria-selected', 'true');
	}
	await expect(page.getByRole('button', { name: 'Créer mon premier bac' })).toBeVisible();
	await page.getByRole('button', { name: 'Plus tard' }).click();
	await page.waitForURL((u) => u.pathname === '/');
	await expect(page.getByRole('heading', { name: 'Aucun bac pour l’instant' })).toBeVisible();
});

test('un bac avec une tâche en retard : carte « À faire maintenant » et prévision', async ({ page }) => {
	await login(page);
	await page.evaluate(() => localStorage.setItem('onboarded', '1'));
	const measurements = [6, 4, 2, 0].map((d, i) => ({ parameterKey: 'no3', value: 20 + i * 4, measuredAt: new Date(Date.now() - d * 86_400_000).toISOString() }));
	const res = await page.request.post('/api/aquariums', {
		headers: { origin: 'http://localhost:5188' },
		data: {
			name: 'Salon', waterType: 'douce', volumeL: 240, startedOn: day(-60), stage: 'actif',
			tasks: [{ title: 'Changement d’eau', kind: 'eau', everyDays: 7, nextDue: day(-3) }],
			measurements, inhabitants: [], projectItems: []
		}
	});
	expect(res.ok()).toBeTruthy();
	await page.goto('/');
	const card = page.getByRole('region', { name: 'Prochaine action' });
	await expect(card).toContainText('Changement d’eau');
	await expect(card).toContainText('En retard de 3 jours');
	await expect(page.getByText(/Nitrates \(NO3\) atteindra 40 mg\/L dans 4 jours/)).toBeVisible();
});

test('cocher « Fait » retire la carte après le délai d’annulation', async ({ page }) => {
	await login(page);
	await page.goto('/');
	const card = page.getByRole('region', { name: 'Prochaine action' });
	await card.getByRole('button', { name: 'Fait' }).click();
	await expect(card).toBeHidden({ timeout: 10_000 });
});

test('l’écran de l’assistant s’ouvre', async ({ page }) => {
	await login(page);
	await page.goto('/assistant');
	await expect(page.getByRole('log')).toBeVisible();
});

test('ajouter un poisson depuis la base : recherche, fiche, ajout', async ({ page }) => {
	await login(page);
	await page.evaluate(() => localStorage.setItem('onboarded', '1'));
	const res = await page.request.post('/api/aquariums', {
		headers: { origin: 'http://localhost:5188' },
		data: { name: 'Base', waterType: 'douce', volumeL: 200, startedOn: day(-60), stage: 'actif', tasks: [], measurements: [], inhabitants: [], projectItems: [] }
	});
	const { id } = await res.json();
	await page.goto(`/aquariums/${id}/inventaire`);
	await page.getByRole('button', { name: 'Ajouter un animal' }).click();
	await page.getByPlaceholder('Nom commun ou latin').fill('neon bleu');
	await page.getByRole('button', { name: /Néon bleu/ }).first().click();
	await expect(page.getByText('Conseils d’élevage')).toBeVisible();
	await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
	await expect(page.getByText('Néon bleu').first()).toBeVisible();
});

// PNG 1×1 : suffisant pour passer la validation du type d'image côté serveur.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('habitant : photo perso, puis retour depuis la fiche d’espèce vers le bac', async ({ page }) => {
	await login(page);
	await page.evaluate(() => localStorage.setItem('onboarded', '1'));
	const res = await page.request.post('/api/aquariums', {
		headers: { origin: 'http://localhost:5188' },
		data: { name: 'Photos', waterType: 'douce', volumeL: 200, startedOn: day(-60), stage: 'actif', tasks: [], measurements: [], inhabitants: [], projectItems: [] }
	});
	const { id } = await res.json();
	await page.goto(`/aquariums/${id}/inventaire`);
	await page.getByRole('button', { name: 'Ajouter un animal' }).click();
	await page.getByPlaceholder('Nom commun ou latin').fill('neon bleu');
	await page.getByRole('button', { name: /Néon bleu/ }).first().click();
	await page.getByRole('button', { name: 'Ajouter', exact: true }).click();

	// La carte de l'habitant s'ouvre sur sa fiche, avec la description de l'espèce.
	await page.getByRole('button', { name: /Néon bleu/ }).first().click();
	await expect(page.getByText('Ajouter ma propre photo')).toBeVisible();

	// Photo personnelle : envoyée, puis servie par la route dédiée.
	await page.locator('input[type=file]').setInputFiles({ name: 'perso.png', mimeType: 'image/png', buffer: PNG });
	await expect(page.getByText('Photo personnelle ·')).toBeVisible();

	// Fiche complète de l'espèce, puis retour : on retrouve le bac, pas l'encyclopédie.
	await page.getByRole('link', { name: 'Voir la fiche complète' }).click();
	await page.waitForURL('**/encyclopedie/especes?id=*');
	await page.getByRole('button', { name: /Retour/ }).click();
	await page.waitForURL(`**/aquariums/${id}/inventaire`);
});

test('fiche d’un bac : le bandeau reste en place d’un onglet à l’autre', async ({ page }) => {
	await login(page);
	await page.evaluate(() => localStorage.setItem('onboarded', '1'));
	const res = await page.request.post('/api/aquariums', {
		headers: { origin: 'http://localhost:5188' },
		data: { name: 'Bandeau', waterType: 'douce', volumeL: 100, startedOn: day(-60), stage: 'actif', tasks: [], measurements: [], inhabitants: [], projectItems: [] }
	});
	const { id } = await res.json();
	await page.goto(`/aquariums/${id}`);
	const title = page.getByRole('heading', { name: 'Bandeau', level: 1 });
	await expect(title).toBeVisible();
	const handle = await title.elementHandle();
	for (const [name, path] of [['Vivants', '/inventaire'], ['Journal', '/journal'], ['Tâches', '/taches'], ['Suivi', '']] as const) {
		await page.getByRole('radio', { name }).click();
		await expect(page).toHaveURL(new RegExp(`/aquariums/${id}${path}$`));
		await expect(page.getByRole('radio', { name })).toBeChecked();
		await expect(title).toBeVisible();
		// Même élément DOM : l'en-tête n'a pas été recréé.
		expect(await handle!.evaluate((el) => el.isConnected)).toBe(true);
	}
});

test('profil : prénom, niveau et couleur personnalisent l’accueil', async ({ page }) => {
	await login(page);
	await page.evaluate(() => localStorage.setItem('onboarded', '1'));
	await page.request.post('/api/aquariums', {
		headers: { origin: 'http://localhost:5188' },
		data: { name: 'Profil', waterType: 'douce', volumeL: 100, startedOn: day(-5), stage: 'actif', tasks: [], measurements: [], inhabitants: [], projectItems: [] }
	});
	await page.goto('/reglages/profil');
	await page.getByPlaceholder('Ton prénom').fill('Corentin');
	await page.getByRole('radio', { name: /Je suis confirmé/ }).click();
	await page.getByRole('radio', { name: 'Corail' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-accent', 'corail');
	await page.getByPlaceholder('Ton prénom').blur();
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Corentin');
	// Parcours « confirmé » : jalons plus exigeants que ceux d'un débutant.
	await expect(page.getByText('Prochain jalon')).toBeVisible();
	// (la base de test contient déjà d'autres bacs : on vérifie seulement le jeu de jalons « confirmé »)
	await expect(page.getByText(/Deux bacs suivis|30 mesures notées|10 changements d’eau|Stabilité de 85 %/)).toBeVisible();
	// Le profil est conservé côté serveur.
	const saved = await (await page.request.get('/api/settings/profile')).json();
	expect(saved).toMatchObject({ name: 'Corentin', level: 'confirme', accent: 'corail' });
	await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/accueil.png` : 'test-results/accueil.png', fullPage: true });
	await page.goto('/reglages/profil');
	await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/profil.png` : 'test-results/profil.png', fullPage: true });
});

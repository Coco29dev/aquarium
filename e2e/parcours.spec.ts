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
	await expect(page.getByRole('tab')).toHaveCount(4);
	for (let i = 1; i <= 3; i++) {
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

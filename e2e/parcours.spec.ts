import { expect, test, type Page } from '@playwright/test';
import pg from 'pg';

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

test('première ouverture : accueil, visite guidée, puis état vide', async ({ page }) => {
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

	// La visite guidée démarre seule sur l'écran d'onglet, puis suit les huit étapes.
	const tour = page.getByRole('dialog', { name: 'Petite visite de l’appli' });
	await expect(tour).toBeVisible();
	await expect(tour).toContainText('Étape 1 sur 8');
	await tour.getByRole('button', { name: 'C’est parti' }).click();
	await expect(page.getByRole('dialog', { name: 'Aujourd’hui' })).toBeVisible();
	await page.getByRole('button', { name: 'Suivant' }).click();
	await page.waitForURL('**/aquariums');
	await expect(page.getByRole('dialog', { name: 'Bacs' })).toBeVisible();
	await page.getByRole('button', { name: 'Précédent' }).click();
	await expect(page.getByRole('dialog', { name: 'Aujourd’hui' })).toBeVisible();
	await page.getByRole('button', { name: 'Passer' }).click();
	await expect(page.getByRole('dialog')).toHaveCount(0);

	// Quittée : elle ne revient pas, ni au rechargement (l'état est enregistré sur le serveur).
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Aucun bac pour l’instant' })).toBeVisible();
	await page.waitForTimeout(1200);
	await expect(page.getByRole('dialog')).toHaveCount(0);
	const saved = await (await page.request.get('/api/settings/onboarding')).json();
	expect(saved).toEqual({ welcomeDone: true, tour: 'skipped' });

	// Elle se rejoue depuis Plus et se termine par la création du premier bac.
	await page.goto('/reglages');
	await page.getByRole('button', { name: 'Revoir la visite guidée' }).click();
	for (let i = 0; i < 7; i++) await page.getByRole('button', { name: /^(C’est parti|Suivant)$/ }).click();
	await expect(page.getByRole('dialog', { name: 'Tu es prêt' })).toBeVisible();
	await page.getByRole('button', { name: 'Créer mon premier bac' }).click();
	await page.waitForURL('**/aquariums/nouveau');
	expect(await (await page.request.get('/api/settings/onboarding')).json()).toEqual({ welcomeDone: true, tour: 'done' });
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

test('saisie de mesures : « Suivant » change de champ sans reprendre l’ancienne valeur, bouton d’ajout à portée du pouce', async ({ page }) => {
	await login(page);
	await page.evaluate(() => localStorage.setItem('onboarded', '1'));
	await page.goto('/mesurer');
	const fields = page.locator('.measure-list input');
	await expect(fields.first()).toBeVisible();
	await fields.first().click();
	await page.keyboard.type('7,4');
	await page.keyboard.press('Enter');
	await expect(fields.nth(1)).toBeFocused();
	// Une seule valeur confirmée : celle qu'on vient de taper.
	await expect(page.getByRole('button', { name: 'Ajouter 1 mesure' })).toBeVisible();
});

test('la bulle de l’assistant ne double pas les accès déjà présents', async ({ page }) => {
	await login(page);
	await page.evaluate(() => localStorage.setItem('onboarded', '1'));
	const bubble = page.getByRole('link', { name: 'Ouvrir l’assistant' });
	await page.goto('/');
	await expect(bubble).toHaveCount(1);
	await page.goto('/aquariums');
	await expect(bubble).toHaveCount(1);
	// L'en-tête d'un bac et l'écran « Plus » ont déjà leur bouton : pas de bulle par-dessus les valeurs.
	await page.goto('/aquariums/1');
	await expect(page.getByRole('link', { name: 'Assistant' })).toBeVisible();
	await expect(bubble).toHaveCount(0);
	await page.goto('/reglages');
	await expect(bubble).toHaveCount(0);
});

test('assistant : conversations retrouvées, renommées et supprimées avec leurs photos', async ({ page }) => {
	await login(page);
	await page.evaluate(() => localStorage.setItem('onboarded', '1'));
	const res = await page.request.post('/api/aquariums', {
		headers: { origin: 'http://localhost:5188' },
		data: { name: 'Salon', waterType: 'plantee', volumeL: 240, startedOn: day(-60), stage: 'actif', tasks: [], measurements: [], inhabitants: [], projectItems: [] }
	});
	const { id: tankId } = await res.json();

	// Deux conversations posées directement en base : pas d'appel à Claude. La première porte une photo.
	const raw = process.env.E2E_DATABASE_URL ?? 'postgres:///aquarium_e2e';
	const db = new pg.Client({ connectionString: raw.startsWith('postgres:///') ? raw.replace('postgres:///', 'postgres://localhost/') : raw });
	await db.connect();
	const thread = async (title: string | null, question: string, answer: string, photo = false) => {
		const { rows } = await db.query('INSERT INTO chat_threads (aquarium_id, title) VALUES ($1, $2) RETURNING id', [tankId, title]);
		const id: number = rows[0].id;
		const blocks: unknown[] = [{ type: 'text', text: '[Contexte du bac]' }, { type: 'text', text: question }];
		if (photo) {
			const { rows: a } = await db.query(
				`INSERT INTO chat_attachments (aquarium_id, thread_id, storage_key, content_type, bytes) VALUES ($1, $2, $3, 'image/png', 10) RETURNING id`,
				[tankId, id, `chat/${tankId}/e2e-${id}.png`]
			);
			blocks.unshift({ type: 'x_image', attachment_id: a[0].id });
		}
		await db.query(`INSERT INTO chat_messages (aquarium_id, thread_id, role, content) VALUES ($1, $2, 'user', $3), ($1, $2, 'assistant', $4)`, [
			tankId,
			id,
			JSON.stringify(blocks),
			JSON.stringify([{ type: 'text', text: answer }])
		]);
		return id;
	};
	const plants = await thread('Plantes qui jaunissent', 'Mes plantes jaunissent', 'Regarde le fer et les nitrates.', true);
	const cycle = await thread('Cyclage du bac', 'Combien de temps pour le cyclage ?', 'Compte quatre à six semaines.');

	try {
		await page.goto(`/assistant?c=${plants}`);
		await expect(page.getByText('Regarde le fer et les nitrates.')).toBeVisible();
		// Le titre de l'en-tête ouvre la liste : les deux conversations y sont, avec le bac et les photos.
		await page.getByRole('button', { name: /^Conversations\./ }).click();
		// Le nom de la feuille change avec le mode (« Conversations », « Sélectionner »…) : on la reconnaît à son champ de recherche.
		const list = page.getByRole('dialog').filter({ has: page.getByPlaceholder('Rechercher une conversation') });
		await expect(list.getByRole('button', { name: /Plantes qui jaunissent.*1 photo/ })).toBeVisible();
		await expect(list.getByRole('button', { name: /Cyclage du bac/ })).toBeVisible();
		// Recherche tolérante aux accents et aux majuscules.
		await list.getByPlaceholder('Rechercher une conversation').fill('CYCLAGE');
		await expect(list.getByRole('button', { name: /Plantes qui jaunissent/ })).toHaveCount(0);
		await list.getByPlaceholder('Rechercher une conversation').fill('');
		// Reprendre une autre conversation sans quitter l'écran.
		await list.getByRole('button', { name: /Cyclage du bac/ }).click();
		await expect(page.getByText('Compte quatre à six semaines.')).toBeVisible();
		await expect(page).toHaveURL(new RegExp(`c=${cycle}$`));

		// Renommer depuis le menu de la conversation.
		await page.getByRole('button', { name: 'Options de la conversation' }).click();
		await page.getByRole('dialog', { name: 'Conversation' }).getByRole('button', { name: 'Renommer' }).click();
		await page.getByLabel('Titre de la conversation').fill('Quatre semaines de cyclage');
		await page.getByRole('button', { name: 'Enregistrer' }).click();
		await expect(page.getByRole('button', { name: /^Conversations\. Quatre semaines de cyclage/ })).toBeVisible();

		// Sélection : l'alerte dit ce qui part, la suppression retire la conversation, ses photos et ses lignes.
		await page.getByRole('button', { name: /^Conversations\./ }).click();
		await list.getByRole('button', { name: 'Sélectionner' }).click();
		await list.getByRole('button', { name: /Plantes qui jaunissent/ }).click();
		await list.getByRole('button', { name: 'Supprimer (1)' }).click();
		const alert = page.getByRole('alertdialog');
		await expect(alert).toContainText('avec 1 photo');
		await expect(alert).toContainText('galerie du bac');
		await alert.getByRole('button', { name: 'Supprimer' }).click();
		await expect(list.getByRole('button', { name: /Plantes qui jaunissent/ })).toHaveCount(0);
		expect((await db.query('SELECT count(*)::int AS n FROM chat_threads WHERE id = $1', [plants])).rows[0].n).toBe(0);
		expect((await db.query('SELECT count(*)::int AS n FROM chat_attachments WHERE thread_id = $1', [plants])).rows[0].n).toBe(0);
		expect((await db.query('SELECT count(*)::int AS n FROM chat_messages WHERE thread_id = $1', [plants])).rows[0].n).toBe(0);
		// Les autres conversations ne sont pas touchées.
		expect((await db.query('SELECT count(*)::int AS n FROM chat_threads WHERE id = $1', [cycle])).rows[0].n).toBe(1);
		await list.getByRole('button', { name: 'Fermer' }).click();

		// Supprimer la conversation affichée : retour à un écran vierge, qui propose d'en reprendre une autre.
		await page.getByRole('button', { name: 'Options de la conversation' }).click();
		await page.getByRole('dialog', { name: 'Conversation' }).getByRole('button', { name: 'Supprimer la conversation' }).click();
		await page.getByRole('alertdialog').getByRole('button', { name: 'Supprimer' }).click();
		await expect(page.getByText('Pour commencer')).toBeVisible();
		await expect(page).toHaveURL(/\/assistant$/);
		expect((await db.query('SELECT count(*)::int AS n FROM chat_threads WHERE aquarium_id = $1', [tankId])).rows[0].n).toBe(0);
	} finally {
		await db.end();
	}
});

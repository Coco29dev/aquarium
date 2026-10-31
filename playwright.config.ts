import { defineConfig, devices } from '@playwright/test';

// Tests de parcours (npm run test:e2e) : serveur de développement sur une base Postgres jetable,
// recréée à chaque lancement par e2e/prepare-db.mjs. Jamais la base de production.
const PORT = 5188;
export const E2E_DB = process.env.E2E_DATABASE_URL ?? 'postgres:///aquarium_e2e';

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: 'list',
	use: { baseURL: `http://localhost:${PORT}`, ...devices['iPhone 14'], defaultBrowserType: 'chromium', locale: 'fr-FR', timezoneId: 'Europe/Paris' },
	webServer: {
		command: `node e2e/prepare-db.mjs && npx vite dev --port ${PORT} --strictPort`,
		url: `http://localhost:${PORT}/health`,
		reuseExistingServer: false,
		timeout: 60_000,
		env: { DATABASE_URL: E2E_DB, APP_PASSWORD: 'e2e-secret', HOST: '127.0.0.1' }
	}
});

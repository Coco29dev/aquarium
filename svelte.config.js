import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		// Mode runes forcé pour le projet (hors dépendances).
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter(),
		// Le service worker est géré par @vite-pwa/sveltekit, pas par SvelteKit.
		serviceWorker: { register: false }
	}
};

export default config;

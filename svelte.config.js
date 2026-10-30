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
		serviceWorker: { register: false },
		// CSP : scripts uniquement de l'appli (nonce/empreintes ajoutés par SvelteKit), rien d'externe.
		// Les styles en ligne restent permis (attributs style de Svelte).
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:', 'blob:'],
				'font-src': ['self', 'data:'],
				'connect-src': ['self'],
				'worker-src': ['self'],
				'manifest-src': ['self'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self'],
				'frame-ancestors': ['none']
			}
		}
	}
};

export default config;

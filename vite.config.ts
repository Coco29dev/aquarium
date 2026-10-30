import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: { include: ['src/**/*.test.ts'] },
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			// Service worker maison : push, ressources du build en cache et pages réseau d'abord.
			strategies: 'injectManifest',
			srcDir: 'src',
			filename: 'service-worker.ts',
			registerType: 'autoUpdate',
			injectRegister: false,
			manifest: {
				name: 'Aquarium',
				short_name: 'Aquarium',
				description: 'Suivi personnel de mes aquariums',
				lang: 'fr',
				start_url: '/',
				scope: '/',
				display: 'standalone',
				orientation: 'portrait',
				theme_color: '#f2f2f7',
				background_color: '#f2f2f7',
				icons: [
					{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
					{
						src: '/maskable-icon-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			injectManifest: {
				globPatterns: ['client/**/*.{js,css,ico,png,svg,webmanifest,woff2}']
			},
			kit: {
				adapterFallback: undefined
			}
		})
	]
});

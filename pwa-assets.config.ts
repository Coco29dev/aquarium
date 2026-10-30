import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Génère pwa-192x192, pwa-512x512, maskable-icon-512x512, apple-touch-icon-180x180, favicon.ico
export default defineConfig({
	preset: {
		...minimal2023Preset,
		maskable: {
			...minimal2023Preset.maskable,
			resizeOptions: { background: '#0e7490', fit: 'contain' }
		},
		apple: {
			...minimal2023Preset.apple,
			resizeOptions: { background: '#0e7490', fit: 'contain' }
		}
	},
	images: ['static/icon.svg']
});

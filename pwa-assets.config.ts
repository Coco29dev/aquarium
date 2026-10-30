import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Génère pwa-192x192, pwa-512x512, maskable-icon-512x512, apple-touch-icon-180x180, favicon.ico
export default defineConfig({
	preset: {
		...minimal2023Preset,
		maskable: {
			...minimal2023Preset.maskable,
			resizeOptions: { background: '#ffc93c', fit: 'contain' }
		},
		apple: {
			...minimal2023Preset.apple,
			padding: 0.1,
			resizeOptions: { background: '#ffc93c', fit: 'contain' }
		}
	},
	images: ['static/icon.svg']
});

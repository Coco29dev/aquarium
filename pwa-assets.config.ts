import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Génère pwa-64/192/512, maskable-icon-512x512, apple-touch-icon-180x180 et favicon.ico depuis static/icon.svg.
// L'icône est dessinée plein cadre (iOS arrondit les coins, Android masque en cercle) et son poisson reste dans
// le cercle de sécurité (rayon 40 % de la largeur) : plus de marge ni de fond plat à ajouter autour.
export default defineConfig({
	preset: {
		...minimal2023Preset,
		maskable: { ...minimal2023Preset.maskable, padding: 0 },
		apple: { ...minimal2023Preset.apple, padding: 0 }
	},
	images: ['static/icon.svg']
});

// Génère les écrans de lancement iOS (static/splash/*.png) et les balises <link> à coller dans app.html.
// Usage : node scripts/make-splash.mjs
//
// Le lancement est sans texte (comme le veulent les consignes d'Apple) : l'eau lagon avec le halo d'en haut à
// gauche, un réseau de vaguelettes très léger qui s'efface vers le bas, quelques bulles qui montent, et la
// marque (poisson et bulles, sans pastille) au centre. Le poisson est celui de src/lib/art/fish.ts (copié ici
// pour que le script tourne avec n'importe quel Node).
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SIZES = [
	[440, 956, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3],
	[390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [375, 667, 2]
];

const FISH = {
	tail: 'M18 33C14.5 28.5 10.5 23 5 19.5 6.5 25.5 7 29.5 9.5 33 7 36.5 6.5 40.5 5 46.5 10.5 43 14.5 37.5 18 33z',
	body: 'M50 33C50 23.5 41.5 16.5 31.5 16.5 23 16.5 18 22 15.5 30.5v5C18 44 23 49.5 31.5 49.5 41.5 49.5 50 42.5 50 33z',
	dorsal: 'M21 22C19.5 14.5 23.5 9.5 29 8 28.5 12.5 31.5 15 38 17.5z',
	gill: 'M37.5 22.5C34 29 34 37 37.5 43.5'
};

/** SVG d'un écran de lancement de W × H pixels. */
function splashSvg(W, H) {
	const s = (0.36 * W) / 56.3; // largeur du poisson : 36 % de l'écran
	const cx = W / 2;
	const cy = H * 0.45;
	const bubbles = [[0.57, 0.33, 0.012], [0.62, 0.285, 0.008], [0.54, 0.25, 0.006], [0.6, 0.205, 0.0045], [0.45, 0.19, 0.005], [0.7, 0.15, 0.004]]
		.map(([x, y, r]) => `<circle cx="${x * W}" cy="${y * H}" r="${r * W}" fill="none" stroke="#fff" stroke-opacity="${(0.55 - y).toFixed(2)}" stroke-width="${W * 0.0028}"/>`)
		.join('');
	const pw = W * 0.22;
	const ph = W * 0.06;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2ccad9"/><stop offset=".55" stop-color="#0b7f93"/><stop offset="1" stop-color="#06323f"/></linearGradient>
<radialGradient id="g" cx=".26" cy="0" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".4"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="c" gradientUnits="userSpaceOnUse" x1="8" y1="12" x2="48" y2="54"><stop offset="0" stop-color="#ffc178"/><stop offset="1" stop-color="#ff6f61"/></linearGradient>
<pattern id="p" width="${pw}" height="${ph}" patternUnits="userSpaceOnUse"><path d="M0 ${ph / 2}C${pw * 0.164} ${ph * 0.133} ${pw * 0.336} ${ph * 0.133} ${pw / 2} ${ph / 2}S${pw * 0.836} ${ph * 0.867} ${pw} ${ph / 2}" fill="none" stroke="#fff" stroke-opacity=".13" stroke-width="${W * 0.0035}" stroke-linecap="round"/></pattern>
<linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff" stop-opacity=".25"/><stop offset=".8" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="m"><rect width="${W}" height="${H}" fill="url(#f)"/></mask>
</defs>
<rect width="${W}" height="${H}" fill="url(#w)"/>
<rect width="${W}" height="${H}" fill="url(#g)"/>
<g mask="url(#m)"><g transform="rotate(24 ${W / 2} ${H / 2})"><rect x="${-W}" y="${-H}" width="${3 * W}" height="${3 * H}" fill="url(#p)"/></g></g>
${bubbles}
<g transform="translate(${cx} ${cy}) scale(${s}) translate(-31.65 -28.7)">
<g fill="#021b23" opacity=".25" transform="translate(.6 1.8)"><path d="${FISH.tail}" stroke="#021b23" stroke-width="3" stroke-linejoin="round"/><path d="${FISH.body}"/></g>
<path d="${FISH.tail}" fill="url(#c)" stroke="url(#c)" stroke-width="3" stroke-linejoin="round"/>
<path d="${FISH.dorsal}" fill="#ff6f61" stroke="#ff6f61" stroke-width="2" stroke-linejoin="round"/>
<path d="${FISH.body}" fill="url(#c)"/>
<path d="${FISH.gill}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2.6" stroke-linecap="round"/>
<circle cx="42.5" cy="28.5" r="3.2" fill="#06323f"/><circle cx="43.5" cy="27.4" r="1.05" fill="#fff"/>
<circle cx="54.5" cy="18.5" r="4.3" fill="none" stroke="#fff" stroke-width="2"/><circle cx="48" cy="10" r="2.1" fill="#fff" fill-opacity=".92"/>
</g></svg>`;
}

mkdirSync('static/splash', { recursive: true });
const links = [];
for (const [w, h, r] of SIZES) {
	const W = w * r;
	const H = h * r;
	const name = `${W}x${H}.png`;
	await sharp(Buffer.from(splashSvg(W, H)), { density: 72 }).png({ compressionLevel: 9 }).toFile(`static/splash/${name}`);
	links.push(`<link rel="apple-touch-startup-image" href="/splash/${name}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)" />`);
}
console.log(links.join('\n'));

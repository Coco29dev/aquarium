// Génère les écrans de lancement iOS (static/splash/*.png) et les balises <link> à coller dans app.html.
// Usage : node scripts/make-splash.mjs
import sharp from 'sharp';
import { mkdirSync, readFileSync } from 'node:fs';

const SIZES = [
	[440, 956, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3],
	[390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [375, 667, 2]
];
const icon = readFileSync('static/apple-touch-icon-180x180.png');
mkdirSync('static/splash', { recursive: true });
const links = [];
for (const [w, h, r] of SIZES) {
	const W = w * r, H = h * r, s = Math.round(W * 0.26);
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b7f93"/><stop offset="1" stop-color="#06323f"/></linearGradient>
<radialGradient id="l" cx="0.3" cy="0" r="0.9"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/><rect width="${W}" height="${H}" fill="url(#l)"/>
<text x="${W / 2}" y="${H / 2 + s / 2 + W * 0.12}" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${Math.round(W * 0.075)}" fill="#fff" text-anchor="middle" letter-spacing="1">Biotope</text></svg>`;
	const round = await sharp(icon).resize(s, s).composite([{ input: Buffer.from(`<svg width="${s}" height="${s}"><rect width="${s}" height="${s}" rx="${s * 0.225}"/></svg>`), blend: 'dest-in' }]).png().toBuffer();
	const name = `${W}x${H}.png`;
	await sharp(Buffer.from(svg)).composite([{ input: round, left: Math.round((W - s) / 2), top: Math.round(H / 2 - s / 2 - W * 0.04) }]).png({ compressionLevel: 9 }).toFile(`static/splash/${name}`);
	links.push(`<link rel="apple-touch-startup-image" href="/splash/${name}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)" />`);
}
console.log(links.join('\n'));

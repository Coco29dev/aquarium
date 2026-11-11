<script lang="ts">
	import { ambient } from '$lib/motion/ambient';

	/**
	 * Surface de l'eau et caustiques : deux nappes de vaguelettes croisées qui dérivent en sens inverse
	 * et dessinent, là où elles se coupent, le réseau de lumière d'un fond de bassin. Un masque efface
	 * le motif vers le bas : il ne passe jamais sous les données.
	 * Props : on ('water' : traits clairs sur une eau colorée ; 'page' : traits teintés sur --bg),
	 * tone ('douce' | 'plantee' | 'mer' | 'recif' : taille et vitesse des nappes), layers (1 ou 2 ; une
	 * seule nappe pour les cartes de l'accueil, afin de tenir le budget d'animations), class.
	 * À poser en absolu derrière le contenu d'une carte, d'un en-tête ou d'une feuille.
	 * Sert : TankCard sans photo, Lagoon, accueil (bienvenue). Décor : aria-hidden, pas d'interaction.
	 */
	type Tone = 'douce' | 'plantee' | 'mer' | 'recif';
	let {
		on = 'water',
		tone = 'douce',
		layers = 2,
		class: cls = ''
	}: { on?: 'water' | 'page'; tone?: Tone; layers?: 1 | 2; class?: string } = $props();
	const uid = $props.id();
	// s : échelle des nappes, a et b : durée d'une dérive (s). Récif : serrées et vives ; mer : larges et lentes.
	const k = $derived({ douce: { s: 1, a: 26, b: 38 }, plantee: { s: 0.85, a: 30, b: 44 }, mer: { s: 1.5, a: 44, b: 62 }, recif: { s: 0.8, a: 16, b: 24 } }[tone]);
	const ink = $derived(on === 'water' ? 'var(--art-caustic, rgb(255 255 255 / .5))' : 'var(--art-caustic-page, rgb(10 115 133 / .12))');
</script>

<div class="caustics {cls}" use:ambient aria-hidden="true">
	<svg viewBox="0 0 360 240" preserveAspectRatio="xMidYMid slice">
		<defs>
			<pattern id="{uid}-w" width="80" height="22" patternUnits="userSpaceOnUse">
				<path d="M0 11C13 3 27 3 40 11S67 19 80 11" fill="none" stroke={ink} stroke-width="1.3" stroke-linecap="round" />
			</pattern>
			<linearGradient id="{uid}-f" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#fff" />
				<stop offset=".5" stop-color="#fff" stop-opacity=".4" />
				<stop offset=".85" stop-color="#fff" stop-opacity="0" />
			</linearGradient>
			<mask id="{uid}-m"><rect width="360" height="240" fill="url(#{uid}-f)" /></mask>
		</defs>
		<g mask="url(#{uid}-m)">
			<g transform="rotate(28 180 120) scale({k.s})">
				<rect class="ambient a" style="animation-duration: {k.a}s" x="-600" y="-600" width="1600" height="1600" fill="url(#{uid}-w)" />
			</g>
			{#if layers === 2}
				<g transform="rotate(-24 180 120) scale({k.s * 1.3})" opacity=".8">
					<rect class="ambient b" style="animation-duration: {k.b}s" x="-600" y="-600" width="1600" height="1600" fill="url(#{uid}-w)" />
				</g>
			{/if}
		</g>
	</svg>
</div>

<style>
	.caustics {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
	}
	svg {
		display: block;
		width: 100%;
		height: 100%;
	}
	.a {
		animation: drift-l linear infinite;
	}
	.b {
		animation: drift-r linear infinite;
	}
	/* Une période de nappe = 80 unités : la boucle est invisible. */
	@keyframes drift-l {
		to {
			transform: translateX(-80px);
		}
	}
	@keyframes drift-r {
		to {
			transform: translateX(80px);
		}
	}
</style>

<script lang="ts">
	import { ambient } from '$lib/motion/ambient';
	import Caustics from '$lib/art/Caustics.svelte';
	import { FISH, FROND } from '$lib/art/fish';

	// Vignette d'ambiance de la marque : eau lagon, rayons de lumière, caustiques, bulles et poisson corail
	// (le poisson de la marque, tête à droite : les bulles partent de sa bouche).
	// Décor pur (aria-hidden) ; les mouvements s'arrêtent si l'iPhone demande moins d'animations ou hors écran.
	// Boucles infinies : 1 nappe de caustiques + 1 poisson + 5 bulles.
	let { class: cls = '' }: { class?: string } = $props();
	const uid = $props.id();
	// left : % de la largeur ; s : diamètre ; d : retard ; t : durée
	const bubbles = [
		{ x: 66, s: 10, d: 0, t: 5.2 },
		{ x: 72, s: 16, d: 1.4, t: 6.4 },
		{ x: 62, s: 7, d: 0.6, t: 4.8 },
		{ x: 78, s: 12, d: 2.2, t: 6 },
		{ x: 69, s: 8, d: 3.1, t: 5.5 }
	];
</script>

<div
	class="rounded-hero relative isolate overflow-hidden shadow-[0_18px_44px_rgb(6_50_63/0.35)] {cls}"
	style="background: linear-gradient(180deg, #19b6c6 0%, #0b7f93 52%, #06323f 100%)"
	use:ambient
	aria-hidden="true"
>
	<div class="absolute inset-0 opacity-40" style="background: radial-gradient(ellipse at 28% 0%, #fff 0%, transparent 62%)"></div>
	<div class="absolute -top-4 left-[14%] h-[130%] w-10 rotate-[14deg] bg-white/10"></div>
	<div class="absolute -top-4 left-[44%] h-[130%] w-6 rotate-[14deg] bg-white/10"></div>
	<Caustics layers={1} class="opacity-45" />

	{#each bubbles as b (b.x)}
		<span
			class="ambient absolute bottom-[46%] rounded-full border-2 border-white/80"
			style="left: {b.x}%; width: {b.s}px; height: {b.s}px; animation: bubble-up {b.t}s ease-in {b.d}s infinite"
		></span>
	{/each}

	<svg viewBox={FISH.box} class="ambient absolute left-1/2 top-[26%] w-[52%] -translate-x-1/2" style="animation: bob 3.6s ease-in-out infinite">
		<defs>
			<linearGradient id="{uid}-coral" gradientUnits="userSpaceOnUse" x1="8" y1="12" x2="48" y2="54">
				<stop offset="0" stop-color="#ffc178" />
				<stop offset="1" stop-color="#ff6f61" />
			</linearGradient>
		</defs>
		<path d={FISH.tail} fill="url(#{uid}-coral)" stroke="url(#{uid}-coral)" stroke-width="3" stroke-linejoin="round" />
		<path d={FISH.dorsal} fill="#ff6f61" stroke="#ff6f61" stroke-width="2" stroke-linejoin="round" />
		<path d={FISH.body} fill="url(#{uid}-coral)" />
		<path d={FISH.gill} fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2.6" stroke-linecap="round" />
		<circle cx={FISH.eye.x} cy={FISH.eye.y} r={FISH.eye.r} fill="#06323f" />
		<circle cx={FISH.glint.x} cy={FISH.glint.y} r={FISH.glint.r} fill="#fff" />
	</svg>

	<svg viewBox="0 0 400 60" preserveAspectRatio="none" class="absolute inset-x-0 bottom-0 h-12 w-full">
		<path d="M0 30c60-26 120-26 200 0s140 26 200 0v30H0z" fill="#04222c" opacity=".6" />
	</svg>
	<svg viewBox="-24 -76 48 80" class="absolute bottom-0 left-[8%] h-24">
		<path d={FROND} fill="#5ee0b3" opacity=".85" />
	</svg>
</div>

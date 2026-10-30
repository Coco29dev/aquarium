<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Scène d'accueil : un morceau d'aquarium vivant. Le ciel suit l'heure (matin, jour, soir, nuit),
	 * deux nappes d'eau ondulent, des bulles montent, des silhouettes de poissons traversent lentement.
	 * Tout le mouvement est coupé pour qui préfère moins d'animations (classe .ambient).
	 */
	interface Props {
		/** Heure locale 0–23 ; défaut : maintenant. */
		hour?: number;
		children: Snippet;
		class?: string;
	}
	let { hour = new Date().getHours(), children, class: cls = '' }: Props = $props();

	const sky = $derived(
		hour >= 5 && hour < 11
			? 'linear-gradient(170deg, #8fdcff 0%, #3aa0f2 48%, #1c63c9 100%)'
			: hour >= 11 && hour < 17
				? 'linear-gradient(170deg, #4cc3f7 0%, #1f86e6 52%, #164ba8 100%)'
				: hour >= 17 && hour < 21
					? 'linear-gradient(170deg, #ffb27a 0%, #d2609e 38%, #5b4bc4 72%, #1f2f78 100%)'
					: 'linear-gradient(170deg, #24357a 0%, #131d4d 52%, #070b24 100%)'
	);
	const bubbles = [
		{ left: 8, size: 7, dur: 9, delay: 0 },
		{ left: 22, size: 5, dur: 11, delay: 3 },
		{ left: 38, size: 9, dur: 13, delay: 1.5 },
		{ left: 57, size: 6, dur: 10, delay: 5 },
		{ left: 73, size: 8, dur: 12, delay: 2.2 },
		{ left: 90, size: 5, dur: 9.5, delay: 6 }
	];
	const WAVE = 'M0 30 C 100 8 200 8 300 30 S 500 52 600 30 C 700 8 800 8 900 30 S 1100 52 1200 30 V80 H0 Z';
</script>

<div class="relative isolate overflow-hidden rounded-[32px] text-white {cls}" style="background: {sky}; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.3), 0 22px 40px -18px rgb(10 40 120 / 0.55)">
	<!-- Lumière du haut -->
	<div class="pointer-events-none absolute inset-0" style="background: radial-gradient(90% 60% at 15% 0%, rgb(255 255 255 / 0.28), transparent 60%)"></div>

	<!-- Poissons qui passent, très discrets -->
	<svg class="ambient pointer-events-none absolute left-0 top-[38%] h-5 w-9 opacity-[0.22]" style="animation: swim 46s linear infinite" viewBox="0 0 36 20" aria-hidden="true">
		<path fill="currentColor" d="M2 10c4-7 11-8 16-5 2 1 3 3 4.5 5 1-1.2 4-3.6 6-4.6v9.2c-2-1-5-3.4-6-4.6-1.5 2-2.500 4-4.500 5-5 3-12 2-16-5z" />
	</svg>
	<svg class="ambient pointer-events-none absolute left-0 top-[58%] h-3.5 w-6 opacity-[0.16]" style="animation: swim 70s linear infinite -30s" viewBox="0 0 36 20" aria-hidden="true">
		<path fill="currentColor" d="M2 10c4-7 11-8 16-5 2 1 3 3 4.5 5 1-1.2 4-3.6 6-4.6v9.2c-2-1-5-3.4-6-4.6-1.5 2-2.500 4-4.500 5-5 3-12 2-16-5z" />
	</svg>

	<!-- Bulles -->
	{#each bubbles as b (b.left)}
		<span
			class="ambient pointer-events-none absolute bottom-6 rounded-full border border-white/50 bg-white/15"
			style="left: {b.left}%; width: {b.size}px; height: {b.size}px; animation: bubble-up {b.dur}s ease-in {b.delay}s infinite"
		></span>
	{/each}

	<!-- Nappes d'eau -->
	<svg class="ambient pointer-events-none absolute -bottom-px left-0 h-16 w-[200%]" style="animation: wave-x 18s linear infinite" viewBox="0 0 1200 80" preserveAspectRatio="none" aria-hidden="true">
		<path d={WAVE} fill="rgb(255 255 255 / 0.12)" />
	</svg>
	<svg class="ambient pointer-events-none absolute -bottom-px left-0 h-12 w-[200%]" style="animation: wave-x 11s linear infinite reverse" viewBox="0 0 1200 80" preserveAspectRatio="none" aria-hidden="true">
		<path d={WAVE} fill="rgb(255 255 255 / 0.16)" />
	</svg>

	<div class="relative z-10">{@render children()}</div>
</div>

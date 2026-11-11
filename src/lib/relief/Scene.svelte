<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ambient } from '$lib/motion/ambient';
	import { FISH } from '$lib/art/fish';

	/**
	 * Scène d'accueil : un morceau d'aquarium vivant. Le ciel suit l'heure en continu (matin, jour, soir, nuit
	 * se fondent l'un dans l'autre minute par minute), deux nappes d'eau ondulent, quelques bulles montent
	 * (plus lentement la nuit), la silhouette d'un poisson traverse très lentement, tête en avant.
	 * Le mouvement dominant est celui des nappes ; le reste est à peine visible. Boucles infinies : 2 nappes,
	 * 1 poisson, 4 bulles. Tout est coupé pour qui préfère moins d'animations (classe .ambient), hors écran
	 * (action ambient) et par le réglage « Ambiance animée ».
	 */
	interface Props {
		/** Heure locale, fractionnaire possible (17.5 = 17 h 30) ; défaut : maintenant, remise à jour chaque minute. */
		hour?: number;
		children: Snippet;
		class?: string;
	}
	let { hour, children, class: cls = '' }: Props = $props();

	const fractionalNow = () => {
		const d = new Date();
		return d.getHours() + d.getMinutes() / 60;
	};
	let now = $state(fractionalNow());
	$effect(() => {
		if (hour !== undefined) return;
		now = fractionalNow();
		const id = setInterval(() => (now = fractionalNow()), 60_000);
		return () => clearInterval(id);
	});
	const h = $derived(((hour ?? now) % 24 + 24) % 24);

	// Quatre couleurs par ciel, placées à 0, 38, 72 et 100 % du dégradé.
	const NIGHT = ['#14505f', '#0e3b49', '#07252f', '#03141b'];
	const MORNING = ['#a4eef0', '#4ec2cf', '#20a0b0', '#0b7f93'];
	const DAY = ['#4fd0dc', '#27aec1', '#108699', '#0a6277'];
	const EVENING = ['#ffb27a', '#e8647a', '#6a4fa8', '#0f3a4d'];
	// Teintes de passage, posées à la main : un simple mélange de deux ciels très différents (turquoise et orangé,
	// jour et nuit) donnerait un gris boueux au milieu.
	const AUBE = ['#b9d9d8', '#6fb2bf', '#2f7f93', '#0d4658'];
	const GOLDEN = ['#c7e3cf', '#ecae8e', '#b27e9c', '#17475b'];
	const DUSK = ['#7a4f93', '#4a4a8c', '#1f4262', '#082b36'];
	// Chaque ciel est pleinement lui-même au milieu de sa plage (matin 8 h, jour 14 h, soir 19 h, nuit 23 h → 5 h).
	const KEYS: { h: number; sky: string[] }[] = [
		{ h: 0, sky: NIGHT },
		{ h: 5, sky: NIGHT },
		{ h: 6.5, sky: AUBE },
		{ h: 8, sky: MORNING },
		{ h: 14, sky: DAY },
		{ h: 17, sky: GOLDEN },
		{ h: 19, sky: EVENING },
		{ h: 21.5, sky: DUSK },
		{ h: 23, sky: NIGHT },
		{ h: 24, sky: NIGHT }
	];
	const POSITIONS = [0, 38, 72, 100];

	/** Dégradé du ciel à l'heure h : mélange dans l'espace OKLab des deux ciels voisins. */
	function skyAt(hour: number): string {
		let i = KEYS.findIndex((k, n) => hour >= k.h && hour < (KEYS[n + 1]?.h ?? 25));
		if (i < 0) i = KEYS.length - 2;
		const a = KEYS[i];
		const b = KEYS[i + 1] ?? a;
		const t = b.h === a.h ? 0 : Math.min(1, Math.max(0, (hour - a.h) / (b.h - a.h)));
		const mixPct = Math.round(t * 100);
		const stops = a.sky.map((c, n) => {
			const to = b.sky[n];
			const color = c === to || mixPct === 0 ? c : mixPct === 100 ? to : `color-mix(in oklab, ${c} ${100 - mixPct}%, ${to})`;
			return `${color} ${POSITIONS[n]}%`;
		});
		return `linear-gradient(170deg, ${stops.join(', ')})`;
	}
	const sky = $derived(skyAt(h));

	/** 0 en plein jour, 1 en pleine nuit : les bulles ralentissent avec la nuit. */
	const night = $derived(h <= 5 || h >= 23 ? 1 : h < 8 ? (8 - h) / 3 : h < 19 ? 0 : (h - 19) / 4);
	const slow = $derived(1 + 0.8 * night);

	const bubbles = [
		{ left: 12, size: 7, dur: 10, delay: 0 },
		{ left: 34, size: 9, dur: 13, delay: 1.5 },
		{ left: 62, size: 6, dur: 11, delay: 5 },
		{ left: 86, size: 5, dur: 12, delay: 2.2 }
	];
	const WAVE = 'M0 30 C 100 8 200 8 300 30 S 500 52 600 30 C 700 8 800 8 900 30 S 1100 52 1200 30 V80 H0 Z';
</script>

<div class="vivid rounded-hero relative isolate overflow-hidden text-white {cls}" style="background: {sky}; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.3), 0 22px 40px -18px rgb(6 50 63 / 0.55)" use:ambient>
	<!-- Lumière du haut -->
	<div class="pointer-events-none absolute inset-0" style="background: radial-gradient(90% 60% at 15% 0%, rgb(255 255 255 / 0.28), transparent 60%)"></div>

	<!-- Un poisson qui passe, très discret : sa tête est à droite, il avance vers la droite -->
	<svg class="ambient pointer-events-none absolute left-0 top-[38%] h-11 w-12 opacity-[0.2]" style="animation: swim 52s linear infinite" viewBox={FISH.box} aria-hidden="true">
		<path fill="currentColor" d={FISH.outline} />
	</svg>

	<!-- Bulles -->
	{#each bubbles as b (b.left)}
		<span
			class="ambient pointer-events-none absolute bottom-6 rounded-full border border-white/50 bg-white/15"
			style="left: {b.left}%; width: {b.size}px; height: {b.size}px; animation: bubble-up {(b.dur * slow).toFixed(1)}s ease-in {b.delay}s infinite"
		></span>
	{/each}

	<!-- Nappes d'eau : le mouvement dominant -->
	<svg class="ambient pointer-events-none absolute -bottom-px left-0 h-16 w-[200%]" style="animation: wave-x 18s linear infinite" viewBox="0 0 1200 80" preserveAspectRatio="none" aria-hidden="true">
		<path d={WAVE} fill="rgb(255 255 255 / 0.12)" />
	</svg>
	<svg class="ambient pointer-events-none absolute -bottom-px left-0 h-12 w-[200%]" style="animation: wave-x 11s linear infinite reverse" viewBox="0 0 1200 80" preserveAspectRatio="none" aria-hidden="true">
		<path d={WAVE} fill="rgb(255 255 255 / 0.16)" />
	</svg>

	<div class="relative z-10">{@render children()}</div>
</div>

<script lang="ts">
	import { onMount } from 'svelte';

	/**
	 * Anneaux concentriques façon Forme : le premier est l'anneau extérieur.
	 * `ratio` va de 0 à 1 (null = pas de donnée, anneau vide). Le remplissage s'anime à l'apparition ;
	 * prefers-reduced-motion est géré globalement (transitions réduites à 1 ms).
	 */
	interface Ring {
		ratio: number | null;
		/** Variable CSS de couleur, ex. 'var(--red)'. */
		color: string;
	}
	interface Props {
		rings: Ring[];
		size?: number;
		stroke?: number;
		gap?: number;
		label?: string;
	}
	let { rings, size = 108, stroke = 13, gap = 3, label = 'Anneaux d’activité' }: Props = $props();

	let ready = $state(false);
	onMount(() => {
		// Deux images d'attente : le premier rendu doit exister vide pour que la transition ait lieu.
		let second = 0;
		const first = requestAnimationFrame(() => (second = requestAnimationFrame(() => (ready = true))));
		return () => {
			cancelAnimationFrame(first);
			cancelAnimationFrame(second);
		};
	});

	const geo = $derived(
		rings.map((r, i) => {
			const radius = size / 2 - stroke / 2 - i * (stroke + gap);
			const circumference = 2 * Math.PI * radius;
			const ratio = r.ratio == null ? 0 : Math.min(1, Math.max(0, r.ratio));
			return { radius, circumference, ratio, color: r.color };
		})
	);
	const c = $derived(size / 2);
</script>

<svg width={size} height={size} viewBox="0 0 {size} {size}" role="img" aria-label={label} class="block shrink-0">
	{#each geo as g, i (i)}
		<circle cx={c} cy={c} r={g.radius} fill="none" stroke={g.color} stroke-opacity="0.2" stroke-width={stroke} />
		<circle
			cx={c}
			cy={c}
			r={g.radius}
			fill="none"
			stroke={g.color}
			stroke-width={stroke}
			stroke-linecap="round"
			stroke-dasharray={g.circumference}
			stroke-dashoffset={ready ? g.circumference * (1 - g.ratio) : g.circumference}
			transform="rotate(-90 {c} {c})"
			style="transition: stroke-dashoffset 900ms cubic-bezier(0.3, 0.8, 0.3, 1) {i * 120}ms; opacity: {g.ratio > 0 ? 1 : 0}"
		/>
	{/each}
</svg>

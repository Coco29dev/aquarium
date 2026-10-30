
<script lang="ts">
	import Tile from './Tile.svelte';
	import type { IconName } from '$lib/components/Icon.svelte';
	import { LEVEL_NAMES, volumeLabel, type Fit, type Idea } from '$lib/domain/ideas';

	/** Carte d'une idée de peuplement : titre, milieu, fourchette de volume, difficulté. */
	interface Props {
		idea: Idea;
		href: string;
		fit?: Fit | null;
		/** Variante haute pour un carrousel. */
		tall?: boolean;
		class?: string;
	}
	let { idea, href, fit = null, tall = false, class: cls = '' }: Props = $props();

	const salt = $derived(idea.water === 'mer' || idea.water === 'recif');
	const tone = $derived(
		salt ? 'var(--cyan)' : idea.tags.includes('eaux noires') ? 'var(--brown)' : idea.tags.includes('cichlidés') ? 'var(--orange)' : idea.water === 'plantee' ? 'var(--green)' : 'var(--teal)'
	);
	const mark = $derived<IconName>(salt ? 'coral' : idea.tags.includes('plantes') ? 'leaf' : 'fish');
	const animals = $derived(idea.stock.filter(([, , role]) => role !== 'corail').length);
</script>

<Tile {href} {tone} variant={tall ? 'solid' : 'soft'} {mark} class="{tall ? 'flex min-h-[13rem] w-[72%] max-w-72 shrink-0 snap-start flex-col justify-end' : ''} {cls}">
	<p class="caption1 font-semibold uppercase tracking-wide {tall ? 'text-white/80' : 'text-label2'}">{idea.region}</p>
	<p class="headline mt-0.5 {tall ? '' : ''}">{idea.title}</p>
	<p class="footnote mt-1 line-clamp-2 {tall ? 'text-white/85' : 'text-label2'}">{idea.summary}</p>
	<p class="caption1 mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold {tall ? 'text-white/90' : ''}" style={tall ? '' : `color: ${tone}`}>
		<span>{volumeLabel(idea)}</span>
		<span aria-hidden="true">·</span>
		<span>{LEVEL_NAMES[idea.level]}</span>
		<span aria-hidden="true">·</span>
		<span>{animals} espèce{animals > 1 ? 's' : ''}</span>
		{#if fit === 'proche'}<span class="rounded-full bg-black/10 px-1.5 py-px">volume voisin</span>{/if}
	</p>
</Tile>

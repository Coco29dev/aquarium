<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';

	/**
	 * Tuile de grille : carte colorée ('solid'), à fond teinté ('soft') ou claire ('plain'),
	 * avec une grande icône en filigrane. Lien, bouton, ou simple conteneur.
	 */
	interface Props {
		href?: string;
		onclick?: () => void;
		/** Variable CSS de teinte, ex. 'var(--orange)'. */
		tone?: string;
		variant?: 'solid' | 'soft' | 'plain';
		/** Icône en filigrane. */
		mark?: IconName;
		label?: string;
		class?: string;
		children: Snippet;
	}
	let { href, onclick, tone = 'var(--blue)', variant = 'soft', mark, label, class: cls = '', children }: Props = $props();
	const surface = $derived(variant === 'solid' ? 'tone-card' : variant === 'soft' ? 'tone-soft' : 'raised');
</script>

{#snippet inner()}
	{#if mark}
		<span class="pointer-events-none absolute -bottom-3 -right-3 rotate-[-12deg] opacity-[0.16]" style="--cut: transparent; color: {variant === 'solid' ? '#fff' : tone}"><Icon name={mark} size={104} filled weight={1.4} /></span>
	{/if}
	<div class="relative">{@render children()}</div>
{/snippet}

{#if href}
	<a {href} aria-label={label} class="pressable relative block overflow-hidden rounded-[24px] p-4 {surface} {cls}" style="--tone: {tone}">{@render inner()}</a>
{:else if onclick}
	<button type="button" {onclick} aria-label={label} class="pressable relative block w-full overflow-hidden rounded-[24px] p-4 text-left {surface} {cls}" style="--tone: {tone}">{@render inner()}</button>
{:else}
	<div class="relative overflow-hidden rounded-[24px] p-4 {surface} {cls}" style="--tone: {tone}">{@render inner()}</div>
{/if}

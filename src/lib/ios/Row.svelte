<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';

	/**
	 * Ligne de liste iOS : pastille d'icône carrée colorée (style Réglages), titre, sous-titre,
	 * valeur à droite en gris, chevron de navigation. À placer dans un <Section>.
	 */
	interface Props {
		title?: string;
		subtitle?: string;
		value?: string;
		href?: string;
		onclick?: () => void;
		icon?: IconName;
		/** Couleur de la pastille d'icône (ex. 'var(--blue)'). Sans elle, icône seule en couleur d'accent. */
		iconColor?: string;
		chevron?: boolean;
		destructive?: boolean;
		/** Titre en couleur d'accent (ligne-bouton). */
		action?: boolean;
		leading?: Snippet;
		trailing?: Snippet;
		children?: Snippet;
		disabled?: boolean;
		/** Sans <li> englobant : pour placer la ligne dans un SwipeRow (qui fournit le <li>). */
		bare?: boolean;
	}
	let {
		title,
		subtitle,
		value,
		href,
		onclick,
		icon,
		iconColor,
		chevron,
		destructive = false,
		action = false,
		leading,
		trailing,
		children,
		disabled = false,
		bare = false
	}: Props = $props();

	const showChevron = $derived(chevron ?? Boolean(href));
	const interactive = $derived(Boolean(href || onclick) && !disabled);
</script>

{#snippet inner()}
	{#if leading}
		{@render leading()}
	{:else if icon}
		{#if iconColor}
			<span class="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px] text-white" style="background: {iconColor}; --cut: {iconColor}">
				<Icon name={icon} size={19} filled weight={2} />
			</span>
		{:else}
			<span class="grid w-[30px] shrink-0 place-items-center text-tint"><Icon name={icon} size={24} /></span>
		{/if}
	{/if}
	<div class="row-body flex min-h-11 min-w-0 flex-1 items-center gap-3 py-2.5 pr-4">
		<div class="min-w-0 flex-1 text-left">
			{#if children}
				{@render children()}
			{:else}
				<p class="body truncate {destructive ? 'text-red' : action ? 'text-tint' : ''}">{title}</p>
				{#if subtitle}<p class="subhead truncate text-label2">{subtitle}</p>{/if}
			{/if}
		</div>
		{#if value}<span class="body shrink-0 text-label2">{value}</span>{/if}
		{#if trailing}{@render trailing()}{/if}
		{#if showChevron}<span class="-mr-1 shrink-0 text-label3"><Icon name="next" size={18} weight={2.4} /></span>{/if}
	</div>
{/snippet}

{#snippet body()}
	{#if href && !disabled}
		<a {href} class="tappable flex items-center gap-3 pl-4">{@render inner()}</a>
	{:else if onclick}
		<button type="button" {onclick} {disabled} class="flex w-full items-center gap-3 pl-4 disabled:opacity-40 {interactive ? 'tappable' : ''}">{@render inner()}</button>
	{:else}
		<div class="flex items-center gap-3 pl-4">{@render inner()}</div>
	{/if}
{/snippet}

{#if bare}
	{@render body()}
{:else}
	<li>{@render body()}</li>
{/if}

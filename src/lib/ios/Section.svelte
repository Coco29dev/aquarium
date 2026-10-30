<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Section de liste groupée en encart. En-tête discret (style Réglages) ou en titre gras
	 * (style Santé, avec lien « Afficher tout » éventuel), pied de section explicatif.
	 */
	interface Props {
		header?: string;
		footer?: string;
		/** 'title' : en-tête en gras façon Santé. */
		variant?: 'list' | 'title';
		/** Lien à droite de l'en-tête (variant title). */
		more?: { href: string; label: string };
		/** false : contenu libre, sans encart blanc. */
		inset?: boolean;
		children: Snippet;
		class?: string;
	}
	let { header, footer, variant = 'list', more, inset = true, children, class: cls = '' }: Props = $props();
</script>

<section class="mb-8 {cls}">
	{#if header}
		{#if variant === 'title'}
			<div class="mb-2 flex items-baseline justify-between px-1">
				<h2 class="title3 font-bold">{header}</h2>
				{#if more}<a href={more.href} class="btn-plain subhead">{more.label}</a>{/if}
			</div>
		{:else}
			<h2 class="footnote px-4 pb-1.5 uppercase text-label2">{header}</h2>
		{/if}
	{/if}
	{#if inset}
		<ul class="group ios-list">{@render children()}</ul>
	{:else}
		{@render children()}
	{/if}
	{#if footer}<p class="footnote px-4 pt-1.5 text-label2">{footer}</p>{/if}
</section>

<style>
	/* Filet entre deux lignes, aligné sur le texte (après l'icône éventuelle). */
	.ios-list :global(> li + li .row-body) {
		box-shadow: inset 0 0.5px 0 var(--sep);
	}
</style>

<script lang="ts">
	import type { Snippet } from 'svelte';

	/** Rangée à défilement horizontal avec accroche (snap), débordant sur les marges de l'écran. */
	interface Props {
		header?: string;
		more?: { href: string; label: string };
		children: Snippet;
		class?: string;
	}
	let { header, more, children, class: cls = '' }: Props = $props();
</script>

<section class="mb-5 {cls}">
	{#if header}
		<div class="mb-2.5 flex items-baseline justify-between px-1">
			<h2 class="title3 font-bold">{header}</h2>
			{#if more}<a href={more.href} class="btn-plain subhead">{more.label}</a>{/if}
		</div>
	{/if}
	<div class="-mx-4 flex snap-x snap-mandatory scroll-px-4 items-stretch gap-3 overflow-x-auto px-4 pb-9 pt-1" style="scrollbar-width: none">
		{@render children()}
	</div>
</section>

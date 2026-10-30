<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	// En-tête d'écran : retour éventuel, petite ligne de contexte, grand titre, action à droite.
	interface Props {
		title: string;
		kicker?: string;
		back?: string;
		backLabel?: string;
		action?: Snippet;
	}
	let { title, kicker, back, backLabel = 'Retour', action }: Props = $props();
</script>

<header class="mb-6 flex flex-col gap-3">
	{#if back}
		<a href={back} class="-ml-1 flex w-fit items-center gap-1 text-sm font-bold text-muted">
			<Icon name="back" size={18} />{backLabel}
		</a>
	{/if}
	<div class="flex items-end justify-between gap-3">
		<div class="min-w-0">
			{#if kicker}<p class="num mb-1.5 text-xs uppercase tracking-wider text-muted">{kicker}</p>{/if}
			<h1 class="display text-[2.15rem] break-words">{title}</h1>
		</div>
		{#if action}<div class="shrink-0">{@render action()}</div>{/if}
	</div>
</header>

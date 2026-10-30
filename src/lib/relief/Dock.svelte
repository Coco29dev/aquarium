<script lang="ts">
	import Icon, { type IconName } from '$lib/components/Icon.svelte';

	/** Raccourcis ronds façon tiroir d'actions : une pastille dégradée et son libellé. */
	interface Item {
		href: string;
		label: string;
		icon: IconName;
		tone: string;
	}
	let { items, class: cls = '' }: { items: Item[]; class?: string } = $props();
</script>

<nav class="lifted flex justify-between gap-1 px-3 py-3 {cls}" aria-label="Raccourcis">
	{#each items as item (item.href + item.label)}
		<a href={item.href} class="pressable flex w-[4.4rem] min-w-0 flex-col items-center gap-1.5">
			<span class="tone-card grid h-12 w-12 place-items-center rounded-[18px]" style="--tone: {item.tone}; --cut: {item.tone}">
				<Icon name={item.icon} size={24} filled weight={1.8} />
			</span>
			<span class="caption1 max-w-full truncate font-semibold">{item.label}</span>
		</a>
	{/each}
</nav>

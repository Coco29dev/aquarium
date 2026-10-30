<script lang="ts">
	// Indicateur d'activité iOS : huit rayons gris. progress (0 → 1) les fait apparaître un à un
	// pendant qu'on tire ; spinning les fait tourner.
	let { progress = 1, spinning = false, size = 26 }: { progress?: number; spinning?: boolean; size?: number } = $props();
	const rays = Array.from({ length: 8 }, (_, i) => i);
</script>

<svg width={size} height={size} viewBox="0 0 26 26" class={spinning ? 'spin' : ''} aria-hidden="true">
	{#each rays as i (i)}
		<line
			x1="13"
			y1="3"
			x2="13"
			y2="8"
			stroke="var(--label2)"
			stroke-width="2.6"
			stroke-linecap="round"
			transform="rotate({i * 45} 13 13)"
			opacity={spinning ? 1 - i * 0.1 : progress * 8 > i ? 1 - i * 0.07 : 0}
		/>
	{/each}
</svg>

<style>
	.spin {
		animation: ios-spin 0.9s steps(8) infinite;
	}
	@keyframes ios-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>

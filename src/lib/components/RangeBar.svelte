<script lang="ts">
	// Règle graduée : plage acceptable en vert, curseur d'encre sur la dernière valeur.
	interface Props {
		value: number | null;
		min: number | null;
		max: number | null;
	}
	let { value, min, max }: Props = $props();

	const geo = $derived.by(() => {
		if (min == null || max == null || max <= min) return null;
		const span = max - min;
		// La règle déborde d'un tiers de plage de chaque côté pour montrer le hors plage.
		const lo = min - span / 3;
		const hi = max + span / 3;
		const pos = (v: number) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
		return { start: pos(min), end: pos(max), at: value == null ? null : pos(value) };
	});
</script>

{#if geo}
	<div class="relative h-2.5 rounded-full border-[1.5px] border-edge bg-surface2" aria-hidden="true">
		<div class="absolute inset-y-0 bg-ok/35" style="left: {geo.start}%; width: {geo.end - geo.start}%"></div>
		{#if geo.at != null}
			<div
				class="absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-surface bg-ink"
				style="left: {geo.at}%"
			></div>
		{/if}
	</div>
{/if}

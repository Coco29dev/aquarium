<script lang="ts">
	import Icon, { type IconName } from './Icon.svelte';
	import type { Species, SpeciesKind } from '$lib/types';

	// Vignette d'espèce (bordure fournie par l'appelant) ; sans photo (ou si elle ne charge pas), un aplat illustré.
	interface Props {
		species: Pick<Species, 'id' | 'kind' | 'hasPhoto' | 'salt' | 'fresh'>;
		alt?: string;
		class?: string;
		iconSize?: number;
	}
	let { species, alt = '', class: cls = '', iconSize = 28 }: Props = $props();

	let failed = $state(false);
	const ICON: Record<SpeciesKind, IconName> = {
		poisson: 'fish',
		corail: 'coral',
		invertebre: 'bacs',
		plante: 'leaf',
		autre: 'drop'
	};
	const tone = $derived(species.kind === 'plante' ? 'var(--t-plantee)' : species.salt && !species.fresh ? 'var(--t-mer)' : 'var(--t-douce)');
</script>

<div class="relative overflow-hidden border-edge {cls}" style="background: {tone}">
	{#if species.hasPhoto && !failed}
		<img
			src="/api/species/{species.id}/photo"
			{alt}
			loading="lazy"
			class="absolute inset-0 h-full w-full object-cover"
			onerror={() => (failed = true)}
		/>
	{:else}
		<div class="absolute inset-0 grid place-items-center opacity-70">
			<Icon name={ICON[species.kind]} size={iconSize} />
		</div>
	{/if}
</div>

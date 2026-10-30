<script lang="ts">
	import Icon, { type IconName } from './Icon.svelte';
	import type { Species, SpeciesKind } from '$lib/types';

	// Vignette d'espèce (arrondi fourni par l'appelant) ; sans photo, ou si elle ne charge pas,
	// un dégradé de couleur système avec une icône blanche, comme une pochette par défaut.
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
	const tone = $derived(
		species.kind === 'plante'
			? ['var(--mint)', 'var(--green)']
			: species.kind === 'corail'
				? ['var(--orange)', 'var(--pink)']
				: species.salt && !species.fresh
					? ['var(--cyan)', 'var(--indigo)']
					: ['var(--cyan)', 'var(--blue)']
	);
</script>

<div class="relative overflow-hidden {cls}" style="background: linear-gradient(160deg, {tone[0]}, {tone[1]})">
	{#if species.hasPhoto && !failed}
		<img
			src="/api/species/{species.id}/photo"
			{alt}
			loading="lazy"
			class="absolute inset-0 h-full w-full object-cover"
			onerror={() => (failed = true)}
		/>
	{:else}
		<div class="absolute inset-0 grid place-items-center text-white/90" style="--cut: transparent">
			<Icon name={ICON[species.kind]} size={iconSize} weight={1.6} />
		</div>
	{/if}
</div>

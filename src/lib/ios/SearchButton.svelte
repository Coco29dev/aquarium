<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';

	// Bouton rond de verre avec loupe, ouvre la recherche globale (à placer dans la barre de navigation).
	let { href = '/recherche', label = 'Rechercher' }: { href?: string; label?: string } = $props();
</script>

<a {href} class="glass pressable grid h-10 w-10 place-items-center rounded-full text-label" aria-label={label}>
	<Icon name="search" size={20} weight={2.2} />
</a>

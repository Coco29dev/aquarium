<script lang="ts">
	import Loader from '$lib/art/Loader.svelte';

	// Indicateur d'activité de Biotope : un poisson corail fait le tour d'un anneau d'eau (voir art/Loader).
	// progress (0 → 1) le fait avancer sur l'anneau pendant qu'on tire ; spinning le fait nager en boucle.
	let { progress = 1, spinning = false, size = 26 }: { progress?: number; spinning?: boolean; size?: number } = $props();
</script>

<Loader {progress} {spinning} {size} />

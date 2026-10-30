<script lang="ts">
	import { store } from '$lib/client/store.svelte';
	import { WATER_TYPE_LABELS } from '$lib/types';
</script>

<svelte:head><title>Aquariums · Bulle</title></svelte:head>

<h1 class="mb-6 text-2xl font-semibold">Aquariums</h1>

<ul class="mb-6 flex flex-col gap-3">
	{#each store.view?.aquariums ?? [] as aquarium (aquarium.id)}
		<li>
			<a href="/aquariums/{aquarium.id}" class="block card p-4 active:bg-surface2">
				<p class="font-medium">{aquarium.name}</p>
				<p class="text-sm text-muted">
					{WATER_TYPE_LABELS[aquarium.waterType]}{aquarium.volumeL ? ` · ${aquarium.volumeL} L` : ''}
				</p>
			</a>
		</li>
	{/each}
</ul>

<a href="/especes" class="mb-3 block card px-4 py-3 text-center active:bg-surface2">Base d'espèces</a>

<a href="/aquariums/nouveau" class="block rounded-lg btn-primary px-4 py-3 text-center font-medium">
	Ajouter un aquarium
</a>

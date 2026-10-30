<script lang="ts">
	import { store } from '$lib/client/store.svelte';
	import { WATER_TYPE_LABELS } from '$lib/types';
</script>

<svelte:head><title>Aquariums · Aquarium</title></svelte:head>

<h1 class="mb-6 text-2xl font-semibold">Aquariums</h1>

<ul class="mb-6 flex flex-col gap-3">
	{#each store.view?.aquariums ?? [] as aquarium (aquarium.id)}
		<li>
			<a href="/aquariums/{aquarium.id}" class="block rounded-lg bg-slate-900 p-4 active:bg-slate-800">
				<p class="font-medium">{aquarium.name}</p>
				<p class="text-sm text-slate-400">
					{WATER_TYPE_LABELS[aquarium.waterType]}{aquarium.volumeL ? ` · ${aquarium.volumeL} L` : ''}
				</p>
			</a>
		</li>
	{/each}
</ul>

<a href="/especes" class="mb-3 block rounded-lg bg-slate-900 px-4 py-3 text-center active:bg-slate-800">Base d'espèces</a>

<a href="/aquariums/nouveau" class="block rounded-lg bg-cyan-700 px-4 py-3 text-center font-medium active:bg-cyan-800">
	Ajouter un aquarium
</a>

<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Segmented from '$lib/ios/Segmented.svelte';
	import IdeaTile from '$lib/relief/IdeaTile.svelte';
	import { IDEAS } from '$lib/content/ideas';
	import { VOLUME_CLASSES, fitOf, ideasFor, volumeClassOf } from '$lib/domain/ideas';
	import type { WaterType } from '$lib/types';

	type Family = 'douce' | 'mer' | 'recif';

	// Contexte : un bac (?bac=ID), ou un volume saisi à la main (?l=150).
	const tankId = $derived(Number(page.url.searchParams.get('bac')) || null);
	const tank = $derived(tankId ? store.view?.aquariums.find((a) => a.id === tankId) : undefined);

	let family = $state<Family>('douce');
	let volumeText = $state('');
	let seeded = false;

	onMount(() => {
		const l = Number(page.url.searchParams.get('l'));
		if (l > 0) volumeText = String(l);
	});

	// Reprend le volume et le type d'eau du bac quand le cache local est prêt.
	$effect(() => {
		if (seeded || !tank) return;
		seeded = true;
		if (tank.volumeL) volumeText = String(tank.volumeL);
		family = tank.waterType === 'recif' ? 'recif' : tank.waterType === 'mer' ? 'mer' : 'douce';
	});

	const volume = $derived.by(() => {
		const n = Number(volumeText.replace(',', '.'));
		return Number.isFinite(n) && n >= 5 && n <= 20000 ? Math.round(n) : null;
	});
	const water = $derived<WaterType>(family === 'douce' ? 'plantee' : family);
	const suggestions = $derived(volume ? ideasFor(IDEAS, volume, water) : []);
	const all = $derived(ideasFor(IDEAS, null, water));
	const grouped = $derived(
		VOLUME_CLASSES.map((c) => ({ c, items: all.filter((i) => volumeClassOf(Math.sqrt(i.volume[0] * i.volume[1])).id === c.id) })).filter((g) => g.items.length)
	);
	const query = (idea: { slug: string }) => `/encyclopedie/idees/${idea.slug}?${new URLSearchParams({ ...(tankId ? { bac: String(tankId) } : {}), ...(volume ? { l: String(volume) } : {}) })}`;
</script>

<svelte:head><title>Idées de peuplement · Encyclopédie</title></svelte:head>

<NavBar title="Idées de peuplement" back={{ href: '/encyclopedie', label: 'Encyclopédie' }} />

<p class="body mb-4 px-1 text-label2">
	Pas d’idée pour tes poissons ? Choisis ton volume : je propose des biotopes qui s’y plaisent, avec les espèces et les quantités adaptées.
	{#if tank}Pour <span class="font-semibold text-label">{tank.name}</span>.{/if}
</p>

<section class="raised mb-6 p-4" aria-label="Mon aquarium">
	<div class="mb-3">
		<Segmented
			label="Type d’eau"
			bind:value={family}
			options={[
				{ value: 'douce', label: 'Eau douce' },
				{ value: 'mer', label: 'Mer' },
				{ value: 'recif', label: 'Récif' }
			]}
		/>
	</div>
	<label class="flex items-center gap-3">
		<span class="body w-24 shrink-0 font-semibold">Volume</span>
		<input
			class="body min-h-11 min-w-0 flex-1 rounded-[12px] bg-fill3 px-3 text-right outline-none focus:ring-2 focus:ring-blue"
			inputmode="numeric"
			placeholder="150"
			bind:value={volumeText}
			aria-label="Volume en litres"
		/>
		<span class="body text-label2">L</span>
	</label>
	<div class="mt-3 flex flex-wrap gap-2">
		{#each [30, 60, 100, 150, 200, 300, 500] as v (v)}
			<button
				type="button"
				class="footnote pressable rounded-full px-3 py-1.5 font-semibold {volume === v ? 'bg-blue text-white' : 'bg-fill3'}"
				onclick={() => (volumeText = String(v))}
			>{v} L</button>
		{/each}
	</div>
</section>

{#if volume}
	<section class="mb-8" aria-label="Idées pour {volume} litres">
		<h2 class="title3 mb-2.5 px-1 font-bold">
			{suggestions.length ? `${suggestions.length} idée${suggestions.length > 1 ? 's' : ''} pour ${volume} L` : `Rien de précis pour ${volume} L`}
		</h2>
		{#if suggestions.length}
			<div class="grid gap-3 sm:grid-cols-2">
				{#each suggestions as idea, i (idea.slug)}
					<IdeaTile {idea} href={query(idea)} fit={fitOf(idea, volume)} class="reveal {i === 0 ? 'sm:col-span-2' : ''}" />
				{/each}
			</div>
			<p class="footnote mt-3 px-1 text-label2">
				Les fourchettes sont indicatives : « volume voisin » signale une idée un peu en dehors de la plage idéale, avec quantités ajustées.
			</p>
		{:else}
			<p class="subhead px-1 text-label2">Essaie un volume un peu différent ou parcours tout le catalogue ci-dessous.</p>
		{/if}
	</section>
{/if}

<section class="mb-8" aria-label="Toutes les idées">
	<h2 class="title3 mb-2.5 px-1 font-bold">{volume ? 'Toutes les idées' : 'Du nano au très grand bac'}</h2>
	{#each grouped as { c, items } (c.id)}
		<div class="mb-6">
			<h3 class="subhead mb-2 px-1 font-semibold uppercase text-label2">{c.label} <span class="font-normal normal-case">· {c.range}</span></h3>
			<div class="grid gap-3 sm:grid-cols-2">
				{#each items as idea (idea.slug)}
					<IdeaTile {idea} href={query(idea)} />
				{/each}
			</div>
		</div>
	{/each}
	<p class="footnote mt-2 px-1 text-label2">{all.length} idées en {family === 'douce' ? 'eau douce' : family === 'mer' ? 'eau de mer' : 'récif'}. Tout est rédigé par Claude et à vérifier avant l’achat.</p>
</section>

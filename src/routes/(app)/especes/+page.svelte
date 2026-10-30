<script lang="ts">
	import { onMount } from 'svelte';
	import SpeciesForm from '$lib/components/SpeciesForm.svelte';
	import SpeciesPicker from '$lib/components/SpeciesPicker.svelte';
	import { api } from '$lib/client/api';
	import { speciesName } from '$lib/domain/species';
	import { KIND_LABELS, type Species } from '$lib/types';

	let selected = $state<Species | null>(null);
	let adding = $state(false);
	let mine = $state<Species[]>([]);
	let message = $state('');

	async function loadMine() {
		try {
			mine = (await api<Species[]>('GET', '/api/species?kind=poisson')).filter((s) => s.source === 'maison');
			const others = await Promise.all(['corail', 'invertebre', 'plante', 'autre'].map((k) => api<Species[]>('GET', `/api/species?kind=${k}`)));
			mine = [...mine, ...others.flat().filter((s) => s.source === 'maison')];
		} catch (e) {
			message = (e as Error).message;
		}
	}
	onMount(loadMine);

	async function reload(id: number) {
		selected = await api<Species>('GET', `/api/species/${id}`);
		adding = false;
		await loadMine();
	}

	async function remove(s: Species) {
		if (!confirm(`Supprimer « ${speciesName(s)} » ?`)) return;
		try {
			await api('DELETE', `/api/species/${s.id}`);
			selected = null;
			await loadMine();
		} catch (e) {
			message = (e as Error).message;
		}
	}

	const completeness = (s: Species) =>
		[s.temperament, s.diet, s.tempMin, s.phMin, s.maxLengthCm, s.groupMin].filter((v) => v != null).length;
</script>

<svelte:head><title>Espèces · Aquarium</title></svelte:head>

<h1 class="mb-2 text-2xl font-semibold">Espèces</h1>
<p class="mb-4 text-xs text-slate-500">
	Taille, noms et type d'eau viennent de FishBase et SeaLifeBase ; l'élevage (températures, tempérament…) est à compléter
	par toi : ces bases donnent des données scientifiques, pas des fiches d'élevage.
</p>
{#if message}<p class="mb-4 rounded-lg bg-red-950 p-3 text-sm text-red-200" role="alert">{message}</p>{/if}

{#if adding}
	<h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">Nouvelle espèce</h2>
	<SpeciesForm onsaved={reload} oncancel={() => (adding = false)} />
{:else if selected}
	<button class="mb-3 text-sm text-cyan-300 underline" onclick={() => (selected = null)}>← Retour</button>
	<h2 class="text-lg font-medium">{speciesName(selected)}</h2>
	<p class="mb-1 text-sm italic text-slate-400">{selected.scientificName} · {KIND_LABELS[selected.kind]}</p>
	<p class="mb-4 text-xs text-slate-500">
		Source : {selected.source === 'maison' ? 'saisie à la main' : selected.source === 'fishbase' ? 'FishBase' : 'SeaLifeBase'}
	</p>
	{#key selected.id}
		<SpeciesForm species={selected} onsaved={reload} />
	{/key}
	{#if selected.source === 'maison'}
		<button class="mt-4 text-sm text-red-300 underline" onclick={() => selected && remove(selected)}>Supprimer cette espèce</button>
	{/if}
{:else}
	<SpeciesPicker onpick={(s) => (selected = s)} />
	<button class="mt-3 w-full rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium active:bg-cyan-800" onclick={() => (adding = true)}>
		Ajouter une espèce à la main
	</button>
	{#if mine.length}
		<h2 class="mb-2 mt-6 text-sm font-medium uppercase tracking-wide text-slate-400">Mes espèces</h2>
		<ul class="flex flex-col gap-2">
			{#each mine as s (s.id)}
				<li>
					<button class="block w-full rounded-lg bg-slate-900 p-3 text-left active:bg-slate-800" onclick={() => (selected = s)}>
						<span class="block text-sm">{speciesName(s)}</span>
						<span class="block text-xs text-slate-400">{s.scientificName} · fiche {completeness(s)}/6</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
	<p class="mt-8 text-xs text-slate-600">
		Données : FishBase (fishbase.org) et SeaLifeBase (sealifebase.org), licence CC-BY-NC 4.0, usage personnel.
	</p>
{/if}

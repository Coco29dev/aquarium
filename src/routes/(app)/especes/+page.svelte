<script lang="ts">
	import { onMount } from 'svelte';
	import SpeciesForm from '$lib/components/SpeciesForm.svelte';
	import { api } from '$lib/client/api';
	import { speciesName } from '$lib/domain/species';
	import { KIND_LABELS, type Species, type SpeciesKind } from '$lib/types';

	let query = $state('');
	let kind = $state<'' | SpeciesKind>('');
	let water = $state<'' | 'douce' | 'mer'>('');
	let all = $state(false);
	let results = $state<Species[]>([]);
	let loading = $state(false);
	let selected = $state<Species | null>(null);
	let editing = $state(false);
	let adding = $state(false);
	let message = $state('');
	let timer: ReturnType<typeof setTimeout>;

	async function search() {
		loading = true;
		try {
			const params = new URLSearchParams();
			if (query.trim().length >= 2) params.set('q', query.trim());
			if (kind) params.set('kind', kind);
			if (water) params.set('water', water);
			if (all) params.set('all', '1');
			results = await api<Species[]>('GET', `/api/species?${params}`);
			message = '';
		} catch (e) {
			message = (e as Error).message;
		} finally {
			loading = false;
		}
	}
	function later() {
		clearTimeout(timer);
		timer = setTimeout(search, 250);
	}
	onMount(search);

	async function open(id: number) {
		selected = await api<Species>('GET', `/api/species/${id}`);
		editing = false;
		adding = false;
		scrollTo({ top: 0 });
	}

	async function verify(s: Species) {
		await api('PATCH', `/api/species/${s.id}`, { verified: true });
		await open(s.id);
	}

	async function remove(s: Species) {
		if (!confirm(`Supprimer « ${speciesName(s)} » ?`)) return;
		try {
			await api('DELETE', `/api/species/${s.id}`);
			selected = null;
			await search();
		} catch (e) {
			message = (e as Error).message;
		}
	}

	const yesNo = (v: boolean | null) => (v == null ? '—' : v ? 'oui' : 'non');
	const range = (a: number | null, b: number | null, unit = '') => (a == null || b == null ? '—' : `${a}–${b}${unit}`);
	const water_ = (s: Species) => [s.fresh && 'eau douce', s.brackish && 'saumâtre', s.salt && 'eau de mer'].filter(Boolean).join(', ') || '—';
	const sourceLabel = (s: Species) =>
		({ fishbase: 'FishBase', sealifebase: 'SeaLifeBase', maison: 'saisie à la main', noyau: 'noyau encyclopédique' })[s.source];
</script>

<svelte:head><title>Espèces · Bulle</title></svelte:head>

{#if message}<p class="mb-4 rounded-lg bg-bad-soft p-3 text-sm text-bad" role="alert">{message}</p>{/if}

{#if adding}
	<button class="mb-3 text-sm text-primary underline" onclick={() => (adding = false)}>← Retour</button>
	<h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-muted">Nouvelle espèce</h2>
	<SpeciesForm onsaved={open} oncancel={() => (adding = false)} />
{:else if selected}
	<button class="mb-3 text-sm text-primary underline" onclick={() => (selected = null)}>← Retour</button>
	{#if selected.hasPhoto}
		<figure class="mb-4">
			<img src="/api/species/{selected.id}/photo" alt={speciesName(selected)} class="max-h-72 w-full rounded-lg object-cover" />
			<figcaption class="mt-1 text-xs text-muted">
				{selected.photoAuthor ?? 'Auteur inconnu'} · {selected.photoLicense}
				{#if selected.photoSource}· <a href={selected.photoSource} target="_blank" rel="noreferrer" class="underline">source</a>{/if}
			</figcaption>
		</figure>
	{/if}
	<h1 class="text-2xl font-semibold">{speciesName(selected)}</h1>
	<p class="mb-1 text-sm italic text-muted">{selected.scientificName}</p>
	{#if selected.nameEn && selected.nameEn !== speciesName(selected)}<p class="text-xs text-muted">{selected.nameEn}</p>{/if}
	<p class="mb-3 mt-1 text-xs text-muted">{KIND_LABELS[selected.kind]} · source : {sourceLabel(selected)}</p>

	{#if selected.dataQuality === 'claude'}
		<div class="mb-4 flex items-center justify-between gap-3 rounded-lg bg-warn-soft p-3 text-xs text-warn">
			<span>Fiche rédigée par Claude de mémoire, à vérifier avant de t'y fier.</span>
			<button class="shrink-0 underline" onclick={() => selected && verify(selected)}>Marquer vérifiée</button>
		</div>
	{:else if selected.dataQuality === 'verifie'}
		<p class="mb-4 text-xs text-ok">✓ Fiche vérifiée</p>
	{/if}

	{#if selected.description}<p class="mb-4 text-sm leading-relaxed">{selected.description}</p>{/if}

	{#if !editing}
		<dl class="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
			<dt class="text-muted">Eau</dt><dd>{water_(selected)}</dd>
			<dt class="text-muted">Taille adulte</dt><dd>{selected.maxLengthCm ? `${selected.maxLengthCm} cm` : '—'}</dd>
			<dt class="text-muted">Durée de vie</dt><dd>{selected.lifespanYears ? `${selected.lifespanYears} ans` : '—'}</dd>
			<dt class="text-muted">Température</dt><dd>{range(selected.tempMin, selected.tempMax, ' °C')}</dd>
			<dt class="text-muted">pH</dt><dd>{range(selected.phMin, selected.phMax)}</dd>
			<dt class="text-muted">Volume min.</dt><dd>{selected.minTankL ? `${selected.minTankL} L` : '—'}</dd>
			<dt class="text-muted">Tempérament</dt><dd>{selected.temperament ?? '—'}</dd>
			<dt class="text-muted">Régime</dt><dd>{selected.diet ?? '—'}{selected.estimated.includes('diet') ? ' (estimé)' : ''}</dd>
			<dt class="text-muted">Zone du bac</dt><dd>{selected.zone ?? '—'}{selected.estimated.includes('zone') ? ' (estimé)' : ''}</dd>
			<dt class="text-muted">Groupe min.</dt><dd>{selected.groupMin ?? '—'}</dd>
			<dt class="text-muted">Compatible récif</dt><dd>{yesNo(selected.reefSafe)}</dd>
		</dl>
		{#if selected.notes}<p class="mb-4 whitespace-pre-wrap text-sm text-muted">{selected.notes}</p>{/if}
		<button class="w-full rounded-lg border-2 border-edge px-4 py-2 text-sm" onclick={() => (editing = true)}>Modifier la fiche</button>
	{:else}
		{#key selected.id}<SpeciesForm species={selected} onsaved={open} oncancel={() => (editing = false)} />{/key}
	{/if}
	{#if selected.source === 'maison'}
		<button class="mt-4 text-sm text-bad underline" onclick={() => selected && remove(selected)}>Supprimer cette espèce</button>
	{/if}
{:else}
	<h1 class="mb-2 text-2xl font-semibold">Espèces</h1>
	<p class="mb-4 text-xs text-muted">
		Encyclopédie : noms français et latin, description, fiche d'élevage. Les fiches du noyau sont rédigées par Claude
		de mémoire et marquées « à vérifier ».
	</p>
	<input bind:value={query} oninput={later} type="search" placeholder="Nom français, anglais ou latin" class="mb-2 w-full rounded-lg border-2 border-edge bg-surface px-3 py-2 text-base" aria-label="Rechercher" />
	<div class="mb-2 grid grid-cols-2 gap-2">
		<select bind:value={kind} onchange={search} class="rounded-lg border-2 border-edge bg-surface px-2 py-2 text-sm" aria-label="Type">
			<option value="">Tous types</option>
			{#each Object.entries(KIND_LABELS) as [value, label] (value)}<option {value}>{label}</option>{/each}
		</select>
		<select bind:value={water} onchange={search} class="rounded-lg border-2 border-edge bg-surface px-2 py-2 text-sm" aria-label="Eau">
			<option value="">Toutes eaux</option>
			<option value="douce">Eau douce</option>
			<option value="mer">Eau de mer</option>
		</select>
	</div>
	<label class="mb-4 flex items-center gap-2 text-xs text-muted">
		<input type="checkbox" bind:checked={all} onchange={search} class="accent-primary" />
		Inclure la base brute (~8 000 espèces hors noyau, souvent sans fiche)
	</label>

	<ul class="mb-4 flex flex-col gap-2">
		{#each results as s (s.id)}
			<li>
				<button class="flex w-full items-center gap-3 card p-2 text-left active:bg-surface2" onclick={() => open(s.id)}>
					{#if s.hasPhoto}
						<img src="/api/species/{s.id}/photo" alt="" loading="lazy" class="h-14 w-14 shrink-0 rounded object-cover" />
					{:else}
						<span class="h-14 w-14 shrink-0 rounded bg-surface2"></span>
					{/if}
					<span class="min-w-0">
						<span class="block truncate text-sm">{speciesName(s)}</span>
						<span class="block truncate text-xs italic text-muted">{s.scientificName}</span>
						<span class="block truncate text-xs text-muted">{KIND_LABELS[s.kind]}{s.maxLengthCm ? ` · ${s.maxLengthCm} cm` : ''}{s.curated ? '' : ' · base brute'}</span>
					</span>
				</button>
			</li>
		{:else}
			{#if !loading}<li class="text-sm text-muted">Aucun résultat.</li>{/if}
		{/each}
	</ul>
	{#if results.length >= 40}<p class="mb-4 text-xs text-muted">40 premiers résultats : précise la recherche.</p>{/if}

	<button class="w-full rounded-lg btn-primary px-4 py-2 text-sm font-medium" onclick={() => (adding = true)}>
		Ajouter une espèce à la main
	</button>
	<p class="mt-8 text-xs text-muted">
		Données de base : FishBase (fishbase.org) et SeaLifeBase (sealifebase.org), CC-BY-NC 4.0. Photos : Wikimedia Commons,
		auteurs et licences indiqués sous chaque image.
	</p>
{/if}

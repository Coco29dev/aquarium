<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import SpeciesPicker from '$lib/components/SpeciesPicker.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { store } from '$lib/client/store.svelte';
	import { api, createResource, listResource } from '$lib/client/api';
	import { BIOLOAD_LABELS, bioload, checkCompatibility, speciesName, type StockItem } from '$lib/domain/species';
	import { dayInParis } from '$lib/domain/dates';
	import type { Species } from '$lib/types';

	interface Inhabitant { id: number; kind: 'faune' | 'flore'; species: string; quantity: number; speciesId: number | null; leftOn: string | null }

	const id = $derived(Number(page.params.id));
	const aquarium = $derived(store.view?.aquariums.find((a) => a.id === id));
	const tempParam = $derived(store.view?.parameters.find((p) => p.aquariumId === id && p.key === 'temp'));
	const phParam = $derived(store.view?.parameters.find((p) => p.aquariumId === id && p.key === 'ph'));

	let inhabitants = $state<Inhabitant[]>([]);
	let speciesById = $state<Record<number, Species>>({});
	let draft = $state<{ species: Species; quantity: number }[]>([]);
	let message = $state('');
	let saved = $state('');

	async function load() {
		try {
			inhabitants = (await listResource<Inhabitant>('inhabitants', id)).filter((i) => !i.leftOn);
			const ids = [...new Set(inhabitants.map((i) => i.speciesId).filter((x): x is number => x != null))];
			const list = ids.length ? await api<Species[]>('GET', `/api/species?ids=${ids.join(',')}`) : [];
			speciesById = Object.fromEntries(list.map((s) => [s.id, s]));
			message = '';
		} catch (e) {
			message = (e as Error).message;
		}
	}
	onMount(load);

	const current = $derived<StockItem[]>(
		inhabitants.flatMap((i) => (i.speciesId != null && speciesById[i.speciesId] ? [{ species: speciesById[i.speciesId], quantity: i.quantity }] : []))
	);
	const unlinked = $derived(inhabitants.filter((i) => i.speciesId == null || !speciesById[i.speciesId]));

	// Fusionne l'existant et le brouillon : même espèce → quantités additionnées.
	const planned = $derived.by<StockItem[]>(() => {
		const merged = new Map<number, StockItem>();
		for (const item of [...current, ...draft]) {
			const entry = merged.get(item.species.id);
			if (entry) merged.set(item.species.id, { ...entry, quantity: entry.quantity + item.quantity });
			else merged.set(item.species.id, { ...item });
		}
		return [...merged.values()];
	});

	const tank = $derived({
		waterType: aquarium?.waterType ?? 'douce',
		volumeL: aquarium?.volumeL ?? null,
		tempMin: tempParam?.min ?? null,
		tempMax: tempParam?.max ?? null,
		phMin: phParam?.min ?? null,
		phMax: phParam?.max ?? null
	});

	const now = $derived(bioload(tank, current));
	const after = $derived(bioload(tank, planned));
	const issues = $derived(checkCompatibility(tank, planned));

	function addDraft(species: Species) {
		const existing = draft.find((d) => d.species.id === species.id);
		if (existing) existing.quantity += 1;
		else draft.push({ species, quantity: 1 });
	}

	async function validate() {
		try {
			for (const d of draft) {
				await createResource('inhabitants', id, {
					kind: d.species.kind === 'plante' ? 'flore' : 'faune',
					species: speciesName(d.species),
					speciesId: d.species.id,
					quantity: d.quantity,
					arrivedOn: dayInParis()
				});
			}
			saved = `${draft.length} espèce${draft.length > 1 ? 's' : ''} ajoutée${draft.length > 1 ? 's' : ''} au bac.`;
			ui.show(saved);
			draft = [];
			await load();
		} catch (e) {
			message = (e as Error).message;
		}
	}

	const severityStyle = {
		bloquant: 'border-bad bg-bad-soft text-bad',
		attention: 'border-warn bg-warn-soft text-warn',
		info: 'border-line bg-surface text-muted'
	} as const;
	const severityLabel = { bloquant: 'À éviter', attention: 'Attention', info: 'Info' } as const;
	const levelText = { ok: 'text-ok', elevee: 'text-ink', limite: 'text-warn', surcharge: 'text-bad' } as const;

	// Règle graduée de 0 à 120 % de la capacité estimée.
	const RULER_MAX = 1.2;
	const at = (ratio: number | null) => (ratio == null ? 0 : Math.min(100, (ratio / RULER_MAX) * 100));
	const ticks = Array.from({ length: 13 }, (_, i) => i / 10);
</script>

<svelte:head><title>Peuplement · {aquarium?.name ?? 'Bac'}</title></svelte:head>

<header class="rise mb-6">
	<a href="/aquariums/{id}/inventaire" class="-ml-1 mb-3 flex w-fit items-center gap-1 text-sm font-bold text-muted">
		<Icon name="back" size={18} />Vivants
	</a>
	<p class="num mb-1.5 text-xs uppercase tracking-wider text-muted">{aquarium?.name ?? 'Bac'}{aquarium?.volumeL ? ` · ${aquarium.volumeL} L` : ''}</p>
	<h1 class="display text-[2.4rem]">Peuplement</h1>
	<p class="hand mt-2 text-lg leading-snug text-muted">
		Estimation d'après la taille adulte des espèces. Plus les fiches sont complètes, plus c'est juste.
	</p>
</header>

{#if message}<p class="mb-4 rounded-xl border-2 border-bad bg-bad-soft p-3 text-sm font-bold text-bad" role="alert">{message}</p>{/if}

<!-- Charge biologique -->
<section class="card rise mb-8 p-4" style="animation-delay: 40ms">
	<div class="mb-4 flex items-end justify-between gap-3">
		<div>
			<p class="num text-[11px] uppercase tracking-wider text-muted">Charge biologique</p>
			{#if now.ratio != null}
				<p class="display text-4xl {now.level ? levelText[now.level] : ''}">{Math.round(now.ratio * 100)} %</p>
			{:else}
				<p class="display text-2xl text-muted">Volume inconnu</p>
			{/if}
		</div>
		<div class="text-right">
			{#if now.level}<p class="font-bold {levelText[now.level]}">{BIOLOAD_LABELS[now.level]}</p>{/if}
			<p class="num text-xs text-muted">{now.loadG} g{now.capacityG ? ` / ${now.capacityG} g` : ''}</p>
		</div>
	</div>

	{#if now.ratio != null}
		<div class="relative mb-1 pt-5" aria-hidden="true">
			<!-- Zones : confortable, élevée, limite, surcharge -->
			<div class="relative flex h-5 overflow-hidden rounded-md border-2 border-edge">
				<div class="bg-ok/30" style="width: {at(0.6)}%"></div>
				<div class="bg-sun/45" style="width: {at(0.9) - at(0.6)}%"></div>
				<div class="bg-warn/35" style="width: {at(1) - at(0.9)}%"></div>
				<div class="flex-1 bg-bad/30"></div>
			</div>
			<!-- Graduations -->
			<div class="relative h-3">
				{#each ticks as t (t)}
					<span class="absolute top-0 w-0.5 -translate-x-1/2 bg-ink {t * 10 % 5 === 0 ? 'h-3' : 'h-1.5'}" style="left: {at(t)}%"></span>
				{/each}
			</div>
			<div class="num relative h-4 text-[10px] text-muted">
				{#each [0, 0.5, 1] as t (t)}
					<span class="absolute -translate-x-1/2" style="left: {at(t)}%">{t * 100}</span>
				{/each}
			</div>
			<!-- Curseurs : actuel (encre) et avec le brouillon (pointillé) -->
			{#if draft.length && after.ratio != null}
				<span class="absolute top-0 flex -translate-x-1/2 flex-col items-center" style="left: {at(after.ratio)}%">
					<span class="num rounded border-[1.5px] border-dashed border-edge bg-surface px-1 text-[10px]">+{Math.round((after.ratio - now.ratio) * 100)}</span>
					<span class="h-6 w-0 border-l-2 border-dashed border-ink"></span>
				</span>
			{/if}
			<span class="absolute top-3 h-8 w-1.5 -translate-x-1/2 rounded-full border-[1.5px] border-surface bg-ink" style="left: {at(now.ratio)}%"></span>
		</div>
		{#if draft.length && after.level}
			<p class="mt-2 text-sm">
				Avec le brouillon : <span class="font-bold {levelText[after.level]}">{Math.round((after.ratio ?? 0) * 100)} % · {BIOLOAD_LABELS[after.level]}</span>
			</p>
		{/if}
	{:else}
		<p class="text-sm text-muted">Indique le volume du bac dans ses réglages pour estimer la charge.</p>
	{/if}

	{#if after.unknown.length}
		<p class="mt-3 text-xs text-warn">Taille inconnue, non comptés : {after.unknown.join(', ')}.</p>
	{/if}
	{#if unlinked.length}
		<p class="mt-3 text-xs text-muted">
			Hors analyse, pas reliés à une fiche : {unlinked.map((i) => i.species).join(', ')}.
			<a href="/aquariums/{id}/inventaire" class="font-bold text-link underline">Les relier</a>
		</p>
	{/if}
</section>

<!-- Simulateur -->
<section class="rise mb-8" style="animation-delay: 80ms">
	<h2 class="tape mb-3">Et si j'ajoutais…</h2>
	<SpeciesPicker onpick={addDraft} water={tank.waterType === 'mer' || tank.waterType === 'recif' ? 'mer' : 'douce'} />
	{#if draft.length}
		<ul class="card mt-3 divide-y-2 divide-line">
			{#each draft as d, i (d.species.id)}
				<li class="flex items-center gap-3 px-3 py-2.5">
					<span class="min-w-0 flex-1">
						<span class="line-clamp-2 block text-sm font-bold leading-tight">{speciesName(d.species)}</span>
						<span class="block truncate text-xs italic text-muted">{d.species.scientificName}</span>
					</span>
					<div class="flex shrink-0 items-center rounded-xl border-2 border-edge bg-surface">
						<button class="grid h-9 w-9 place-items-center text-lg font-bold" onclick={() => (d.quantity = Math.max(1, d.quantity - 1))} aria-label="Moins">−</button>
						<span class="num w-7 text-center">{d.quantity}</span>
						<button class="grid h-9 w-9 place-items-center text-lg font-bold" onclick={() => (d.quantity += 1)} aria-label="Plus">+</button>
					</div>
					<button class="shrink-0 text-muted" onclick={() => draft.splice(i, 1)} aria-label="Retirer {speciesName(d.species)}"><Icon name="close" size={18} /></button>
				</li>
			{/each}
		</ul>
		<button onclick={validate} class="btn mt-4 w-full">
			<Icon name="plus" size={20} />Ajouter au bac
		</button>
	{:else}
		<p class="hand mt-3 text-lg text-muted">Cherche une espèce : je recalcule la charge et les compatibilités avant que tu achètes.</p>
	{/if}
</section>

<!-- Compatibilité -->
<section class="rise" style="animation-delay: 120ms">
	<h2 class="tape mb-3">Compatibilité</h2>
	{#if planned.length === 0}
		<p class="hand text-lg text-muted">Aucune espèce reliée à une fiche pour l'instant.</p>
	{:else if issues.length === 0}
		<p class="flex items-center gap-2 rounded-xl border-2 border-ok bg-ok-soft p-3 text-sm font-bold text-ok">
			<Icon name="check" size={18} />Aucun conflit détecté avec les données disponibles.
		</p>
	{:else}
		<ul class="flex flex-col gap-2.5">
			{#each issues as issue (issue.severity + issue.message)}
				<li class="rounded-xl border-2 p-3 text-sm {severityStyle[issue.severity]}">
					<span class="chip mb-1.5">{#if issue.severity !== 'info'}<Icon name="alert" size={12} />{/if}{severityLabel[issue.severity]}</span>
					<p class="text-ink">{issue.message}</p>
				</li>
			{/each}
		</ul>
	{/if}
</section>

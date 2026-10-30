<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import SpeciesPicker from '$lib/components/SpeciesPicker.svelte';
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
			saved = `${draft.length} espèce(s) ajoutée(s) à l'inventaire.`;
			draft = [];
			await load();
		} catch (e) {
			message = (e as Error).message;
		}
	}

	const severityStyle = {
		bloquant: 'bg-red-950 text-red-100',
		attention: 'bg-amber-950 text-amber-100',
		info: 'bg-slate-900 text-slate-300'
	} as const;
	const severityLabel = { bloquant: 'À éviter', attention: 'Attention', info: 'Info' } as const;
	const levelStyle = { ok: 'bg-emerald-500', elevee: 'bg-lime-500', limite: 'bg-amber-500', surcharge: 'bg-red-500' } as const;
</script>

{#snippet gauge(b: ReturnType<typeof bioload>, title: string)}
	<div>
		<div class="mb-1 flex justify-between text-xs text-slate-400">
			<span>{title}</span>
			<span>{b.level ? BIOLOAD_LABELS[b.level] : 'Volume inconnu'}</span>
		</div>
		<div class="h-3 overflow-hidden rounded-full bg-slate-800">
			<div class="h-full {b.level ? levelStyle[b.level] : 'bg-slate-600'}" style="width: {Math.min(100, (b.ratio ?? 0) * 100)}%"></div>
		</div>
		<p class="mt-1 text-xs text-slate-500">{b.loadG} g{b.capacityG ? ` sur ${b.capacityG} g de capacité` : ''}</p>
	</div>
{/snippet}

<svelte:head><title>Peuplement · {aquarium?.name ?? 'Aquarium'}</title></svelte:head>

<a href="/aquariums/{id}" class="text-sm text-cyan-300 underline">← {aquarium?.name ?? 'Aquarium'}</a>
<h1 class="mb-2 mt-2 text-2xl font-semibold">Peuplement</h1>
<p class="mb-5 text-xs text-slate-500">
	Estimations indicatives d'après la taille adulte (poissons jeunes comptés comme adultes). Plus les fiches sont complètes, plus l'analyse est fiable.
</p>
{#if message}<p class="mb-4 rounded-lg bg-red-950 p-3 text-sm text-red-200" role="alert">{message}</p>{/if}
{#if saved}<p class="mb-4 rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200" role="status">{saved}</p>{/if}

<section class="mb-6 flex flex-col gap-4">
	{@render gauge(now, 'Charge biologique actuelle')}
	{#if draft.length}{@render gauge(after, 'Avec le brouillon')}{/if}
	{#if after.unknown.length}
		<p class="text-xs text-amber-300">Taille inconnue, charge non comptée : {after.unknown.join(', ')}.</p>
	{/if}
	{#if unlinked.length}
		<p class="text-xs text-slate-400">
			Hors analyse (pas reliés à une fiche) : {unlinked.map((i) => i.species).join(', ')}. Relie-les depuis
			<a href="/aquariums/{id}/inventaire" class="text-cyan-300 underline">l'inventaire</a>.
		</p>
	{/if}
</section>

<section class="mb-6">
	<h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">Simulateur : et si j'ajoutais…</h2>
	<SpeciesPicker onpick={addDraft} water={tank.waterType === 'mer' || tank.waterType === 'recif' ? 'mer' : 'douce'} />
	{#if draft.length}
		<ul class="mt-3 flex flex-col gap-2">
			{#each draft as d, i (d.species.id)}
				<li class="flex items-center gap-2 rounded-lg bg-slate-900 p-2 pl-3">
					<span class="min-w-0 flex-1 truncate text-sm">{speciesName(d.species)}</span>
					<button class="h-9 w-9 rounded-lg bg-slate-800" onclick={() => (d.quantity = Math.max(1, d.quantity - 1))} aria-label="Moins">−</button>
					<span class="w-6 text-center text-sm">{d.quantity}</span>
					<button class="h-9 w-9 rounded-lg bg-slate-800" onclick={() => (d.quantity += 1)} aria-label="Plus">+</button>
					<button class="px-2 text-xs text-red-300" onclick={() => draft.splice(i, 1)} aria-label="Retirer">×</button>
				</li>
			{/each}
		</ul>
		<button onclick={validate} class="mt-3 w-full rounded-lg bg-cyan-700 px-4 py-3 text-sm font-medium active:bg-cyan-800">
			Ajouter ces espèces à l'inventaire
		</button>
	{/if}
</section>

<section>
	<h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">Compatibilité</h2>
	{#if planned.length === 0}
		<p class="text-sm text-slate-400">Aucune espèce reliée à une fiche. Ajoute-en depuis le simulateur ou l'inventaire.</p>
	{:else if issues.length === 0}
		<p class="rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200">Aucun conflit détecté avec les données disponibles.</p>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each issues as issue (issue.severity + issue.message)}
				<li class="rounded-lg p-3 text-sm {severityStyle[issue.severity]}">
					<span class="mb-1 block text-xs font-medium uppercase opacity-70">{severityLabel[issue.severity]}</span>
					{issue.message}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import SpeciesPicker from '$lib/components/SpeciesPicker.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import StepButtons from '$lib/ios/StepButtons.svelte';
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

	const severityColor = { bloquant: 'var(--red)', attention: 'var(--orange)', info: 'var(--gray)' } as const;
	const severityLabel = { bloquant: 'À éviter', attention: 'Attention', info: 'Info' } as const;
	const levelColor = { ok: 'var(--green)', elevee: 'var(--yellow)', limite: 'var(--orange)', surcharge: 'var(--red)' } as const;

	// Anneau façon Forme : un tour complet = 100 % de la capacité estimée ; au-delà, l'anneau repasse sur lui-même.
	const R = 74;
	const C = 2 * Math.PI * R;
	const dash = (ratio: number | null) => `${Math.min(1, ratio ?? 0) * C} ${C}`;
	const overflow = (ratio: number | null) => `${Math.max(0, Math.min(1, (ratio ?? 0) - 1)) * C} ${C}`;
</script>

<svelte:head><title>Peuplement · {aquarium?.name ?? 'Bac'}</title></svelte:head>

<NavBar title="Peuplement" back={{ href: `/aquariums/${id}/inventaire`, label: 'Vivants' }} large={false} />

{#if message}<p class="subhead mb-4 rounded-2xl bg-red/10 px-4 py-3 text-red" role="alert">{message}</p>{/if}

<!-- Charge biologique -->
<section class="group mb-2 mt-2 flex flex-col items-center px-4 pb-5 pt-6">
	<p class="subhead mb-4 font-semibold text-label2">Charge biologique · {aquarium?.name ?? 'Bac'}</p>
	{#if now.ratio != null}
		{@const color = now.level ? levelColor[now.level] : 'var(--tint)'}
		<div class="relative h-[180px] w-[180px]">
			<svg viewBox="0 0 180 180" class="h-full w-full -rotate-90" aria-hidden="true">
				<circle cx="90" cy="90" r={R} fill="none" stroke={color} stroke-opacity="0.18" stroke-width="22" />
				{#if draft.length && after.ratio != null}
					<circle cx="90" cy="90" r={R} fill="none" stroke={after.level ? levelColor[after.level] : color} stroke-opacity="0.45" stroke-width="22" stroke-linecap="round" stroke-dasharray={dash(after.ratio)} />
				{/if}
				{#if now.ratio > 0.005}
					<circle cx="90" cy="90" r={R} fill="none" stroke={color} stroke-width="22" stroke-linecap="round" stroke-dasharray={dash(now.ratio)} class="transition-[stroke-dasharray] duration-700" />
				{/if}
				{#if now.ratio > 1}
					<circle cx="90" cy="90" r={R} fill="none" stroke={color} stroke-width="22" stroke-linecap="round" stroke-dasharray={overflow(now.ratio)} style="filter: drop-shadow(0 0 3px rgb(0 0 0 / 0.35))" />
				{/if}
			</svg>
			<div class="absolute inset-0 grid place-items-center text-center">
				<div>
					<p class="rounded-num text-[40px] font-bold leading-none">{Math.round(now.ratio * 100)}<span class="title3 text-label2">%</span></p>
					{#if now.level}<p class="footnote mt-1 font-semibold" style="color: {color}">{BIOLOAD_LABELS[now.level]}</p>{/if}
				</div>
			</div>
		</div>
		<p class="footnote mt-4 text-label2">{now.loadG} g{now.capacityG ? ` sur ${now.capacityG} g estimés` : ''}</p>
		{#if draft.length && after.ratio != null && after.level}
			<p class="subhead mt-1 font-semibold" style="color: {levelColor[after.level]}">
				Avec ces ajouts : {Math.round(after.ratio * 100)} % · {BIOLOAD_LABELS[after.level]}
			</p>
		{/if}
	{:else}
		<p class="subhead text-center text-label2">Indique le volume du bac dans ses réglages pour estimer la charge.</p>
	{/if}
</section>
<p class="footnote mb-8 px-4 text-label2">
	Estimation d’après la taille adulte des espèces : plus les fiches sont complètes, plus c’est juste.
	{#if after.unknown.length}Taille inconnue, non comptés : {after.unknown.join(', ')}.{/if}
	{#if unlinked.length}Pas reliés à une fiche : {unlinked.map((i) => i.species).join(', ')}.{/if}
</p>

<!-- Simulateur -->
<Section header="Et si j’ajoutais…" inset={false} footer={draft.length ? undefined : 'Cherche une espèce : la charge et les compatibilités sont recalculées avant que tu achètes.'}>
	<SpeciesPicker onpick={addDraft} water={tank.waterType === 'mer' || tank.waterType === 'recif' ? 'mer' : 'douce'} />
	{#if draft.length}
		<ul class="group draft-list mt-3">
			{#each draft as d, i (d.species.id)}
				<li class="flex items-center gap-3 pl-4">
					<button class="shrink-0 text-red active:opacity-50" onclick={() => draft.splice(i, 1)} aria-label="Retirer {speciesName(d.species)}">
						<span class="grid h-[22px] w-[22px] place-items-center rounded-full bg-red text-white"><svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 5h7" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg></span>
					</button>
					<div class="row-body flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pr-4">
						<div class="min-w-0 flex-1">
							<p class="body truncate">{speciesName(d.species)}</p>
							<p class="subhead truncate italic text-label2">{d.species.scientificName}</p>
						</div>
						<span class="rounded-num headline w-7 text-right">{d.quantity}</span>
						<StepButtons label={speciesName(d.species)} onminus={() => (d.quantity = Math.max(1, d.quantity - 1))} onplus={() => (d.quantity += 1)} minusDisabled={d.quantity <= 1} />
					</div>
				</li>
			{/each}
		</ul>
		<button onclick={validate} class="btn-filled mt-4 w-full">Ajouter au bac</button>
	{/if}
</Section>

<!-- Compatibilité -->
<Section header="Compatibilité">
	{#if planned.length === 0}
		<Row title="Aucune espèce reliée à une fiche" subtitle="Relie tes habitants à une fiche depuis Vivants." />
	{:else if issues.length === 0}
		<Row icon="check" iconColor="var(--green)" title="Aucun conflit détecté" subtitle="Avec les données disponibles." />
	{:else}
		{#each issues as issue (issue.severity + issue.message)}
			<Row icon={issue.severity === 'info' ? 'info' : 'alert'} iconColor={severityColor[issue.severity]}>
				<p class="subhead font-semibold" style="color: {severityColor[issue.severity]}">{severityLabel[issue.severity]}</p>
				<p class="body whitespace-normal">{issue.message}</p>
			</Row>
		{/each}
	{/if}
</Section>

<style>
	.draft-list > li + li .row-body {
		box-shadow: inset 0 0.5px 0 var(--sep);
	}
</style>

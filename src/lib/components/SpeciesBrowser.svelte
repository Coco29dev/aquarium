<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/client/api';
	import { KIND_LABELS, type Species, type SpeciesKind } from '$lib/types';
	import { speciesFit, speciesName, type TankContext } from '$lib/domain/species';
	import Icon from './Icon.svelte';
	import SpeciesThumb from './SpeciesThumb.svelte';
	import SearchField from '$lib/ios/SearchField.svelte';

	/**
	 * Parcours de la base d'espèces pour un bac : catégories, recherche, résultats illustrés
	 * avec une pastille d'adéquation (volume, température, pH). Remplace la saisie à la main.
	 */
	interface Props {
		onpick: (species: Species) => void;
		/** Saisie libre : appelée avec le texte tapé (peut être vide). */
		onmanual?: (text: string) => void;
		tank?: TankContext;
		/** Catégorie ouverte au départ. */
		initialKind?: SpeciesKind | 'tout';
	}
	let { onpick, onmanual, tank, initialKind = 'tout' }: Props = $props();

	const salt = $derived(tank?.waterType === 'mer' || tank?.waterType === 'recif');
	const water = $derived(tank ? (salt ? 'mer' : 'douce') : undefined);

	const chips = $derived<{ value: SpeciesKind | 'tout'; label: string }[]>([
		{ value: 'tout', label: 'Tout' },
		{ value: 'poisson', label: 'Poissons' },
		{ value: 'invertebre', label: 'Invertébrés' },
		...(salt ? [{ value: 'corail' as const, label: 'Coraux' }] : []),
		{ value: 'plante', label: salt ? 'Macroalgues' : 'Plantes' }
	]);

	// svelte-ignore state_referenced_locally
	let kind = $state<SpeciesKind | 'tout'>(initialKind);
	let query = $state('');
	let all = $state(false);
	let results = $state<Species[]>([]);
	let loading = $state(false);
	let more = $state(false);
	let error = $state('');
	const PAGE = 24;
	let timer: ReturnType<typeof setTimeout>;
	let ticket = 0;

	async function fetchPage(reset: boolean) {
		const mine = ++ticket;
		loading = true;
		try {
			const params = new URLSearchParams({ limit: String(PAGE + 1), offset: String(reset ? 0 : results.length) });
			const q = query.trim();
			if (q.length >= 2) params.set('q', q);
			if (kind !== 'tout') params.set('kind', kind);
			if (water) params.set('water', water);
			if (all) params.set('all', '1');
			const page = await api<Species[]>('GET', `/api/species?${params}`);
			if (mine !== ticket) return;
			more = page.length > PAGE;
			const rows = page.slice(0, PAGE);
			results = reset ? rows : [...results, ...rows];
			error = '';
		} catch (e) {
			if (mine === ticket) error = (e as Error).message;
		} finally {
			if (mine === ticket) loading = false;
		}
	}
	function refresh(delay = 0) {
		clearTimeout(timer);
		timer = setTimeout(() => fetchPage(true), delay);
	}
	onMount(() => refresh());

	const LEVELS = ['Facile', 'Moyen', 'Exigeant'];
	const fitTone = { ok: 'var(--green)', attention: 'var(--orange)', bloquant: 'var(--red)' } as const;
	const fitOf = (s: Species) => (tank ? speciesFit(s, tank) : null);
</script>

<div class="flex flex-col gap-3">
	<SearchField bind:value={query} oninput={() => refresh(250)} placeholder="Nom commun ou latin" label="Rechercher une espèce" />

	<div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]" role="radiogroup" aria-label="Catégorie">
		{#each chips as c (c.value)}
			<button
				type="button"
				role="radio"
				aria-checked={kind === c.value}
				onclick={() => {
					kind = c.value;
					refresh();
				}}
				class="subhead pressable shrink-0 rounded-full px-3.5 py-1.5 font-semibold {kind === c.value ? 'bg-tint text-on-tint' : 'bg-fill3 text-label'}"
			>
				{c.label}
			</button>
		{/each}
	</div>

	{#if error}<p class="subhead px-1 text-red">{error}</p>{/if}

	{#if results.length}
		<ul class="group browser-list">
			{#each results as s (s.id)}
				{@const fit = fitOf(s)}
				<li>
					<button type="button" onclick={() => onpick(s)} class="tappable flex w-full items-center gap-3 pl-3 text-left">
						<SpeciesThumb species={s} class="my-2.5 h-[60px] w-[60px] shrink-0 rounded-[14px]" iconSize={24} />
						<span class="row-body flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-3">
							<span class="min-w-0 flex-1">
								<span class="body block truncate font-semibold">{speciesName(s)}</span>
								<span class="footnote block truncate italic text-label2">{s.scientificName}</span>
								<span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
									{#if fit && fit.level !== 'inconnu'}
										<span
											class="caption2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold"
											style="color: {fitTone[fit.level]}; background: color-mix(in srgb, {fitTone[fit.level]} 14%, transparent)"
										>
											<span class="h-1.5 w-1.5 rounded-full" style="background: {fitTone[fit.level]}"></span>{fit.label}
										</span>
									{/if}
									<span class="caption1 text-label2">
										{KIND_LABELS[s.kind]}{s.maxLengthCm ? ` · ${s.maxLengthCm.toLocaleString('fr-FR')} cm` : ''}{s.difficulty ? ` · ${LEVELS[s.difficulty - 1]}` : ''}
									</span>
								</span>
							</span>
							<span class="text-label3"><Icon name="next" size={16} weight={2.2} /></span>
						</span>
					</button>
				</li>
			{/each}
		</ul>
		{#if more}
			<button type="button" class="btn-tinted" disabled={loading} onclick={() => fetchPage(false)}>
				{loading ? 'Chargement…' : 'Voir plus d’espèces'}
			</button>
		{/if}
	{:else if loading}
		<p class="subhead px-1 py-6 text-center text-label2">Recherche…</p>
	{:else}
		<div class="px-1 py-6 text-center">
			<p class="headline">Aucune espèce trouvée</p>
			<p class="subhead mt-1 text-label2">
				{all ? 'Vérifie l’orthographe, ou ajoute-la à la main.' : 'Essaie la base complète (FishBase) ou ajoute-la à la main.'}
			</p>
		</div>
	{/if}

	<div class="flex flex-col gap-2 pt-1">
		{#if !all}
			<button
				type="button"
				class="btn-plain"
				onclick={() => {
					all = true;
					refresh();
				}}
			>
				Chercher dans la base complète (9 000 espèces)
			</button>
		{/if}
		{#if onmanual}
			<button type="button" class="btn-plain" onclick={() => onmanual(query.trim())}>
				{query.trim().length >= 2 ? `Ajouter « ${query.trim()} » à la main` : 'Saisir un nom à la main'}
			</button>
		{/if}
	</div>
</div>

<style>
	.browser-list > li + li .row-body {
		box-shadow: inset 0 0.5px 0 var(--sep);
	}
</style>

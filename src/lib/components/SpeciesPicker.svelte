<script lang="ts">
	import { api } from '$lib/client/api';
	import { KIND_LABELS, type Species } from '$lib/types';
	import { speciesName } from '$lib/domain/species';
	import Icon from './Icon.svelte';
	import SpeciesThumb from './SpeciesThumb.svelte';

	interface Props {
		onpick: (species: Species) => void;
		/** Limite aux espèces de ce type d'eau. */
		water?: 'douce' | 'mer';
		placeholder?: string;
	}
	let { onpick, water, placeholder = 'Chercher une espèce (nom commun ou latin)' }: Props = $props();

	let query = $state('');
	let all = $state(false);
	let results = $state<Species[]>([]);
	let loading = $state(false);
	let error = $state('');
	let timer: ReturnType<typeof setTimeout>;

	function search() {
		clearTimeout(timer);
		if (query.trim().length < 2) {
			results = [];
			return;
		}
		timer = setTimeout(async () => {
			loading = true;
			try {
				const params = new URLSearchParams({ q: query.trim() });
				if (water) params.set('water', water);
				if (all) params.set('all', '1');
				results = await api<Species[]>('GET', `/api/species?${params}`);
				error = '';
			} catch (e) {
				error = (e as Error).message;
			} finally {
				loading = false;
			}
		}, 250);
	}
</script>

<div class="flex flex-col gap-2">
	<label class="card-flat flex items-center gap-2 px-3">
		<Icon name="search" size={20} class="text-muted" />
		<input
			bind:value={query}
			oninput={search}
			type="search"
			placeholder={placeholder}
			class="min-w-0 flex-1 bg-transparent py-3 text-base outline-none"
			aria-label="Rechercher une espèce"
		/>
	</label>
	<label class="flex items-center gap-2 text-xs text-muted">
		<input type="checkbox" bind:checked={all} onchange={search} class="h-4 w-4 accent-primary" />
		Inclure la base brute (espèces hors noyau, fiches vides)
	</label>
	{#if error}<p class="text-sm font-bold text-bad">{error}</p>{/if}
	{#if loading}<p class="hand text-base text-muted">Je cherche…</p>{/if}
	{#if results.length}
		<ul class="card max-h-80 divide-y-2 divide-line overflow-y-auto">
			{#each results as s (s.id)}
				<li>
					<button
						type="button"
						onclick={() => {
							onpick(s);
							results = [];
							query = '';
						}}
						class="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-surface2"
					>
						<SpeciesThumb species={s} class="h-11 w-11 shrink-0 rounded-lg border-2" iconSize={20} />
						<span class="min-w-0 flex-1">
							<span class="block truncate text-sm font-bold">{speciesName(s)}</span>
							<span class="block truncate text-xs text-muted">
								<em>{s.scientificName}</em> · {KIND_LABELS[s.kind]}{s.maxLengthCm ? ` · ${s.maxLengthCm} cm` : ''}{s.source === 'maison' ? ' · maison' : ''}
							</span>
						</span>
						<Icon name="plus" size={18} class="text-muted" />
					</button>
				</li>
			{/each}
		</ul>
	{:else if query.trim().length >= 2 && !loading}
		<p class="text-xs text-muted">Aucun résultat{all ? '' : ' dans le noyau : coche « base brute » pour chercher plus large'}. <a href="/especes" class="font-bold text-link underline">Ajouter l'espèce à la main</a>.</p>
	{/if}
</div>

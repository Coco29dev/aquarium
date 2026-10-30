<script lang="ts">
	import { api } from '$lib/client/api';
	import { KIND_LABELS, type Species } from '$lib/types';
	import { speciesName } from '$lib/domain/species';
	import Icon from './Icon.svelte';
	import SpeciesThumb from './SpeciesThumb.svelte';
	import SearchField from '$lib/ios/SearchField.svelte';
	import Switch from '$lib/ios/Switch.svelte';

	interface Props {
		onpick: (species: Species) => void;
		/** Limite aux espèces de ce type d'eau. */
		water?: 'douce' | 'mer';
		placeholder?: string;
	}
	let { onpick, water, placeholder = 'Nom commun ou latin' }: Props = $props();

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

<div class="flex flex-col gap-2.5">
	<SearchField bind:value={query} oninput={search} {placeholder} label="Rechercher une espèce" />
	<label class="subhead flex items-center justify-between gap-3 px-1 text-label2">
		Inclure la base complète
		<Switch bind:checked={all} onchange={search} label="Inclure la base complète" />
	</label>
	{#if error}<p class="subhead px-1 text-red">{error}</p>{/if}
	{#if loading}<p class="subhead px-1 text-label2">Recherche…</p>{/if}
	{#if results.length}
		<ul class="group picker-list max-h-80 overflow-y-auto">
			{#each results as s (s.id)}
				<li>
					<button
						type="button"
						onclick={() => {
							onpick(s);
							results = [];
							query = '';
						}}
						class="tappable flex w-full items-center gap-3 pl-3 text-left"
					>
						<SpeciesThumb species={s} class="my-2 h-11 w-11 shrink-0 rounded-[10px]" iconSize={20} />
						<span class="row-body flex min-w-0 flex-1 items-center gap-2 py-2 pr-3">
							<span class="min-w-0 flex-1">
								<span class="body block truncate font-semibold">{speciesName(s)}</span>
								<span class="footnote block truncate text-label2">
									<em>{s.scientificName}</em> · {KIND_LABELS[s.kind]}{s.maxLengthCm ? ` · ${s.maxLengthCm} cm` : ''}{s.source === 'maison' ? ' · maison' : ''}
								</span>
							</span>
							<span class="text-tint"><Icon name="plus" size={22} weight={2.2} /></span>
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{:else if query.trim().length >= 2 && !loading}
		<p class="footnote px-1 text-label2">
			Aucun résultat{all ? '' : ' : inclus la base complète pour chercher plus large'}.
			<a href="/especes" class="text-tint">Ajouter l’espèce à la main</a>
		</p>
	{/if}
</div>

<style>
	.picker-list > li + li .row-body {
		box-shadow: inset 0 0.5px 0 var(--sep);
	}
</style>

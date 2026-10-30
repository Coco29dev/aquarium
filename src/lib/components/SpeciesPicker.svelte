<script lang="ts">
	import { api } from '$lib/client/api';
	import { KIND_LABELS, type Species } from '$lib/types';
	import { speciesName } from '$lib/domain/species';

	interface Props {
		onpick: (species: Species) => void;
		/** Limite aux espèces de ce type d'eau. */
		water?: 'douce' | 'mer';
		placeholder?: string;
	}
	let { onpick, water, placeholder = 'Chercher une espèce (nom commun ou latin)' }: Props = $props();

	let query = $state('');
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
	<input
		bind:value={query}
		oninput={search}
		type="search"
		placeholder={placeholder}
		class="w-full rounded-lg border border-cyan-900 bg-slate-950 px-3 py-2 text-base"
		aria-label="Rechercher une espèce"
	/>
	{#if error}<p class="text-sm text-red-300">{error}</p>{/if}
	{#if loading}<p class="text-xs text-slate-500">Recherche…</p>{/if}
	{#if results.length}
		<ul class="max-h-72 overflow-y-auto rounded-lg border border-slate-800">
			{#each results as s (s.id)}
				<li>
					<button
						type="button"
						onclick={() => {
							onpick(s);
							results = [];
							query = '';
						}}
						class="block w-full border-b border-slate-800 px-3 py-2 text-left last:border-b-0 active:bg-slate-800"
					>
						<span class="block text-sm">{speciesName(s)}</span>
						<span class="block text-xs italic text-slate-400">
							{s.scientificName} · {KIND_LABELS[s.kind]}{s.maxLengthCm ? ` · ${s.maxLengthCm} cm` : ''}{s.source === 'maison' ? ' · maison' : ''}
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{:else if query.trim().length >= 2 && !loading}
		<p class="text-xs text-slate-500">Aucun résultat. <a href="/especes" class="text-cyan-300 underline">Ajouter l'espèce à la main</a>.</p>
	{/if}
</div>

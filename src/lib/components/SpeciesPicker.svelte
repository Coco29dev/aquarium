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
	<input
		bind:value={query}
		oninput={search}
		type="search"
		placeholder={placeholder}
		class="w-full rounded-lg border-2 border-edge bg-surface px-3 py-2 text-base"
		aria-label="Rechercher une espèce"
	/>
	<label class="flex items-center gap-2 text-xs text-muted">
		<input type="checkbox" bind:checked={all} onchange={search} class="accent-primary" />
		Inclure la base brute (espèces hors noyau, fiches vides)
	</label>
	{#if error}<p class="text-sm text-bad">{error}</p>{/if}
	{#if loading}<p class="text-xs text-muted">Recherche…</p>{/if}
	{#if results.length}
		<ul class="max-h-72 overflow-y-auto rounded-lg border border-line">
			{#each results as s (s.id)}
				<li>
					<button
						type="button"
						onclick={() => {
							onpick(s);
							results = [];
							query = '';
						}}
						class="flex w-full items-center gap-3 border-b border-line px-3 py-2 text-left last:border-b-0 active:bg-surface2"
					>
						{#if s.hasPhoto}
							<img src="/api/species/{s.id}/photo" alt="" loading="lazy" class="h-10 w-10 shrink-0 rounded object-cover" />
						{:else}
							<span class="h-10 w-10 shrink-0 rounded bg-surface2"></span>
						{/if}
						<span class="min-w-0">
							<span class="block truncate text-sm">{speciesName(s)}</span>
							<span class="block truncate text-xs italic text-muted">
								{s.scientificName} · {KIND_LABELS[s.kind]}{s.maxLengthCm ? ` · ${s.maxLengthCm} cm` : ''}{s.source === 'maison' ? ' · maison' : ''}
							</span>
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{:else if query.trim().length >= 2 && !loading}
		<p class="text-xs text-muted">Aucun résultat{all ? '' : ' dans le noyau : coche « base brute » pour chercher plus large'}. <a href="/especes" class="text-primary underline">Ajouter l'espèce à la main</a>.</p>
	{/if}
</div>

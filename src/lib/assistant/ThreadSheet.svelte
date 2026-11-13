<script lang="ts">
	import { untrack } from 'svelte';
	import Sheet from '$lib/ios/Sheet.svelte';
	import Section from '$lib/ios/Section.svelte';
	import SearchField from '$lib/ios/SearchField.svelte';
	import Segmented from '$lib/ios/Segmented.svelte';
	import Spinner from '$lib/ios/Spinner.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import EmptyChat from '$lib/art/EmptyChat.svelte';
	import ThreadRow from './ThreadRow.svelte';
	import { threads } from './threads.svelte';
	import { groupByRecency, threadLabel, type ThreadSummary } from '$lib/domain/assistant';
	import { haptic } from '$lib/motion/haptic';
	import type { Aquarium } from '$lib/types';

	/**
	 * Feuille « Conversations » : toutes les conversations passées, par ancienneté, avec recherche, filtre par
	 * bac, renommage et suppression (glissement, appui long, ou « Sélectionner » pour en retirer plusieurs).
	 * Supprimer une conversation supprime aussi ses photos. Toucher une conversation la rouvre dans le chat.
	 * Props : open, tanks, currentId (conversation affichée), onclose, onopen(id), onnew, onrename(t), ondeleted(ids).
	 */
	interface Props {
		open: boolean;
		tanks: Aquarium[];
		currentId: number | null;
		onclose: () => void;
		onopen: (id: number) => void;
		onnew: () => void;
		onrename: (thread: ThreadSummary) => void;
		ondeleted: (ids: number[]) => void;
	}
	let { open, tanks, currentId, onclose, onopen, onnew, onrename, ondeleted }: Props = $props();

	/** Sans accents ni majuscules, pour une recherche tolérante. */
	const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

	let query = $state('');
	/** 0 : tous les bacs. */
	let filter = $state(0);
	let selecting = $state(false);
	let selected = $state<number[]>([]);

	// À chaque ouverture : liste relue, recherche et sélection remises à zéro.
	$effect(() => {
		if (!open) return;
		query = '';
		selecting = false;
		selected = [];
		// Hors de l'effet : la lecture change l'état de `threads`, ce qui ne doit pas remettre la sélection à zéro.
		untrack(() => void threads.load());
	});

	const tankOf = (id: number) => tanks.find((t) => t.id === id);
	// Un filtre par bac n'a de sens qu'avec deux ou trois bacs ; au-delà, la recherche (qui lit le nom du bac) suffit.
	const showFilter = $derived(tanks.length > 1 && tanks.length <= 3);
	const filtered = $derived.by(() => {
		const q = normalize(query.trim());
		return threads.list.filter((t) => (filter === 0 || t.aquariumId === filter) && (!q || normalize(`${threadLabel(t)} ${t.preview} ${tankOf(t.aquariumId)?.name ?? ''}`).includes(q)));
	});
	const groups = $derived(groupByRecency(filtered));
	const allSelected = $derived(filtered.length > 0 && filtered.every((t) => selected.includes(t.id)));

	function toggle(id: number) {
		haptic('tick');
		selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
	}

	async function remove(targets: ThreadSummary[]) {
		const gone = await threads.confirmRemove(targets);
		if (!gone.length) return;
		selected = selected.filter((id) => !gone.includes(id));
		if (!threads.list.length || !selected.length) selecting = false;
		ondeleted(gone);
	}

	const removeSelected = () => remove(threads.list.filter((t) => selected.includes(t.id)));
	const toggleAll = () => (selected = allSelected ? [] : filtered.map((t) => t.id));
</script>

<Sheet
	{open}
	title={selecting ? (selected.length ? `${selected.length} sélectionnée${selected.length > 1 ? 's' : ''}` : 'Sélectionner') : 'Conversations'}
	cancelLabel="Fermer"
	{onclose}
	action={threads.list.length ? { label: selecting ? 'Terminé' : 'Sélectionner', onclick: () => ((selecting = !selecting), (selected = [])) } : undefined}
>
	{#if threads.status === 'loading' || threads.status === 'idle'}
		<div class="mt-16 grid place-items-center" role="status" aria-label="Chargement"><Spinner spinning size={32} /></div>
	{:else if threads.status === 'error'}
		<p class="subhead mt-6 rounded-field bg-bg2 px-4 py-3 text-red" role="alert">{threads.failure}</p>
		<button class="btn-tinted mt-4 w-full" onclick={() => threads.load()}>Réessayer</button>
	{:else if !threads.list.length}
		<div class="mx-auto mt-4 flex max-w-xs flex-col items-center text-center">
			<EmptyChat class="mb-3 w-full max-w-[11rem]" />
			<h3 class="title3">Aucune conversation</h3>
			<p class="subhead mt-1.5 text-label2">Tes échanges avec l’assistant seront gardés ici, avec leurs photos, pour les reprendre quand tu veux.</p>
			<button class="btn-filled mt-5" onclick={onnew}><Icon name="edit" size={20} />Nouvelle conversation</button>
		</div>
	{:else}
		<div class="mb-3 flex flex-col gap-2.5">
			<SearchField bind:value={query} placeholder="Rechercher une conversation" />
			{#if showFilter}
				<Segmented options={[{ value: 0, label: 'Tous' }, ...tanks.map((t) => ({ value: t.id, label: t.name }))]} bind:value={filter} label="Bac" />
			{/if}
			{#if !selecting}
				<button class="btn-tinted min-h-11 w-full" onclick={onnew}><Icon name="edit" size={20} />Nouvelle conversation</button>
			{/if}
		</div>

		{#if !groups.length}
			<p class="subhead mt-10 text-center text-label2">
				{query.trim() ? `Aucun résultat pour « ${query.trim()} ».` : 'Aucune conversation pour ce bac.'}
			</p>
		{:else}
			{#each groups as group (group.label)}
				<Section header={group.label} class="!mb-5">
					{#each group.threads as t (t.id)}
						<ThreadRow
							thread={t}
							tank={tankOf(t.aquariumId)}
							current={t.id === currentId}
							{selecting}
							selected={selected.includes(t.id)}
							onopen={() => onopen(t.id)}
							ontoggle={() => toggle(t.id)}
							onrename={() => onrename(t)}
							ondelete={() => remove([t])}
						/>
					{/each}
				</Section>
			{/each}
			{#if !selecting}
				<p class="footnote -mt-2 px-4 text-label2">Glisse une conversation vers la gauche pour la renommer ou la supprimer, ou garde le doigt dessus. Supprimer une conversation supprime aussi ses photos.</p>
			{/if}
		{/if}

		{#if selecting}
			<!-- Barre d'actions de la sélection : collée en bas de la feuille, au-dessus de la zone sûre. -->
			<div class="bar-material sticky bottom-0 -mx-4 mt-4 flex items-center justify-between gap-3 px-4 pt-3" style="padding-bottom: max(env(safe-area-inset-bottom), 12px)">
				<button class="btn-plain" onclick={toggleAll}>{allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}</button>
				<button
					class="pressable inline-flex h-11 items-center gap-2 rounded-full bg-red px-5 font-semibold text-white disabled:opacity-35"
					disabled={!selected.length}
					onclick={removeSelected}
				>
					<Icon name="trash" size={19} />Supprimer{selected.length ? ` (${selected.length})` : ''}
				</button>
			</div>
		{/if}
	{/if}
</Sheet>

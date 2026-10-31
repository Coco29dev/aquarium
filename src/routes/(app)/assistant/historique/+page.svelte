<script lang="ts">
	import { onMount } from 'svelte';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { api } from '$lib/client/api';
	import { groupByRecency, threadLabel, type ThreadSummary } from '$lib/domain/assistant';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import SwipeRow from '$lib/ios/SwipeRow.svelte';
	import SearchField from '$lib/ios/SearchField.svelte';
	import Spinner from '$lib/ios/Spinner.svelte';

	/** Sans accents ni majuscules, pour une recherche tolérante. */
	const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

	let threads = $state<ThreadSummary[]>([]);
	let loading = $state(true);
	let failure = $state('');
	let query = $state('');

	const tankName = (id: number) => store.view?.aquariums.find((a) => a.id === id)?.name ?? 'Bac supprimé';
	const filtered = $derived.by(() => {
		const q = normalize(query);
		return q ? threads.filter((t) => normalize(`${threadLabel(t)} ${t.preview} ${tankName(t.aquariumId)}`).includes(q)) : threads;
	});
	const groups = $derived(groupByRecency(filtered));
	const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
	const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
	const when = (t: ThreadSummary) => (Date.now() - new Date(t.updatedAt).getTime() < 24 * 3600_000 ? time(t.updatedAt) : day(t.updatedAt));

	onMount(async () => {
		try {
			threads = await api<ThreadSummary[]>('GET', '/api/assistant/threads');
		} catch (e) {
			failure = e instanceof Error ? e.message : 'Chargement impossible';
		} finally {
			loading = false;
		}
	});

	async function remove(t: ThreadSummary) {
		const ok = await ui.confirm({ title: 'Supprimer la conversation ?', message: `« ${threadLabel(t)} » et ses photos seront supprimées.`, confirmLabel: 'Supprimer', destructive: true });
		if (!ok) return;
		try {
			await api('DELETE', `/api/assistant/threads/${t.id}`);
			threads = threads.filter((x) => x.id !== t.id);
		} catch (e) {
			ui.show(e instanceof Error ? e.message : 'Suppression impossible');
		}
	}
</script>

<svelte:head><title>Historique · Assistant</title></svelte:head>

<NavBar title="Historique" back={{ href: '/assistant', label: 'Assistant' }}>
	<SearchField bind:value={query} placeholder="Rechercher une conversation" />
</NavBar>

{#if loading}
	<div class="mt-16 grid place-items-center"><Spinner /></div>
{:else if failure}
	<p class="subhead mt-6 rounded-[16px] bg-bg2 px-4 py-3 text-red">{failure}</p>
{:else if !threads.length}
	<p class="subhead mt-12 text-center text-label2">Aucune conversation pour l'instant. Pose une question à l'assistant, elle apparaîtra ici.</p>
{:else if !groups.length}
	<p class="subhead mt-12 text-center text-label2">Aucun résultat pour « {query} ».</p>
{:else}
	{#each groups as group (group.label)}
		<Section header={group.label} class="mt-4">
			{#each group.threads as t (t.id)}
				<SwipeRow trailing={[{ label: 'Supprimer', icon: 'trash', color: 'var(--red)', onaction: () => remove(t) }]}>
					<Row bare href="/assistant?c={t.id}" icon="chat" iconColor="var(--indigo)" title={threadLabel(t)} subtitle={tankName(t.aquariumId)} value={when(t)} chevron />
				</SwipeRow>
			{/each}
		</Section>
	{/each}
	<p class="footnote -mt-4 mb-8 px-4 text-label2">Fais glisser une conversation vers la gauche pour la supprimer.</p>
{/if}

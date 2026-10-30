<script lang="ts">
	import { onMount } from 'svelte';
	import { store } from '$lib/client/store.svelte';
	import { createResource, deleteResource, listResource, toNumber, toText } from '$lib/client/api';
	import { dayInParis } from '$lib/domain/dates';

	interface Expense { id: number; scopeId: number | null; label: string; category: string | null; amount: number; spentOn: string }

	const CATEGORIES = ['Poissons / coraux', 'Plantes', 'Matériel', 'Alimentation', 'Produits / dosage', 'Eau / sel', 'Autre'];
	const aquariums = $derived(store.view?.aquariums ?? []);
	const nameOf = (id: number | null) => aquariums.find((a) => a.id === id)?.name ?? 'Général';

	let expenses = $state<Expense[]>([]);
	let message = $state('');
	let filter = $state<'all' | number>('all');

	async function load() {
		try {
			expenses = await listResource<Expense>('expenses');
			message = '';
		} catch (e) {
			message = (e as Error).message;
		}
	}
	onMount(load);

	async function add(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		const f = new FormData(form);
		try {
			const aquarium = toNumber(f.get('aquarium'));
			await createResource('expenses', aquarium, {
				label: f.get('label'),
				category: toText(f.get('category')),
				amount: toNumber(f.get('amount')),
				spentOn: toText(f.get('spentOn')) ?? dayInParis()
			});
			form.reset();
			await load();
		} catch (e) {
			message = (e as Error).message;
		}
	}

	const shown = $derived(expenses.filter((e) => filter === 'all' || e.scopeId === filter));
	const total = $derived(shown.reduce((sum, e) => sum + e.amount, 0));
	const thisMonth = $derived(
		shown.filter((e) => e.spentOn.slice(0, 7) === dayInParis().slice(0, 7)).reduce((sum, e) => sum + e.amount, 0)
	);
	const byCategory = $derived(
		[...shown.reduce((m, e) => m.set(e.category ?? 'Autre', (m.get(e.category ?? 'Autre') ?? 0) + e.amount), new Map<string, number>())].sort(
			(a, b) => b[1] - a[1]
		)
	);
	const eur = (v: number) => v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

	const field = 'w-full rounded-lg border-2 border-edge bg-surface px-3 py-2 text-sm';
</script>

<svelte:head><title>Dépenses · Bulle</title></svelte:head>

<h1 class="mb-4 text-2xl font-semibold">Dépenses</h1>
{#if message}<p class="mb-4 rounded-lg bg-bad-soft p-3 text-sm text-bad" role="alert">{message}</p>{/if}

<select bind:value={filter} class="{field} mb-4">
	<option value="all">Tous les aquariums</option>
	{#each aquariums as a (a.id)}<option value={a.id}>{a.name}</option>{/each}
</select>

<div class="mb-6 grid grid-cols-2 gap-3 text-center">
	<div class="card p-3"><p class="text-xs text-muted">Ce mois-ci</p><p class="text-lg font-semibold">{eur(thisMonth)}</p></div>
	<div class="card p-3"><p class="text-xs text-muted">Total</p><p class="text-lg font-semibold">{eur(total)}</p></div>
</div>

{#if byCategory.length}
	<ul class="mb-6 flex flex-col gap-1 text-sm">
		{#each byCategory as [category, sum] (category)}
			<li class="flex justify-between text-muted"><span>{category}</span><span>{eur(sum)}</span></li>
		{/each}
	</ul>
{/if}

<form onsubmit={add} class="mb-6 grid grid-cols-6 gap-2 rounded-lg border-2 border-dashed border-edge p-3">
	<input name="label" required placeholder="Libellé" class="{field} col-span-4" />
	<input name="amount" required inputmode="decimal" placeholder="€" class="{field} col-span-2" />
	<select name="category" class="{field} col-span-3">{#each CATEGORIES as c (c)}<option>{c}</option>{/each}</select>
	<select name="aquarium" class="{field} col-span-3"><option value="">Général</option>{#each aquariums as a (a.id)}<option value={a.id}>{a.name}</option>{/each}</select>
	<input name="spentOn" type="date" class="{field} col-span-3" aria-label="Date" />
	<button class="col-span-3 rounded-lg btn-primary px-4 py-2 text-sm font-medium">Ajouter</button>
</form>

<ul class="flex flex-col gap-2">
	{#each shown as e (e.id)}
		<li class="flex items-center gap-3 card p-3">
			<div class="min-w-0 flex-1">
				<p class="truncate">{e.label}</p>
				<p class="text-xs text-muted">{new Date(e.spentOn).toLocaleDateString('fr-FR')} · {e.category ?? 'Autre'} · {nameOf(e.scopeId)}</p>
			</div>
			<span class="shrink-0 font-medium">{eur(e.amount)}</span>
			<button class="text-xs text-bad underline" onclick={() => confirm(`Supprimer « ${e.label} » ?`) && deleteResource('expenses', e.id).then(load)}>×</button>
		</li>
	{/each}
</ul>

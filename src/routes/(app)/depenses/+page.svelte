<script lang="ts">
	import { onMount } from 'svelte';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { createResource, deleteResource, listResource, toNumber, toText } from '$lib/client/api';
	import { dayInParis } from '$lib/domain/dates';
	import { TANK_TONE } from '$lib/ui';
	import Icon from '$lib/components/Icon.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';

	interface Expense { id: number; scopeId: number | null; label: string; category: string | null; amount: number; spentOn: string }

	const CATEGORIES = ['Poissons / coraux', 'Plantes', 'Matériel', 'Alimentation', 'Produits / dosage', 'Eau / sel', 'Autre'];
	const aquariums = $derived(store.view?.aquariums ?? []);
	const tankOf = (id: number | null) => aquariums.find((a) => a.id === id);

	let expenses = $state<Expense[]>([]);
	let loaded = $state(false);
	let message = $state('');
	let filter = $state<'all' | number>('all');
	let adding = $state(false);
	let busy = $state(false);

	async function load() {
		try {
			expenses = await listResource<Expense>('expenses');
			message = '';
		} catch (e) {
			message = (e as Error).message;
		} finally {
			loaded = true;
		}
	}
	onMount(load);

	async function add(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		const f = new FormData(form);
		busy = true;
		try {
			const aquarium = toNumber(f.get('aquarium'));
			await createResource('expenses', aquarium, {
				label: f.get('label'),
				category: toText(f.get('category')),
				amount: toNumber(f.get('amount')),
				spentOn: toText(f.get('spentOn')) ?? dayInParis()
			});
			ui.show(`« ${f.get('label')} » ajouté`);
			form.reset();
			adding = false;
			await load();
		} catch (e) {
			message = (e as Error).message;
		} finally {
			busy = false;
		}
	}

	async function remove(e: Expense) {
		if (!confirm(`Supprimer « ${e.label} » ?`)) return;
		try {
			await deleteResource('expenses', e.id);
			ui.show(`« ${e.label} » supprimé`);
			await load();
		} catch (err) {
			message = (err as Error).message;
		}
	}

	const month = dayInParis().slice(0, 7);
	const shown = $derived(expenses.filter((e) => filter === 'all' || e.scopeId === filter));
	const total = $derived(shown.reduce((sum, e) => sum + e.amount, 0));
	const thisMonth = $derived(shown.filter((e) => e.spentOn.slice(0, 7) === month).reduce((sum, e) => sum + e.amount, 0));
	const byCategory = $derived(
		[...shown.reduce((m, e) => m.set(e.category ?? 'Autre', (m.get(e.category ?? 'Autre') ?? 0) + e.amount), new Map<string, number>())].sort(
			(a, b) => b[1] - a[1]
		)
	);
	const maxCategory = $derived(byCategory.length ? byCategory[0][1] : 1);

	// Regroupement par mois, du plus récent au plus ancien.
	const byMonth = $derived.by(() => {
		const groups = new Map<string, Expense[]>();
		for (const e of [...shown].sort((a, b) => b.spentOn.localeCompare(a.spentOn))) {
			const key = e.spentOn.slice(0, 7);
			groups.set(key, [...(groups.get(key) ?? []), e]);
		}
		return [...groups].map(([key, list]) => ({
			key,
			label: new Date(`${key}-15T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
			list,
			sum: list.reduce((s, e) => s + e.amount, 0)
		}));
	});

	const eur = (v: number) => v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
	const monthName = new Date().toLocaleDateString('fr-FR', { month: 'long', timeZone: 'Europe/Paris' });
</script>

<svelte:head><title>Dépenses · Bulle</title></svelte:head>

<div class="rise">
	<PageHeader title="Dépenses" kicker="Atelier" back="/outils" backLabel="Atelier" />
</div>

{#if message}<p class="mb-4 rounded-lg border-2 border-bad bg-bad-soft p-3 text-sm font-bold text-bad" role="alert">{message}</p>{/if}

<div class="rise -mx-5 mb-5 flex gap-2 overflow-x-auto px-5 pb-1" style="scrollbar-width: none; animation-delay: 30ms">
	<button
		class="shrink-0 rounded-full border-2 border-edge px-3 py-1 text-sm font-bold {filter === 'all' ? 'bg-ink text-on-ink' : 'bg-surface'}"
		aria-pressed={filter === 'all'}
		onclick={() => (filter = 'all')}
	>
		Tous
	</button>
	{#each aquariums as a (a.id)}
		{@const on = filter === a.id}
		<button
			class="flex shrink-0 items-center gap-1.5 rounded-full border-2 border-edge px-3 py-1 text-sm font-bold {on ? 'bg-ink text-on-ink' : 'bg-surface'}"
			aria-pressed={on}
			onclick={() => (filter = a.id)}
		>
			<span class="h-2.5 w-2.5 rounded-full border border-edge" style="background: {TANK_TONE[a.waterType]}"></span>
			{a.name}
		</button>
	{/each}
</div>

<section class="card rise mb-6 overflow-hidden" style="animation-delay: 60ms">
	<div class="border-b-2 border-edge bg-sun px-4 py-4 text-[#16202e]">
		<p class="num text-[11px] uppercase tracking-wider">En {monthName}</p>
		<p class="num mt-1 text-[2.6rem] leading-none">{eur(thisMonth)}</p>
	</div>
	<div class="flex items-center justify-between px-4 py-3 text-sm">
		<span class="text-muted">Depuis le début</span>
		<span class="num font-bold">{eur(total)}</span>
	</div>
	{#if byCategory.length}
		<ul class="flex flex-col gap-2.5 border-t-2 border-edge px-4 py-4">
			{#each byCategory as [category, sum] (category)}
				<li class="text-sm">
					<div class="mb-1 flex justify-between gap-3">
						<span class="truncate first-letter:uppercase">{category}</span>
						<span class="num shrink-0">{eur(sum)}</span>
					</div>
					<div class="h-2.5 overflow-hidden rounded-full border-[1.5px] border-edge bg-surface2">
						<div class="h-full bg-ink" style="width: {Math.max(4, (sum / maxCategory) * 100)}%"></div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section class="rise mb-8" style="animation-delay: 90ms">
	{#if adding}
		<form onsubmit={add} class="card flex flex-col gap-3 p-4">
			<div class="flex items-center justify-between">
				<h2 class="display text-xl">Nouvel achat</h2>
				<button type="button" class="grid h-9 w-9 place-items-center rounded-full border-2 border-edge" aria-label="Fermer" onclick={() => (adding = false)}>
					<Icon name="close" size={18} />
				</button>
			</div>
			<input name="label" required placeholder="Ce que tu as acheté" class="field" aria-label="Libellé" />
			<div class="grid grid-cols-2 gap-2">
				<label class="flex items-center gap-2">
					<input name="amount" required inputmode="decimal" placeholder="0,00" class="field num" aria-label="Montant en euros" />
					<span class="font-bold text-muted">€</span>
				</label>
				<input name="spentOn" type="date" value={dayInParis()} class="field" aria-label="Date" />
			</div>
			<select name="category" class="field" aria-label="Catégorie">{#each CATEGORIES as c (c)}<option>{c}</option>{/each}</select>
			<select name="aquarium" class="field" aria-label="Bac">
				<option value="">Général</option>
				{#each aquariums as a (a.id)}<option value={a.id} selected={filter === a.id}>{a.name}</option>{/each}
			</select>
			<button class="btn" disabled={busy}>Ajouter</button>
		</form>
	{:else}
		<button class="btn w-full" onclick={() => (adding = true)}><Icon name="plus" size={20} />Ajouter un achat</button>
	{/if}
</section>

{#if loaded && byMonth.length === 0}
	<p class="hand text-center text-xl text-muted">Aucun achat noté pour l’instant.</p>
{/if}

{#each byMonth as m (m.key)}
	<section class="mb-6">
		<div class="mb-2 flex items-baseline justify-between">
			<h2 class="tape first-letter:uppercase">{m.label}</h2>
			<span class="num text-sm font-bold">{eur(m.sum)}</span>
		</div>
		<ul class="card divide-y-2 divide-line">
			{#each m.list as e (e.id)}
				{@const tank = tankOf(e.scopeId)}
				<li class="flex items-center gap-3 px-4 py-3">
					<div class="min-w-0 flex-1">
						<p class="truncate font-bold">{e.label}</p>
						<p class="flex items-center gap-1.5 text-xs text-muted">
							<span class="num shrink-0 whitespace-nowrap">{new Date(e.spentOn).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
							<span aria-hidden="true">·</span>
							<span class="truncate first-letter:uppercase">{e.category ?? 'Autre'}</span>
							<span aria-hidden="true">·</span>
							{#if tank}<span class="h-2 w-2 shrink-0 rounded-full border border-edge" style="background: {TANK_TONE[tank.waterType]}"></span>{/if}
							<span class="truncate">{tank?.name ?? 'Général'}</span>
						</p>
					</div>
					<span class="num shrink-0 font-bold">{eur(e.amount)}</span>
					<button class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted active:bg-surface2" aria-label="Supprimer « {e.label} »" onclick={() => remove(e)}>
						<Icon name="trash" size={18} />
					</button>
				</li>
			{/each}
		</ul>
	</section>
{/each}

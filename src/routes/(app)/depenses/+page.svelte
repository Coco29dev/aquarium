<script lang="ts">
	import { onMount } from 'svelte';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { createResource, deleteResource, listResource, toNumber, toText } from '$lib/client/api';
	import { dayInParis } from '$lib/domain/dates';
	import { TANK_TONE } from '$lib/ui';
	import Icon from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Sheet from '$lib/ios/Sheet.svelte';
	import Segmented from '$lib/ios/Segmented.svelte';
	import InputRow from '$lib/ios/InputRow.svelte';
	import SelectRow from '$lib/ios/SelectRow.svelte';

	interface Expense { id: number; scopeId: number | null; label: string; category: string | null; amount: number; spentOn: string }

	const CATEGORIES = ['Poissons / coraux', 'Plantes', 'Matériel', 'Alimentation', 'Produits / dosage', 'Eau / sel', 'Autre'];
	const aquariums = $derived(store.view?.aquariums ?? []);
	const tankOf = (id: number | null) => aquariums.find((a) => a.id === id);

	let expenses = $state<Expense[]>([]);
	let loaded = $state(false);
	let message = $state('');
	// 0 : tous les bacs.
	let filter = $state<number>(0);
	let adding = $state(false);
	let editing = $state(false);
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
			ui.show(`${f.get('label')} ajouté`, undefined, 'check');
			adding = false;
			await load();
		} catch (e) {
			message = (e as Error).message;
		} finally {
			busy = false;
		}
	}

	async function remove(e: Expense) {
		const ok = await ui.confirm({
			title: `Supprimer « ${e.label} » ?`,
			message: `${eur(e.amount)} le ${new Date(e.spentOn).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.`,
			confirmLabel: 'Supprimer',
			destructive: true
		});
		if (!ok) return;
		try {
			await deleteResource('expenses', e.id);
			ui.show(`${e.label} supprimé`);
			await load();
		} catch (err) {
			message = (err as Error).message;
		}
	}

	const month = dayInParis().slice(0, 7);
	const shown = $derived(expenses.filter((e) => filter === 0 || e.scopeId === filter));
	const total = $derived(shown.reduce((sum, e) => sum + e.amount, 0));
	const thisMonth = $derived(shown.filter((e) => e.spentOn.slice(0, 7) === month).reduce((sum, e) => sum + e.amount, 0));
	const byCategory = $derived(
		[...shown.reduce((m, e) => m.set(e.category ?? 'Autre', (m.get(e.category ?? 'Autre') ?? 0) + e.amount), new Map<string, number>())].sort(
			(a, b) => b[1] - a[1]
		)
	);

	// Six derniers mois pour le graphique en barres.
	const months = $derived.by(() => {
		const [y, m] = month.split('-').map(Number);
		return Array.from({ length: 6 }, (_, i) => {
			const d = new Date(Date.UTC(y, m - 1 - (5 - i), 15));
			const key = d.toISOString().slice(0, 7);
			const sum = shown.filter((e) => e.spentOn.slice(0, 7) === key).reduce((s, e) => s + e.amount, 0);
			return { key, sum, label: d.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' }).replace('.', '') };
		});
	});
	const peak = $derived(Math.max(1, ...months.map((m) => m.sum)));

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
	const filterOptions = $derived([{ value: 0, label: 'Tous' }, ...aquariums.map((a) => ({ value: a.id, label: a.name }))]);
	const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
</script>

<svelte:head><title>Dépenses · Aquarium</title></svelte:head>

<NavBar title="Dépenses" back={{ href: '/outils', label: 'Atelier' }}>
	{#snippet trailing()}
		{#if expenses.length}
			<button class="btn-plain px-2" onclick={() => (editing = !editing)}>{editing ? 'OK' : 'Modifier'}</button>
		{/if}
		<button class="btn-plain grid h-10 w-10 place-items-center" aria-label="Ajouter un achat" onclick={() => (adding = true)}>
			<Icon name="plus" size={24} weight={2.2} />
		</button>
	{/snippet}
</NavBar>

{#if aquariums.length}
	<div class="mb-5 mt-1"><Segmented options={filterOptions} bind:value={filter} label="Bac" /></div>
{/if}

{#if message}<p class="subhead mb-4 rounded-2xl bg-red/12 px-4 py-3 text-red" role="alert">{message}</p>{/if}

<!-- Total du mois, façon Forme / Cartes -->
<section class="group mb-8 p-4">
	<p class="subhead font-semibold text-label2">En {monthName}</p>
	<p class="rounded-num mt-0.5 text-[44px] font-bold leading-[1.05] tracking-tight text-green">{eur(thisMonth)}</p>
	<p class="footnote mt-1 text-label2">Depuis le début : <span class="rounded-num font-semibold text-label">{eur(total)}</span></p>

	<div class="mt-5 flex h-32 items-end gap-2.5" aria-label="Dépenses des six derniers mois">
		{#each months as m (m.key)}
			{@const current = m.key === month}
			<div class="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
				<span class="caption2 rounded-num font-semibold {current ? 'text-green' : 'text-label3'}">{m.sum ? Math.round(m.sum) : ''}</span>
				<div
					class="w-full max-w-9 rounded-[7px] transition-[height] duration-500 {current ? 'bg-green' : 'bg-fill'}"
					style="height: {m.sum ? Math.max(6, (m.sum / peak) * 100) : 3}%"
				></div>
				<span class="caption1 font-semibold {current ? 'text-label' : 'text-label2'}">{m.label}</span>
			</div>
		{/each}
	</div>
</section>

{#if byCategory.length}
	<Section header="Par catégorie">
		{#each byCategory as [category, sum] (category)}
			<Row title={cap(category)} value={eur(sum)} />
		{/each}
	</Section>
{/if}

{#if loaded && byMonth.length === 0}
	<div class="flex flex-col items-center px-8 py-10 text-center">
		<span class="mb-3 text-label3"><Icon name="euro" size={44} weight={1.6} /></span>
		<p class="title3">Aucun achat</p>
		<p class="subhead mt-1 text-label2">Note tes achats pour suivre ce que te coûtent tes bacs.</p>
		<button class="btn-tinted mt-5" onclick={() => (adding = true)}>Ajouter un achat</button>
	</div>
{/if}

{#each byMonth as m (m.key)}
	<Section header="{cap(m.label)} · {eur(m.sum)}">
		{#each m.list as e (e.id)}
			{@const tank = tankOf(e.scopeId)}
			<Row>
				{#snippet leading()}
					{#if editing}
						<button
							class="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-red text-white"
							style="animation: pop-in 200ms both"
							aria-label="Supprimer « {e.label} »"
							onclick={() => remove(e)}
						>
							<span class="h-[2.5px] w-3 rounded-full bg-white"></span>
						</button>
					{/if}
				{/snippet}
				{#snippet trailing()}
					<span class="body rounded-num shrink-0 font-semibold">{eur(e.amount)}</span>
				{/snippet}
				<p class="body truncate">{e.label}</p>
				<p class="footnote flex min-w-0 items-center gap-1.5 text-label2">
					<span class="shrink-0">{new Date(e.spentOn).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
					<span aria-hidden="true">·</span>
					<span class="truncate">{cap(e.category ?? 'Autre')}</span>
					{#if tank}
						<span aria-hidden="true">·</span>
						<span class="truncate font-semibold" style="color: {TANK_TONE[tank.waterType]}">{tank.name}</span>
					{/if}
				</p>
			</Row>
		{/each}
	</Section>
{/each}

<Sheet open={adding} title="Nouvel achat" onclose={() => (adding = false)} action={{ label: 'Ajouter', onclick: () => (document.getElementById('expense-form') as HTMLFormElement | null)?.requestSubmit(), disabled: busy }}>
	{#if adding}
		<form id="expense-form" onsubmit={add}>
			<Section>
				<InputRow label="Ce que tu as acheté" name="label" required wide />
				<InputRow label="Montant" name="amount" required inputmode="decimal" placeholder="0,00" unit="€" />
				<li>
					<label class="flex min-h-11 items-center gap-3 pl-4">
						<span class="row-body flex min-h-11 flex-1 items-center gap-2 py-1.5 pr-4">
							<span class="body flex-1">Date</span>
							<input name="spentOn" type="date" value={dayInParis()} class="body rounded-lg bg-fill3 px-2.5 py-1 text-right outline-none" />
						</span>
					</label>
				</li>
			</Section>
			<Section>
				<SelectRow label="Catégorie" name="category" value={CATEGORIES[0]} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
				<SelectRow
					label="Bac"
					name="aquarium"
					value={filter ? String(filter) : ''}
					options={[{ value: '', label: 'Général' }, ...aquariums.map((a) => ({ value: String(a.id), label: a.name }))]}
				/>
			</Section>
		</form>
	{/if}
</Sheet>

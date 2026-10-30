<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { createResource, deleteResource, listResource, toNumber, toText, updateResource } from '$lib/client/api';
	import { addDays, dayInParis, daysBetween } from '$lib/domain/dates';

	interface Inhabitant { id: number; kind: 'faune' | 'flore'; species: string; quantity: number; arrivedOn: string | null; leftOn: string | null; notes: string | null }
	interface Equipment { id: number; name: string; category: string | null; purchasedOn: string | null; price: number | null; warrantyUntil: string | null; notes: string | null }
	interface Consumable { id: number; scopeId: number; name: string; installedOn: string | null; replaceEveryDays: number | null }

	const id = $derived(Number(page.params.id));
	const aquarium = $derived(store.view?.aquariums.find((a) => a.id === id));
	const today = dayInParis();

	let inhabitants = $state<Inhabitant[]>([]);
	let equipment = $state<Equipment[]>([]);
	let consumables = $state<Consumable[]>([]);
	let message = $state('');
	let loading = $state(true);

	async function load() {
		try {
			[inhabitants, equipment, consumables] = await Promise.all([
				listResource<Inhabitant>('inhabitants', id),
				listResource<Equipment>('equipment', id),
				listResource<Consumable>('consumables')
			]);
			message = '';
		} catch (e) {
			message = (e as Error).message;
		} finally {
			loading = false;
		}
	}
	onMount(load);

	async function act(action: () => Promise<unknown>) {
		try {
			await action();
			await load();
		} catch (e) {
			message = (e as Error).message;
		}
	}

	function submit(handler: (f: FormData) => Promise<unknown>) {
		return (event: SubmitEvent) => {
			event.preventDefault();
			const form = event.currentTarget as HTMLFormElement;
			void act(async () => {
				await handler(new FormData(form));
				form.reset();
			});
		};
	}

	const addInhabitant = submit((f) =>
		createResource('inhabitants', id, {
			kind: f.get('kind'),
			species: f.get('species'),
			quantity: toNumber(f.get('quantity')) ?? 1,
			arrivedOn: toText(f.get('arrivedOn')) ?? today
		})
	);
	const addEquipment = submit((f) =>
		createResource('equipment', id, {
			name: f.get('name'),
			category: toText(f.get('category')),
			purchasedOn: toText(f.get('purchasedOn')),
			price: toNumber(f.get('price')),
			warrantyUntil: toText(f.get('warrantyUntil'))
		})
	);
	const addConsumable = (equipmentId: number) =>
		submit((f) =>
			createResource('consumables', equipmentId, {
				name: f.get('name'),
				replaceEveryDays: toNumber(f.get('every')),
				installedOn: today
			})
		);

	const active = $derived(inhabitants.filter((i) => !i.leftOn));
	const gone = $derived(inhabitants.filter((i) => i.leftOn));

	function warranty(until: string | null): { label: string; cls: string } | null {
		if (!until) return null;
		const left = daysBetween(today, until);
		if (left < 0) return { label: 'garantie expirée', cls: 'text-slate-500' };
		return { label: `garantie encore ${left} j`, cls: left < 60 ? 'text-amber-300' : 'text-emerald-300' };
	}

	function replaceOn(c: Consumable): { label: string; cls: string } | null {
		if (!c.installedOn || !c.replaceEveryDays) return null;
		const due = addDays(c.installedOn, c.replaceEveryDays);
		const left = daysBetween(today, due);
		return left < 0
			? { label: `à remplacer (retard ${-left} j)`, cls: 'text-red-300' }
			: { label: `à remplacer dans ${left} j`, cls: left < 14 ? 'text-amber-300' : 'text-slate-400' };
	}

	const field = 'w-full rounded-lg border border-cyan-900 bg-slate-950 px-3 py-2 text-sm';
	const btn = 'rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium active:bg-cyan-800';
	const link = 'text-xs text-cyan-300 underline';
	const danger = 'text-xs text-red-300 underline';
</script>

<svelte:head><title>Inventaire · {aquarium?.name ?? 'Aquarium'}</title></svelte:head>

<a href="/aquariums/{id}" class="text-sm text-cyan-300 underline">← {aquarium?.name ?? 'Aquarium'}</a>
<h1 class="mb-6 mt-2 text-2xl font-semibold">Inventaire</h1>
{#if message}<p class="mb-4 rounded-lg bg-red-950 p-3 text-sm text-red-200" role="alert">{message}</p>{/if}

<section class="mb-8">
	<h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">Faune et flore</h2>
	<ul class="flex flex-col gap-2">
		{#each active as i (i.id)}
			<li class="flex items-center gap-3 rounded-lg bg-slate-900 p-3">
				<span class="text-xl" aria-hidden="true">{i.kind === 'faune' ? '🐟' : '🌿'}</span>
				<div class="min-w-0 flex-1">
					<p class="truncate">{i.quantity} × {i.species}</p>
					<p class="text-xs text-slate-400">depuis le {i.arrivedOn ? new Date(i.arrivedOn).toLocaleDateString('fr-FR') : '?'}</p>
				</div>
				<div class="flex flex-col items-end gap-1">
					<button class={link} onclick={() => act(() => updateResource('inhabitants', i.id, { leftOn: today }))}>Parti / mort</button>
					<button class={danger} onclick={() => confirm(`Supprimer « ${i.species} » ?`) && act(() => deleteResource('inhabitants', i.id))}>Supprimer</button>
				</div>
			</li>
		{:else}
			{#if !loading}<li class="text-sm text-slate-400">Aucun habitant.</li>{/if}
		{/each}
	</ul>
	<form onsubmit={addInhabitant} class="mt-3 grid grid-cols-6 gap-2 rounded-lg border border-dashed border-cyan-900 p-3">
		<select name="kind" class="{field} col-span-2"><option value="faune">Faune</option><option value="flore">Flore</option></select>
		<input name="species" required placeholder="Espèce" class="{field} col-span-3" />
		<input name="quantity" inputmode="numeric" placeholder="Qté" class="{field} col-span-1" />
		<label class="col-span-3 text-xs text-slate-400">Arrivée<input name="arrivedOn" type="date" class={field} /></label>
		<button class="{btn} col-span-3 self-end">Ajouter</button>
	</form>
	{#if gone.length}
		<details class="mt-3 text-sm text-slate-400">
			<summary>Partis ({gone.length})</summary>
			<ul class="mt-2 flex flex-col gap-1">
				{#each gone as i (i.id)}
					<li class="flex justify-between"><span>{i.quantity} × {i.species}</span><span>{i.leftOn ? new Date(i.leftOn).toLocaleDateString('fr-FR') : ''}</span></li>
				{/each}
			</ul>
		</details>
	{/if}
</section>

<section class="mb-8">
	<h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">Matériel</h2>
	<ul class="flex flex-col gap-3">
		{#each equipment as e (e.id)}
			{@const w = warranty(e.warrantyUntil)}
			<li class="rounded-lg bg-slate-900 p-3">
				<div class="flex items-start justify-between gap-2">
					<div class="min-w-0">
						<p class="font-medium">{e.name}</p>
						<p class="text-xs text-slate-400">
							{e.category ?? ''}{e.purchasedOn ? ` · acheté le ${new Date(e.purchasedOn).toLocaleDateString('fr-FR')}` : ''}{e.price != null ? ` · ${e.price.toLocaleString('fr-FR')} €` : ''}
						</p>
						{#if w}<p class="text-xs {w.cls}">{w.label}</p>{/if}
					</div>
					<button class={danger} onclick={() => confirm(`Supprimer « ${e.name} » et ses consommables ?`) && act(() => deleteResource('equipment', e.id))}>Supprimer</button>
				</div>
				<ul class="mt-2 flex flex-col gap-1 border-t border-slate-800 pt-2">
					{#each consumables.filter((c) => c.scopeId === e.id) as c (c.id)}
						{@const r = replaceOn(c)}
						<li class="flex items-center justify-between gap-2 text-sm">
							<span class="min-w-0 truncate">{c.name}{#if r}<span class="ml-2 text-xs {r.cls}">{r.label}</span>{/if}</span>
							<span class="flex shrink-0 gap-3">
								<button class={link} onclick={() => act(() => updateResource('consumables', c.id, { installedOn: today }))}>Remplacé</button>
								<button class={danger} onclick={() => act(() => deleteResource('consumables', c.id))}>×</button>
							</span>
						</li>
					{/each}
				</ul>
				<form onsubmit={addConsumable(e.id)} class="mt-2 grid grid-cols-6 gap-2">
					<input name="name" required placeholder="Consommable (ex. charbon)" class="{field} col-span-3" />
					<input name="every" inputmode="numeric" placeholder="Tous les (j)" class="{field} col-span-2" />
					<button class="{btn} col-span-1 px-0">+</button>
				</form>
			</li>
		{:else}
			{#if !loading}<li class="text-sm text-slate-400">Aucun matériel.</li>{/if}
		{/each}
	</ul>
	<form onsubmit={addEquipment} class="mt-3 grid grid-cols-6 gap-2 rounded-lg border border-dashed border-cyan-900 p-3">
		<input name="name" required placeholder="Nouveau matériel" class="{field} col-span-4" />
		<input name="category" placeholder="Type" class="{field} col-span-2" />
		<label class="col-span-3 text-xs text-slate-400">Achat<input name="purchasedOn" type="date" class={field} /></label>
		<label class="col-span-3 text-xs text-slate-400">Fin de garantie<input name="warrantyUntil" type="date" class={field} /></label>
		<input name="price" inputmode="decimal" placeholder="Prix (€)" class="{field} col-span-2" />
		<button class="{btn} col-span-4">Ajouter</button>
	</form>
</section>

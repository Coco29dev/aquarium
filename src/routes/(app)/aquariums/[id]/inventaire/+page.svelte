<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import SpeciesPicker from '$lib/components/SpeciesPicker.svelte';
	import TankHeader from '$lib/components/TankHeader.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { api, createResource, deleteResource, listResource, toNumber, toText, updateResource } from '$lib/client/api';
	import { consumableLife } from '$lib/domain/consumables';
	import { speciesName } from '$lib/domain/species';
	import { dayInParis, daysBetween } from '$lib/domain/dates';
	import { TANK_TONE, fmt } from '$lib/ui';
	import type { Species } from '$lib/types';

	interface Inhabitant { id: number; kind: 'faune' | 'flore'; species: string; speciesId: number | null; quantity: number; arrivedOn: string | null; leftOn: string | null; notes: string | null }
	interface Equipment { id: number; name: string; category: string | null; purchasedOn: string | null; price: number | null; warrantyUntil: string | null; notes: string | null }
	interface Consumable { id: number; scopeId: number; name: string; installedOn: string | null; replaceEveryDays: number | null; unitPrice: number | null }

	const id = $derived(Number(page.params.id));
	const aquarium = $derived(store.view?.aquariums.find((a) => a.id === id));
	const today = dayInParis();

	let inhabitants = $state<Inhabitant[]>([]);
	let equipment = $state<Equipment[]>([]);
	let consumables = $state<Consumable[]>([]);
	let message = $state('');
	let loading = $state(true);

	// Feuilles d'ajout repliées par défaut ; une seule ligne dépliée à la fois.
	let adding = $state<'habitant' | 'materiel' | null>(null);
	let openRow = $state<string | null>(null);
	let addingConsumable = $state<number | null>(null);
	let linking = $state<number | null>(null);

	let kind = $state<'faune' | 'flore'>('faune');
	let speciesText = $state('');
	let pickedSpecies = $state<Species | null>(null);
	let quantity = $state(1);

	function pick(species: Species) {
		pickedSpecies = species;
		speciesText = speciesName(species);
		if (species.kind === 'plante') kind = 'flore';
	}

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

	async function act(action: () => Promise<unknown>, done?: string) {
		try {
			await action();
			await load();
			if (done) ui.show(done);
		} catch (e) {
			message = (e as Error).message;
		}
	}

	function submit(handler: (f: FormData) => Promise<unknown>, done: string, after?: () => void) {
		return (event: SubmitEvent) => {
			event.preventDefault();
			const form = event.currentTarget as HTMLFormElement;
			void act(async () => {
				await handler(new FormData(form));
				form.reset();
				after?.();
			}, done);
		};
	}

	const addInhabitant = submit(
		async (f) => {
			await createResource('inhabitants', id, {
				kind: pickedSpecies?.kind === 'plante' ? 'flore' : kind,
				species: speciesText,
				speciesId: pickedSpecies?.id ?? null,
				quantity: Math.max(1, quantity),
				arrivedOn: toText(f.get('arrivedOn')) ?? today
			});
		},
		'Habitant ajouté',
		() => {
			speciesText = '';
			pickedSpecies = null;
			quantity = 1;
			adding = null;
		}
	);
	const addEquipment = submit(
		(f) =>
			createResource('equipment', id, {
				name: f.get('name'),
				category: toText(f.get('category')),
				purchasedOn: toText(f.get('purchasedOn')),
				price: toNumber(f.get('price')),
				warrantyUntil: toText(f.get('warrantyUntil'))
			}),
		'Matériel ajouté',
		() => (adding = null)
	);
	const addConsumable = (equipmentId: number) =>
		submit(
			(f) =>
				createResource('consumables', equipmentId, {
					name: f.get('name'),
					replaceEveryDays: toNumber(f.get('every')),
					unitPrice: toNumber(f.get('price')),
					installedOn: today
				}),
			'Consommable ajouté',
			() => (addingConsumable = null)
		);

	// Quantité : mise à jour immédiate à l'écran, envoyée au serveur ensuite.
	async function changeQuantity(i: Inhabitant, delta: number) {
		const next = Math.max(1, i.quantity + delta);
		if (next === i.quantity) return;
		const previous = i.quantity;
		i.quantity = next;
		try {
			await updateResource('inhabitants', i.id, { quantity: next });
		} catch (e) {
			i.quantity = previous;
			message = (e as Error).message;
		}
	}

	const active = $derived(inhabitants.filter((i) => !i.leftOn));
	const fauna = $derived(active.filter((i) => i.kind === 'faune'));
	const flora = $derived(active.filter((i) => i.kind === 'flore'));
	const gone = $derived(inhabitants.filter((i) => i.leftOn));
	const animals = $derived(fauna.reduce((n, i) => n + i.quantity, 0));

	function warranty(until: string | null): { label: string; cls: string } | null {
		if (!until) return null;
		const left = daysBetween(today, until);
		if (left < 0) return { label: 'Garantie expirée', cls: 'text-muted' };
		if (left < 60) return { label: `Garantie : ${left} j`, cls: 'bg-warn-soft text-warn' };
		return { label: `Garantie : ${Math.round(left / 30)} mois`, cls: 'bg-ok-soft text-ok' };
	}
	const since = (d: string | null) => {
		if (!d) return 'date d’arrivée inconnue';
		const days = daysBetween(d, today);
		if (days < 60) return `depuis ${days} j`;
		if (days < 730) return `depuis ${Math.round(days / 30)} mois`;
		return `depuis ${Math.round(days / 365)} ans`;
	};
	// « Néon cardinal (Paracheirodon axelrodi) » → nom courant et nom latin séparés.
	function splitName(text: string): { name: string; latin: string | null } {
		const m = /^(.*\S)\s*\(([^()]+)\)$/.exec(text);
		return m ? { name: m[1], latin: m[2] } : { name: text, latin: null };
	}
	const date = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
</script>

<svelte:head><title>Vivants · {aquarium?.name ?? 'Bac'}</title></svelte:head>

{#if !aquarium}
	<p class="hand text-lg text-muted">Bac introuvable.</p>
{:else}
	<TankHeader {aquarium} tab="vivants" />

	{#if message}<p class="mb-4 rounded-xl border-2 border-bad bg-bad-soft p-3 text-sm font-bold text-bad" role="alert">{message}</p>{/if}

	<!-- Résumé + accès au simulateur -->
	<a href="/aquariums/{id}/peuplement" class="card press rise mb-8 flex items-center gap-4 p-4">
		<span class="grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-edge" style="background: {TANK_TONE[aquarium.waterType]}">
			<Icon name="fish" size={28} />
		</span>
		<div class="min-w-0 flex-1">
			<p class="display text-xl">Simulateur de peuplement</p>
			<p class="text-sm text-muted">Charge biologique, compatibilités, et si j’ajoutais…</p>
		</div>
		<Icon name="next" size={22} />
	</a>

	<!-- Faune et flore -->
	<section class="rise mb-8" style="animation-delay: 40ms">
		<div class="mb-3 flex flex-col items-start gap-1.5">
			<h2 class="tape">Habitants</h2>
			{#if !loading && active.length}
				<p class="hand text-lg leading-tight text-muted">
					{animals} animaux de {fauna.length} espèce{fauna.length > 1 ? 's' : ''}, {flora.length} plante{flora.length > 1 ? 's' : ''}.
				</p>
			{/if}
		</div>

		{#if !loading && active.length === 0}
			<p class="hand mb-3 text-lg text-muted">Personne encore. Le bac attend ses premiers habitants.</p>
		{/if}

		{#each [{ label: 'Faune', list: fauna, icon: 'fish' as const }, { label: 'Flore', list: flora, icon: 'leaf' as const }] as group (group.label)}
			{#if group.list.length}
				<p class="num mb-2 mt-1 text-[11px] uppercase tracking-wider text-muted">{group.label}</p>
				<ul class="card mb-4 divide-y-2 divide-line">
					{#each group.list as i (i.id)}
						{@const open = openRow === `i${i.id}`}
						{@const n = splitName(i.species)}
						<li>
							<div class="flex items-center gap-3 px-3 py-3">
								<button
									class="flex min-w-0 flex-1 items-center gap-3 text-left"
									onclick={() => (openRow = open ? null : `i${i.id}`)}
									aria-expanded={open}
								>
									<span class="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-edge bg-surface2">
										<Icon name={group.icon} size={20} />
									</span>
									<span class="min-w-0">
										<span class="line-clamp-2 block font-bold leading-tight">{n.name}</span>
										{#if n.latin}<span class="block truncate text-xs italic text-muted">{n.latin}</span>{/if}
										<span class="block text-xs text-muted">
											{since(i.arrivedOn)}{i.speciesId == null ? ' · sans fiche' : ''}
										</span>
									</span>
								</button>
								<div class="flex shrink-0 items-center rounded-xl border-2 border-edge bg-surface">
									<button class="grid h-9 w-9 place-items-center text-lg font-bold disabled:opacity-30" disabled={i.quantity <= 1} onclick={() => changeQuantity(i, -1)} aria-label="Un de moins : {i.species}">−</button>
									<span class="num w-7 text-center">{i.quantity}</span>
									<button class="grid h-9 w-9 place-items-center text-lg font-bold" onclick={() => changeQuantity(i, 1)} aria-label="Un de plus : {i.species}">+</button>
								</div>
							</div>
							{#if open}
								<div class="flex flex-wrap gap-2 border-t-2 border-dashed border-line bg-surface2/50 px-3 py-3">
									{#if i.speciesId == null}
										<button class="btn-ghost min-h-0 px-3 py-1.5 text-sm" onclick={() => (linking = linking === i.id ? null : i.id)}>
											<Icon name="book" size={16} />Relier à une fiche
										</button>
									{/if}
									<button
										class="btn-ghost min-h-0 px-3 py-1.5 text-sm"
										onclick={() => act(() => updateResource('inhabitants', i.id, { leftOn: today }), `${i.species} : noté comme parti`)}
									>
										Parti ou mort
									</button>
									<button
										class="btn-ghost min-h-0 px-3 py-1.5 text-sm text-bad"
										onclick={() => confirm(`Supprimer « ${i.species} » ?`) && act(() => deleteResource('inhabitants', i.id), 'Supprimé')}
									>
										<Icon name="trash" size={16} />Supprimer
									</button>
									{#if linking === i.id}
										<div class="w-full">
											<SpeciesPicker onpick={(sp) => { linking = null; void act(() => updateResource('inhabitants', i.id, { speciesId: sp.id }), 'Fiche reliée'); }} />
										</div>
									{/if}
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		{/each}

		{#if adding === 'habitant'}
			<form onsubmit={addInhabitant} class="card rise flex flex-col gap-3 p-4">
				<div class="flex items-center justify-between">
					<p class="display text-lg">Nouvel habitant</p>
					<button type="button" class="text-muted" onclick={() => (adding = null)} aria-label="Fermer"><Icon name="close" size={22} /></button>
				</div>
				<SpeciesPicker onpick={pick} placeholder="Chercher dans la base d'espèces" />
				<div class="flex rounded-xl border-2 border-edge bg-surface p-0.5 text-sm font-bold" role="group" aria-label="Type">
					<button type="button" class="flex-1 rounded-lg py-1.5 {kind === 'faune' ? 'bg-ink text-on-ink' : 'text-muted'}" onclick={() => (kind = 'faune')} aria-pressed={kind === 'faune'}>Faune</button>
					<button type="button" class="flex-1 rounded-lg py-1.5 {kind === 'flore' ? 'bg-ink text-on-ink' : 'text-muted'}" onclick={() => (kind = 'flore')} aria-pressed={kind === 'flore'}>Flore</button>
				</div>
				<label class="text-xs font-bold text-muted">
					Nom
					<input bind:value={speciesText} required placeholder="ex. Néon cardinal" class="field mt-1" />
				</label>
				<div class="flex items-end gap-3">
					<div class="text-xs font-bold text-muted">
						Nombre
						<div class="mt-1 flex items-center rounded-xl border-2 border-edge bg-surface">
							<button type="button" class="grid h-11 w-11 place-items-center text-lg font-bold" onclick={() => (quantity = Math.max(1, quantity - 1))} aria-label="Moins">−</button>
							<span class="num w-8 text-center text-base text-ink">{quantity}</span>
							<button type="button" class="grid h-11 w-11 place-items-center text-lg font-bold" onclick={() => (quantity += 1)} aria-label="Plus">+</button>
						</div>
					</div>
					<label class="min-w-0 flex-1 text-xs font-bold text-muted">
						Arrivée
						<input name="arrivedOn" type="date" value={today} class="field mt-1" />
					</label>
				</div>
				<button class="btn w-full">Ajouter au bac</button>
			</form>
		{:else}
			<button class="btn-ghost w-full border-dashed" onclick={() => (adding = 'habitant')}>
				<Icon name="plus" size={20} />Ajouter un habitant
			</button>
		{/if}

		{#if gone.length}
			<details class="mt-4">
				<summary class="cursor-pointer text-sm font-bold text-muted">Ont quitté le bac ({gone.length})</summary>
				<ul class="mt-2 flex flex-col gap-1 text-sm text-muted">
					{#each gone as i (i.id)}
						<li class="flex justify-between gap-3"><span class="truncate">{i.quantity} × {i.species}</span><span class="num shrink-0 text-xs">{i.leftOn ? date(i.leftOn) : ''}</span></li>
					{/each}
				</ul>
			</details>
		{/if}
	</section>

	<!-- Matériel et consommables -->
	<section class="rise mb-8" style="animation-delay: 80ms">
		<h2 class="tape mb-3">Matériel</h2>
		{#if !loading && equipment.length === 0}
			<p class="hand mb-3 text-lg text-muted">Aucun matériel noté. Filtre, éclairage, chauffage…</p>
		{/if}
		<ul class="mb-3 flex flex-col gap-4">
			{#each equipment as e (e.id)}
				{@const w = warranty(e.warrantyUntil)}
				{@const items = consumables.filter((c) => c.scopeId === e.id)}
				{@const open = openRow === `e${e.id}`}
				<li class="card overflow-hidden">
					<div class="flex items-start gap-3 p-4">
						<span class="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-edge bg-surface2"><Icon name="box" size={20} /></span>
						<div class="min-w-0 flex-1">
							<p class="font-bold leading-tight">{e.name}</p>
							<p class="text-xs text-muted">
								{[e.category, e.purchasedOn ? `acheté le ${date(e.purchasedOn)}` : null, e.price != null ? `${fmt(e.price, e.price % 1 ? 2 : 0)} €` : null].filter(Boolean).join(' · ')}
							</p>
							{#if w}<span class="chip mt-1.5 {w.cls}">{w.label}</span>{/if}
						</div>
						<button class="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted" onclick={() => (openRow = open ? null : `e${e.id}`)} aria-label="Actions pour {e.name}" aria-expanded={open}>
							<Icon name="edit" size={18} />
						</button>
					</div>
					{#if open}
						<div class="flex gap-2 border-t-2 border-dashed border-line px-4 py-3">
							<button
								class="btn-ghost min-h-0 px-3 py-1.5 text-sm text-bad"
								onclick={() => confirm(`Supprimer « ${e.name} » et ses consommables ?`) && act(() => deleteResource('equipment', e.id), 'Matériel supprimé')}
							>
								<Icon name="trash" size={16} />Supprimer
							</button>
						</div>
					{/if}
					{#if items.length || addingConsumable === e.id}
						<ul class="divide-y-2 divide-line border-t-2 border-edge bg-surface2/40">
							{#each items as c (c.id)}
								{@const life = consumableLife(c, store.view?.consumables?.find((x) => x.id === c.id)?.history ?? [], today)}
								<li class="flex items-center gap-3 px-4 py-2.5">
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm font-bold">{c.name}</p>
										<p class="text-xs text-muted">
											{#if life.observedDays}Dure en vrai {life.observedDays} j{#if life.plannedDays} (prévu {life.plannedDays}){/if}{:else if c.replaceEveryDays}Tous les {c.replaceEveryDays} j{:else}Pas de fréquence{/if}{#if life.costPerMonth != null} · {fmt(life.costPerMonth, 2)} €/mois{/if}
										</p>
										{#if life.suggestion}<p class="text-xs text-warn">{life.suggestion}</p>{/if}
									</div>
									{#if life.status !== 'inconnu'}
										<span class="chip {life.status === 'en_retard' ? 'bg-bad-soft text-bad' : life.status === 'bientot' ? 'bg-warn-soft text-warn' : 'text-muted'}">
											{life.daysLeft! < 0 ? `+${-life.daysLeft!} j` : `${life.daysLeft} j`}
										</span>
									{/if}
									<button
										class="press shrink-0 rounded-lg border-2 border-edge bg-sun px-2.5 py-1 text-xs font-bold text-[#16202e] shadow-[2px_2px_0_var(--shadow)]"
										onclick={() => act(async () => { await api('POST', `/api/consumables/${c.id}/replace`); await store.sync(); }, `${c.name} : remplacé aujourd’hui`)}
									>
										Remplacé
									</button>
									<button class="shrink-0 text-muted" onclick={() => confirm(`Supprimer « ${c.name} » ?`) && act(() => deleteResource('consumables', c.id), 'Consommable supprimé')} aria-label="Supprimer {c.name}">
										<Icon name="close" size={18} />
									</button>
								</li>
							{/each}
							{#if addingConsumable === e.id}
								<li class="px-4 py-3">
									<form onsubmit={addConsumable(e.id)} class="grid grid-cols-6 gap-2">
										<input name="name" required placeholder="ex. mousse fine, charbon" class="field col-span-6" />
										<input name="every" inputmode="numeric" placeholder="Tous les … j" class="field col-span-3" />
										<input name="price" inputmode="decimal" placeholder="Prix €" class="field col-span-3" />
										<button type="button" class="btn-ghost col-span-2 min-h-0 py-2 text-sm" onclick={() => (addingConsumable = null)}>Annuler</button>
										<button class="btn col-span-4 min-h-0 py-2 text-sm">Ajouter</button>
									</form>
								</li>
							{/if}
						</ul>
					{/if}
					{#if addingConsumable !== e.id}
						<button class="flex w-full items-center justify-center gap-1.5 border-t-2 border-edge py-2.5 text-sm font-bold text-muted active:bg-surface2" onclick={() => (addingConsumable = e.id)}>
							<Icon name="plus" size={16} />Consommable
						</button>
					{/if}
				</li>
			{/each}
		</ul>

		{#if adding === 'materiel'}
			<form onsubmit={addEquipment} class="card rise grid grid-cols-6 gap-3 p-4">
				<div class="col-span-6 flex items-center justify-between">
					<p class="display text-lg">Nouveau matériel</p>
					<button type="button" class="text-muted" onclick={() => (adding = null)} aria-label="Fermer"><Icon name="close" size={22} /></button>
				</div>
				<input name="name" required placeholder="ex. Filtre externe" class="field col-span-6" />
				<input name="category" placeholder="Type (filtre, éclairage…)" class="field col-span-4" />
				<input name="price" inputmode="decimal" placeholder="Prix €" class="field col-span-2" />
				<label class="col-span-3 text-xs font-bold text-muted">Achat<input name="purchasedOn" type="date" class="field mt-1" /></label>
				<label class="col-span-3 text-xs font-bold text-muted">Fin de garantie<input name="warrantyUntil" type="date" class="field mt-1" /></label>
				<button class="btn col-span-6">Ajouter</button>
			</form>
		{:else}
			<button class="btn-ghost w-full border-dashed" onclick={() => (adding = 'materiel')}>
				<Icon name="plus" size={20} />Ajouter du matériel
			</button>
		{/if}
	</section>
{/if}

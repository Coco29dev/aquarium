<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import SpeciesPicker from '$lib/components/SpeciesPicker.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import TankTabs from '$lib/ios/TankTabs.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Sheet from '$lib/ios/Sheet.svelte';
	import StepButtons from '$lib/ios/StepButtons.svelte';
	import Segmented from '$lib/ios/Segmented.svelte';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { api, createResource, deleteResource, listResource, toNumber, toText, updateResource } from '$lib/client/api';
	import { consumableLife } from '$lib/domain/consumables';
	import { speciesName } from '$lib/domain/species';
	import { dayInParis, daysBetween } from '$lib/domain/dates';
	import { fmt } from '$lib/ui';
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

	/** Lance une action serveur, recharge, puis affiche la bannière. */
	async function act(action: () => Promise<unknown>, done?: string): Promise<boolean> {
		try {
			await action();
			await load();
			if (done) ui.show(done, undefined, 'check');
			return true;
		} catch (e) {
			message = (e as Error).message;
			return false;
		}
	}

	const active = $derived(inhabitants.filter((i) => !i.leftOn));
	const fauna = $derived(active.filter((i) => i.kind === 'faune'));
	const flora = $derived(active.filter((i) => i.kind === 'flore'));
	const gone = $derived(inhabitants.filter((i) => i.leftOn));
	const animals = $derived(fauna.reduce((n, i) => n + i.quantity, 0));
	const ownConsumables = $derived(consumables.filter((c) => equipment.some((e) => e.id === c.scopeId)));
	const lifeOf = (c: Consumable) => consumableLife(c, store.view?.consumables?.find((x) => x.id === c.id)?.history ?? [], today);

	// « Néon cardinal (Paracheirodon axelrodi) » → nom courant et nom latin séparés.
	function splitName(text: string): { name: string; latin: string | null } {
		const m = /^(.*\S)\s*\(([^()]+)\)$/.exec(text);
		return m ? { name: m[1], latin: m[2] } : { name: text, latin: null };
	}
	const since = (d: string | null) => {
		if (!d) return 'Arrivée inconnue';
		const days = daysBetween(d, today);
		if (days < 60) return `Depuis ${days} j`;
		if (days < 730) return `Depuis ${Math.round(days / 30)} mois`;
		return `Depuis ${Math.round(days / 365)} ans`;
	};
	const cap = (t: string | null) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : null);
	const date = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
	function warranty(until: string | null): { label: string; cls: string } | null {
		if (!until) return null;
		const left = daysBetween(today, until);
		if (left < 0) return { label: 'Expirée', cls: 'text-label2' };
		if (left < 60) return { label: `${left} j`, cls: 'text-orange' };
		return { label: `${Math.round(left / 30)} mois`, cls: 'text-label2' };
	}
	function lifeLabel(c: Consumable): { label: string; cls: string } {
		const life = lifeOf(c);
		if (life.daysLeft == null) return { label: '', cls: '' };
		if (life.daysLeft < 0) return { label: `En retard de ${-life.daysLeft} j`, cls: 'text-red' };
		if (life.status === 'bientot') return { label: `Dans ${life.daysLeft} j`, cls: 'text-orange' };
		return { label: `Dans ${life.daysLeft} j`, cls: 'text-label2' };
	}

	// --- Habitant : détail ---------------------------------------------------
	let detailId = $state<number | null>(null);
	const detail = $derived(inhabitants.find((i) => i.id === detailId) ?? null);
	let linking = $state(false);

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
	async function markGone(i: Inhabitant) {
		const ok = await ui.confirm({
			title: `${splitName(i.species).name} est parti ?`,
			message: 'Il quittera la liste des vivants et restera dans l’historique du bac.',
			confirmLabel: 'Noter parti'
		});
		if (ok && (await act(() => updateResource('inhabitants', i.id, { leftOn: today }), 'Noté comme parti'))) detailId = null;
	}
	async function removeInhabitant(i: Inhabitant) {
		const ok = await ui.confirm({
			title: `Supprimer « ${splitName(i.species).name} » ?`,
			message: 'Cette fiche disparaît sans laisser de trace dans l’historique.',
			confirmLabel: 'Supprimer',
			destructive: true
		});
		if (ok && (await act(() => deleteResource('inhabitants', i.id), 'Supprimé'))) detailId = null;
	}

	// --- Habitant : ajout ----------------------------------------------------
	let adding = $state(false);
	let kind = $state<'faune' | 'flore'>('faune');
	let speciesText = $state('');
	let pickedSpecies = $state<Species | null>(null);
	let quantity = $state(1);
	let arrivedOn = $state(today);

	function openAdd(k: 'faune' | 'flore') {
		kind = k;
		speciesText = '';
		pickedSpecies = null;
		quantity = 1;
		arrivedOn = today;
		adding = true;
	}
	function pick(species: Species) {
		pickedSpecies = species;
		speciesText = speciesName(species);
		if (species.kind === 'plante') kind = 'flore';
	}
	async function addInhabitant() {
		if (!speciesText.trim()) return;
		const ok = await act(
			() =>
				createResource('inhabitants', id, {
					kind: pickedSpecies?.kind === 'plante' ? 'flore' : kind,
					species: speciesText.trim(),
					speciesId: pickedSpecies?.id ?? null,
					quantity: Math.max(1, quantity),
					arrivedOn: arrivedOn || today
				}),
			kind === 'flore' ? 'Plante ajoutée' : 'Animal ajouté'
		);
		if (ok) adding = false;
	}

	// --- Matériel ------------------------------------------------------------
	let addingEquipment = $state(false);
	let equipmentForm = $state<HTMLFormElement>();
	async function addEquipment() {
		if (!equipmentForm?.reportValidity()) return;
		const f = new FormData(equipmentForm);
		const ok = await act(
			() =>
				createResource('equipment', id, {
					name: f.get('name'),
					category: toText(f.get('category')),
					purchasedOn: toText(f.get('purchasedOn')),
					price: toNumber(f.get('price')),
					warrantyUntil: toText(f.get('warrantyUntil'))
				}),
			'Matériel ajouté'
		);
		if (ok) addingEquipment = false;
	}

	let equipmentId = $state<number | null>(null);
	const openEquipment = $derived(equipment.find((e) => e.id === equipmentId) ?? null);
	let consumableForm = $state<HTMLFormElement>();
	async function addConsumable(equipment: Equipment) {
		if (!consumableForm?.reportValidity()) return;
		const f = new FormData(consumableForm);
		const ok = await act(
			() =>
				createResource('consumables', equipment.id, {
					name: f.get('name'),
					replaceEveryDays: toNumber(f.get('every')),
					unitPrice: toNumber(f.get('price')),
					installedOn: today
				}),
			'Consommable ajouté'
		);
		if (ok) consumableForm?.reset();
	}
	async function removeEquipment(e: Equipment) {
		const ok = await ui.confirm({
			title: `Supprimer « ${e.name} » ?`,
			message: 'Ses consommables seront supprimés aussi.',
			confirmLabel: 'Supprimer',
			destructive: true
		});
		if (ok && (await act(() => deleteResource('equipment', e.id), 'Matériel supprimé'))) equipmentId = null;
	}

	let consumableId = $state<number | null>(null);
	const openConsumable = $derived(consumables.find((c) => c.id === consumableId) ?? null);
	async function replaced(c: Consumable) {
		await act(async () => {
			await api('POST', `/api/consumables/${c.id}/replace`);
			await store.sync();
		}, `${c.name} : remplacé aujourd’hui`);
	}
	async function removeConsumable(c: Consumable) {
		const ok = await ui.confirm({ title: `Supprimer « ${c.name} » ?`, confirmLabel: 'Supprimer', destructive: true });
		if (ok && (await act(() => deleteResource('consumables', c.id), 'Consommable supprimé'))) consumableId = null;
	}

	let showGone = $state(false);
</script>

<svelte:head><title>Vivants · {aquarium?.name ?? 'Bac'}</title></svelte:head>

{#if !aquarium}
	<NavBar title="Bac introuvable" back={{ href: '/aquariums', label: 'Bacs' }} large={false} />
{:else}
	<NavBar title={aquarium.name} back={{ href: '/aquariums', label: 'Bacs' }}>
		<TankTabs {aquarium} tab="vivants" />
	</NavBar>

	<div class="mt-4">
		{#if message}
			<p class="subhead mb-4 rounded-2xl bg-red/10 px-4 py-3 text-red" role="alert">{message}</p>
		{/if}

		<Section>
			<Row
				href="/aquariums/{id}/peuplement"
				icon="chart"
				iconColor="var(--indigo)"
				title="Simulateur de peuplement"
				subtitle="Charge biologique et compatibilités"
			/>
		</Section>

		<Section header="Faune" footer={loading ? undefined : animals ? `${animals} ${animals > 1 ? 'animaux' : 'animal'} de ${fauna.length} espèce${fauna.length > 1 ? 's' : ''}.` : undefined}>
			{#each fauna as i (i.id)}
				{@const n = splitName(i.species)}
				<Row icon="fish" iconColor="var(--orange)" onclick={() => ((detailId = i.id), (linking = false))} chevron>
					<p class="body truncate">{n.name}</p>
					<p class="subhead truncate text-label2">{#if n.latin}<i>{n.latin}</i>{' · '}{/if}{since(i.arrivedOn)}</p>
					{#snippet trailing()}<span class="rounded-num body text-label2">{i.quantity}</span>{/snippet}
				</Row>
			{/each}
			<Row icon="plus" title="Ajouter un animal" action onclick={() => openAdd('faune')} />
		</Section>

		<Section header="Flore">
			{#each flora as i (i.id)}
				{@const n = splitName(i.species)}
				<Row icon="leaf" iconColor="var(--green)" onclick={() => ((detailId = i.id), (linking = false))} chevron>
					<p class="body truncate">{n.name}</p>
					<p class="subhead truncate text-label2">{#if n.latin}<i>{n.latin}</i>{' · '}{/if}{since(i.arrivedOn)}</p>
					{#snippet trailing()}<span class="rounded-num body text-label2">{i.quantity}</span>{/snippet}
				</Row>
			{/each}
			<Row icon="plus" title="Ajouter une plante" action onclick={() => openAdd('flore')} />
		</Section>

		<Section header="Matériel">
			{#each equipment as e (e.id)}
				{@const w = warranty(e.warrantyUntil)}
				<Row
					icon="box"
					iconColor="var(--gray)"
					title={e.name}
					subtitle={[cap(e.category), e.price != null ? `${fmt(e.price, 2)} €` : null].filter(Boolean).join(' · ') || undefined}
					onclick={() => (equipmentId = e.id)}
					chevron
				>
					{#snippet trailing()}
						{#if w}<span class="subhead {w.cls}">{w.label}</span>{/if}
					{/snippet}
				</Row>
			{/each}
			<Row icon="plus" title="Ajouter du matériel" action onclick={() => (addingEquipment = true)} />
		</Section>

		{#if ownConsumables.length}
			<Section header="Consommables" footer="Durée de vie apprise à chaque remplacement.">
				{#each ownConsumables as c (c.id)}
					{@const l = lifeLabel(c)}
					<Row
						icon="sync"
						iconColor="var(--brown)"
						title={c.name}
						subtitle={equipment.find((e) => e.id === c.scopeId)?.name}
						onclick={() => (consumableId = c.id)}
						chevron
					>
						{#snippet trailing()}<span class="subhead {l.cls}">{l.label}</span>{/snippet}
					</Row>
				{/each}
			</Section>
		{/if}

		{#if gone.length}
			<Section>
				<Row title="Partis" value={String(gone.length)} onclick={() => (showGone = true)} chevron />
			</Section>
		{/if}
	</div>

	<!-- Détail d'un habitant -->
	<Sheet open={Boolean(detail)} title={detail ? splitName(detail.species).name : ''} cancelLabel="OK" onclose={() => (detailId = null)} detent="large">
		{#if detail}
			{@const n = splitName(detail.species)}
			<div class="mb-6 flex flex-col items-center text-center">
				<span class="mb-3 grid h-16 w-16 place-items-center rounded-full text-white" style="background: {detail.kind === 'flore' ? 'var(--green)' : 'var(--orange)'}; --cut: {detail.kind === 'flore' ? 'var(--green)' : 'var(--orange)'}">
					<Icon name={detail.kind === 'flore' ? 'leaf' : 'fish'} size={34} filled weight={1.6} />
				</span>
				<h2 class="title2">{n.name}</h2>
				{#if n.latin}<p class="subhead italic text-label2">{n.latin}</p>{/if}
			</div>
			<Section>
				<Row title="Quantité">
					{#snippet trailing()}
						<span class="rounded-num headline w-10 text-right">{detail.quantity}</span>
						<StepButtons label="Quantité" onminus={() => changeQuantity(detail, -1)} onplus={() => changeQuantity(detail, 1)} minusDisabled={detail.quantity <= 1} />
					{/snippet}
				</Row>
				<Row title="Arrivée" value={detail.arrivedOn ? date(detail.arrivedOn) : 'Inconnue'} />
				<Row title="Fiche espèce" value={detail.speciesId ? 'Reliée' : 'Aucune'} />
			</Section>
			<Section>
				<Row icon="book" title={detail.speciesId ? 'Changer de fiche' : 'Relier à une fiche'} action onclick={() => (linking = !linking)} />
				{#if detail.kind === 'faune'}
					<Row icon="person" title="Noter comme parti" action onclick={() => markGone(detail)} />
				{/if}
				<Row icon="trash" title="Supprimer" destructive onclick={() => removeInhabitant(detail)} />
			</Section>
			{#if linking}
				<div class="mb-8">
					<SpeciesPicker
						onpick={(sp) => {
							linking = false;
							void act(() => updateResource('inhabitants', detail.id, { speciesId: sp.id }), 'Fiche reliée');
						}}
					/>
				</div>
			{/if}
		{/if}
	</Sheet>

	<!-- Ajout d'un habitant -->
	<Sheet
		open={adding}
		title={kind === 'flore' ? 'Nouvelle plante' : 'Nouvel animal'}
		onclose={() => (adding = false)}
		action={{ label: 'Ajouter', onclick: addInhabitant, disabled: !speciesText.trim() }}
	>
		<div class="mb-6">
			<Segmented
				label="Type"
				options={[
					{ value: 'faune', label: 'Animal' },
					{ value: 'flore', label: 'Plante' }
				]}
				bind:value={kind}
			/>
		</div>
		<Section header="Espèce" footer={pickedSpecies ? 'Fiche reliée : elle servira aux compatibilités et à la charge biologique.' : 'Cherche dans la base, ou écris simplement un nom.'}>
			<li class="flex min-h-11 items-center px-4">
				<input class="body min-w-0 flex-1 bg-transparent py-2.5 outline-none placeholder:text-label3" placeholder="Nom" bind:value={speciesText} oninput={() => (pickedSpecies = null)} aria-label="Nom de l’espèce" />
			</li>
		</Section>
		<div class="mb-8"><SpeciesPicker onpick={pick} placeholder="Chercher dans la base d’espèces" /></div>
		<Section>
			<Row title="Quantité">
				{#snippet trailing()}
					<span class="rounded-num headline w-10 text-right">{quantity}</span>
					<StepButtons label="Quantité" onminus={() => (quantity = Math.max(1, quantity - 1))} onplus={() => (quantity += 1)} minusDisabled={quantity <= 1} />
				{/snippet}
			</Row>
			<Row title="Arrivée">
				{#snippet trailing()}
					<input type="date" bind:value={arrivedOn} max={today} class="body rounded-lg bg-fill3 px-2 py-1 outline-none" aria-label="Date d’arrivée" />
				{/snippet}
			</Row>
		</Section>
	</Sheet>

	<!-- Ajout de matériel -->
	<Sheet open={addingEquipment} title="Nouveau matériel" onclose={() => (addingEquipment = false)} action={{ label: 'Ajouter', onclick: addEquipment }}>
		<form bind:this={equipmentForm} onsubmit={(e) => (e.preventDefault(), addEquipment())}>
			<ul class="group form-list mb-8">
				<li><input name="name" required placeholder="Nom (ex. Filtre externe)" class="body" aria-label="Nom" /></li>
				<li><input name="category" placeholder="Catégorie (filtre, éclairage…)" class="body" aria-label="Catégorie" /></li>
			</ul>
			<ul class="group form-list mb-8">
				<li><span class="body">Acheté le</span><input name="purchasedOn" type="date" class="body text-right" /></li>
				<li><span class="body">Prix (€)</span><input name="price" inputmode="decimal" placeholder="0,00" class="body text-right" /></li>
				<li><span class="body">Garantie jusqu’au</span><input name="warrantyUntil" type="date" class="body text-right" /></li>
			</ul>
		</form>
	</Sheet>

	<!-- Détail d'un matériel -->
	<Sheet open={Boolean(openEquipment)} title={openEquipment?.name ?? ''} cancelLabel="OK" onclose={() => (equipmentId = null)}>
		{#if openEquipment}
			{@const e = openEquipment}
			{@const w = warranty(e.warrantyUntil)}
			<Section>
				<Row title="Catégorie" value={cap(e.category) ?? '—'} />
				<Row title="Acheté le" value={e.purchasedOn ? date(e.purchasedOn) : '—'} />
				<Row title="Prix" value={e.price != null ? `${fmt(e.price, 2)} €` : '—'} />
				<Row title="Garantie" value={e.warrantyUntil ? `${date(e.warrantyUntil)}${w ? ` · ${w.label}` : ''}` : '—'} />
			</Section>
			<Section header="Consommables">
				{#each consumables.filter((c) => c.scopeId === e.id) as c (c.id)}
					{@const l = lifeLabel(c)}
					<Row title={c.name} subtitle={c.replaceEveryDays ? `Tous les ${c.replaceEveryDays} j` : undefined} onclick={() => (consumableId = c.id)} chevron>
						{#snippet trailing()}<span class="subhead {l.cls}">{l.label}</span>{/snippet}
					</Row>
				{/each}
			</Section>
			<Section header="Ajouter un consommable" inset={false}>
				<div class="group">
					<form bind:this={consumableForm} onsubmit={(ev) => (ev.preventDefault(), addConsumable(e))}>
						<ul class="form-list">
							<li><input name="name" required placeholder="Nom (ex. Mousse fine)" class="body" aria-label="Nom du consommable" /></li>
							<li><span class="body">Tous les (jours)</span><input name="every" inputmode="numeric" placeholder="30" class="body text-right" /></li>
							<li><span class="body">Prix unitaire (€)</span><input name="price" inputmode="decimal" placeholder="0,00" class="body text-right" /></li>
						</ul>
					</form>
					<button type="button" class="tappable body flex min-h-11 w-full items-center gap-3 px-4 text-tint shadow-[inset_0_0.5px_0_var(--sep)]" onclick={() => addConsumable(e)}>
						<Icon name="plus" size={22} />Ajouter
					</button>
				</div>
			</Section>
			<Section>
				<Row icon="trash" title="Supprimer ce matériel" destructive onclick={() => removeEquipment(e)} />
			</Section>
		{/if}
	</Sheet>

	<!-- Détail d'un consommable -->
	<Sheet open={Boolean(openConsumable)} title={openConsumable?.name ?? ''} cancelLabel="OK" detent="medium" onclose={() => (consumableId = null)}>
		{#if openConsumable}
			{@const c = openConsumable}
			{@const life = lifeOf(c)}
			{@const l = lifeLabel(c)}
			<Section footer={life.suggestion ?? undefined}>
				<Row title="Prochain remplacement">
					{#snippet trailing()}<span class="body {l.cls || 'text-label2'}">{l.label || '—'}</span>{/snippet}
				</Row>
				<Row title="Installé le" value={c.installedOn ? date(c.installedOn) : '—'} />
				<Row
					title="Durée de vie"
					value={life.observedDays ? `${life.observedDays} j constatés` : c.replaceEveryDays ? `${c.replaceEveryDays} j prévus` : '—'}
				/>
				{#if life.costPerMonth != null}<Row title="Coût" value="{fmt(life.costPerMonth, 2)} € / mois" />{/if}
			</Section>
			<button class="btn-filled mb-4 w-full" onclick={() => replaced(c)}>Remplacé aujourd’hui</button>
			<button class="btn-plain w-full py-2 text-red" onclick={() => removeConsumable(c)}>Supprimer</button>
		{/if}
	</Sheet>

	<!-- Partis -->
	<Sheet open={showGone} title="Partis" cancelLabel="OK" onclose={() => (showGone = false)}>
		<Section footer="Les animaux notés comme partis restent dans l’historique du bac.">
			{#each gone as i (i.id)}
				<Row title={splitName(i.species).name} subtitle="{i.quantity} × · {i.leftOn ? date(i.leftOn) : ''}" />
			{/each}
		</Section>
	</Sheet>
{/if}

<style>
	/* Formulaire en liste groupée : libellé à gauche, champ à droite, filets entre les lignes. */
	.form-list > li {
		display: flex;
		min-height: 44px;
		align-items: center;
		gap: 12px;
		padding: 0 16px;
	}
	.form-list > li + li {
		box-shadow: inset 16px 0 0 var(--bg2), inset 0 0.5px 0 var(--sep);
	}
	.form-list :global(input) {
		min-width: 0;
		flex: 1;
		background: transparent;
		padding: 11px 0;
		outline: none;
	}
	.form-list :global(input::placeholder) {
		color: var(--label3);
	}
	.form-list > li > span {
		flex: none;
	}
</style>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { createResource, deleteResource, listResource, updateResource } from '$lib/client/api';
	import { journeySteps, type JourneyStep } from '$lib/domain/journey';
	import { speciesName } from '$lib/domain/species';
	import { suggestedTasks } from '$lib/templates';
	import { dayInParis } from '$lib/domain/dates';
	import { isProject } from '$lib/tank';
	import { SHORT_WATER, TANK_ICON, TANK_TONE, fmt } from '$lib/ui';
	import Icon from '$lib/components/Icon.svelte';
	import SpeciesPicker from '$lib/components/SpeciesPicker.svelte';
	import JourneyCard from '$lib/ios/JourneyCard.svelte';
	import Carousel from '$lib/relief/Carousel.svelte';
	import IdeaTile from '$lib/relief/IdeaTile.svelte';
	import { IDEAS } from '$lib/content/ideas';
	import { fitOf, ideasFor } from '$lib/domain/ideas';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Sheet from '$lib/ios/Sheet.svelte';
	import SwipeRow from '$lib/ios/SwipeRow.svelte';
	import type { ProjectItem, Species } from '$lib/types';

	const id = $derived(Number(page.params.id));
	const view = $derived(store.view);
	const aquarium = $derived(view?.aquariums.find((a) => a.id === id));
	const project = $derived(aquarium ? isProject(aquarium) : false);

	let items = $state<ProjectItem[]>([]);
	let loaded = $state(false);
	let loadError = $state('');
	let busy = $state(false);

	async function load() {
		try {
			items = await listResource<ProjectItem>('project_items', id);
			loadError = '';
		} catch (error) {
			loadError = (error as Error).message;
		} finally {
			loaded = true;
		}
	}
	onMount(load);

	const equipment = $derived(items.filter((i) => i.kind === 'equipement'));
	const wishes = $derived(items.filter((i) => i.kind === 'espece'));
	const checks = $derived(items.filter((i) => i.kind === 'etape'));
	const budget = $derived(items.find((i) => i.kind === 'budget') ?? null);
	const total = $derived(equipment.reduce((sum, i) => sum + (i.amount ?? 0), 0));
	const acquired = $derived(equipment.filter((i) => i.done).reduce((sum, i) => sum + (i.amount ?? 0), 0));
	const target = $derived(budget?.amount ?? 0);

	// Idées de peuplement adaptées au volume et au type d'eau du bac.
	const ideas = $derived(aquarium ? ideasFor(IDEAS, aquarium.volumeL, aquarium.waterType).slice(0, 8) : []);

	const euro = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`;
	const nextPosition = () => items.reduce((max, i) => Math.max(max, i.position), 0) + 1;

	const steps = $derived<JourneyStep[]>(
		aquarium && view
			? journeySteps({
					aquarium,
					parameters: view.parameters.filter((p) => p.aquariumId === id),
					measurements: [],
					tasks: [],
					events: [],
					inhabitantsCount: 0,
					projectItems: items,
					cycling: null,
					today: dayInParis()
				})
			: []
	);

	// --- Actions sur les lignes -----------------------------------------------
	async function run(action: () => Promise<unknown>) {
		try {
			await action();
		} catch (error) {
			ui.show((error as Error).message);
		}
	}

	async function toggleDone(item: ProjectItem) {
		const done = !item.done;
		items = items.map((i) => (i.id === item.id ? { ...i, done } : i));
		try {
			await updateResource('project_items', item.id, { done });
		} catch (error) {
			items = items.map((i) => (i.id === item.id ? { ...i, done: !done } : i));
			ui.show((error as Error).message);
		}
	}

	async function remove(item: ProjectItem) {
		const before = items;
		items = items.filter((i) => i.id !== item.id);
		try {
			await deleteResource('project_items', item.id);
			ui.show(`« ${item.label} » retiré`, () => {
				void run(async () => {
					await createResource('project_items', id, {
						kind: item.kind,
						label: item.label,
						done: item.done,
						amount: item.amount,
						speciesId: item.speciesId,
						notes: item.notes,
						position: item.position
					});
					await load();
				});
			});
		} catch (error) {
			items = before;
			ui.show((error as Error).message);
		}
	}

	// --- Feuille : matériel (ajout et édition) -----------------------------------
	let sheet = $state<'equipement' | 'budget' | 'espece' | null>(null);
	let editing = $state<ProjectItem | null>(null);
	let label = $state('');
	let amount = $state('');

	const parseAmount = (s: string): number | null => {
		const t = s.trim().replace(',', '.');
		if (t === '') return null;
		const n = Number(t);
		return Number.isFinite(n) && n >= 0 ? n : NaN;
	};
	const amountInvalid = $derived(Number.isNaN(parseAmount(amount)));

	function openEquipment(item: ProjectItem | null) {
		editing = item;
		label = item?.label ?? '';
		amount = item?.amount != null ? String(item.amount).replace('.', ',') : '';
		sheet = 'equipement';
	}
	function openBudget() {
		amount = budget?.amount != null ? String(budget.amount).replace('.', ',') : '';
		sheet = 'budget';
	}
	const close = () => {
		sheet = null;
		editing = null;
	};

	async function saveEquipment() {
		const value = parseAmount(amount);
		if (label.trim() === '' || Number.isNaN(value)) return;
		busy = true;
		try {
			if (editing) await updateResource('project_items', editing.id, { label: label.trim(), amount: value });
			else await createResource('project_items', id, { kind: 'equipement', label: label.trim(), amount: value, position: nextPosition() });
			await load();
			close();
		} catch (error) {
			ui.show((error as Error).message);
		} finally {
			busy = false;
		}
	}

	async function saveBudget() {
		const value = parseAmount(amount);
		if (Number.isNaN(value)) return;
		busy = true;
		try {
			if (budget) {
				if (value === null) await deleteResource('project_items', budget.id);
				else await updateResource('project_items', budget.id, { amount: value });
			} else if (value !== null) {
				await createResource('project_items', id, { kind: 'budget', label: 'Budget visé', amount: value, position: nextPosition() });
			}
			await load();
			close();
		} catch (error) {
			ui.show((error as Error).message);
		} finally {
			busy = false;
		}
	}

	async function addWish(s: Species) {
		if (items.some((i) => i.kind === 'espece' && i.speciesId === s.id)) {
			ui.show('Cette espèce est déjà dans ta liste');
			return;
		}
		await run(async () => {
			await createResource('project_items', id, { kind: 'espece', label: speciesName(s), speciesId: s.id, position: nextPosition() });
			await load();
			ui.show(`${speciesName(s)} ajouté`, undefined, 'check');
		});
	}

	// --- Mise en eau --------------------------------------------------------
	async function launch() {
		if (!aquarium || busy) return;
		const ok = await ui.confirm({
			title: 'Lancer la mise en eau ?',
			message: 'Le bac passe en cyclage. Je prépare les tests à faire et je suis l’ammoniac, les nitrites et les nitrates jusqu’aux premiers poissons.',
			confirmLabel: 'Lancer',
			cancelLabel: 'Pas encore'
		});
		if (!ok) return;
		busy = true;
		try {
			await store.setStage(id, 'cyclage');
			// Tâches de cyclage proposées (tests rapprochés) : sans elles, rien ne rappellerait de tester.
			for (const t of suggestedTasks(aquarium.waterType, 'cyclage')) {
				await store.mutate('POST', `/api/aquariums/${id}/tasks`, { title: t.title, kind: t.kind, everyDays: t.everyDays }).catch(() => {});
			}
			await goto(`/aquariums/${id}`, { replaceState: true });
		} catch (error) {
			ui.show((error as Error).message);
		} finally {
			busy = false;
		}
	}

	async function removeProject() {
		const ok = await ui.confirm({ title: 'Supprimer ce projet ?', message: 'La liste de matériel et les souhaits seront supprimés.', confirmLabel: 'Supprimer', destructive: true });
		if (!ok) return;
		try {
			await store.mutate('DELETE', `/api/aquariums/${id}`);
			await goto('/aquariums', { replaceState: true });
		} catch (error) {
			ui.show((error as Error).message);
		}
	}

	function onaction(step: JourneyStep) {
		const href = step.action?.href ?? '';
		if (href.startsWith('?etape=mise-en-eau')) return void launch();
		if (step.id === 'materiel' || step.id === 'budget') return document.getElementById('sec-materiel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		if (step.id === 'especes') return document.getElementById('sec-especes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		void goto(href);
	}

	const speciesWater = $derived<'douce' | 'mer'>(aquarium && (aquarium.waterType === 'mer' || aquarium.waterType === 'recif') ? 'mer' : 'douce');
	const delta = $derived(target > 0 ? target - total : 0);
	const gauge = $derived(target > 0 ? Math.min(100, (total / target) * 100) : 0);
</script>

<svelte:head><title>{aquarium?.name ?? 'Projet'} · Aquarium</title></svelte:head>

{#if !aquarium}
	<NavBar title="Projet" back={{ href: '/aquariums', label: 'Bacs' }} />
	<p class="subhead mt-8 text-center text-label2">Ce bac est introuvable.</p>
{:else if !project}
	<NavBar title={aquarium.name} back={{ href: '/aquariums', label: 'Bacs' }} />
	<div class="mt-12 flex flex-col items-center px-6 text-center">
		<h2 class="title2">Ce bac n’est plus un projet</h2>
		<p class="subhead mt-1.5 text-label2">La mise en eau est lancée : retrouve son suivi sur sa fiche.</p>
		<a href="/aquariums/{id}" class="btn-filled mt-6">Ouvrir le bac</a>
	</div>
{:else}
	<NavBar
		title={aquarium.name}
		kicker="Projet · {SHORT_WATER[aquarium.waterType]}{aquarium.volumeL ? ` · ${fmt(aquarium.volumeL, 0)} L visés` : ''}"
		back={{ href: '/aquariums', label: 'Bacs' }}
	/>

	{#if loadError}
		<p class="subhead mb-4 rounded-2xl bg-orange/10 px-4 py-3 text-orange" role="status">
			Impossible de charger la liste ({loadError}). Les modifications demandent une connexion.
		</p>
	{/if}

	<div class="mb-8 mt-2">
		<JourneyCard {aquarium} {steps} {onaction} open />
	</div>

	<!-- Budget -->
	<section class="group mb-8 p-4" aria-label="Budget">
		<p class="footnote font-semibold uppercase text-label2">Budget estimé</p>
		<p class="rounded-num mt-1"><span class="text-[40px] font-semibold leading-[44px]">{euro(total)}</span></p>
		{#if equipment.length === 0}
			<p class="subhead mt-1 text-label2">Ajoute du matériel avec un prix pour chiffrer ton projet.</p>
		{:else if acquired > 0}
			<p class="subhead mt-1 text-label2">Déjà acquis : {euro(acquired)} · reste {euro(total - acquired)}</p>
		{/if}
		{#if target > 0}
			<div class="mt-3 h-2.5 overflow-hidden rounded-full bg-fill" role="img" aria-label="Total estimé par rapport au budget visé">
				<div class="h-full rounded-full transition-[width] duration-500" style="width: {gauge}%; background: {delta >= 0 ? 'var(--green)' : 'var(--red)'}"></div>
			</div>
			<p class="footnote mt-1.5 {delta >= 0 ? 'text-label2' : 'font-semibold text-red'}">
				{delta >= 0 ? `Il reste ${euro(delta)} sur ton budget de ${euro(target)}` : `Tu dépasses ton budget de ${euro(-delta)} (visé : ${euro(target)})`}
			</p>
		{/if}
		<button type="button" class="btn-plain subhead mt-2 font-semibold" onclick={openBudget}>{target > 0 ? 'Modifier le budget visé' : 'Définir un budget visé'}</button>
	</section>

	<!-- Matériel -->
	<div id="sec-materiel" class="scroll-mt-16">
		<Section header="Matériel" variant="title" footer={equipment.length ? 'Touche le rond quand tu as acheté l’élément, touche la ligne pour la modifier, glisse pour la retirer.' : undefined}>
			{#each equipment as item (item.id)}
				<SwipeRow trailing={[{ label: 'Retirer', icon: 'trash', color: 'var(--red)', onaction: () => remove(item) }]}>
					<div class="flex items-center gap-3 pl-4">
						<button
							type="button"
							class="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-all duration-200 {item.done ? 'border-green bg-green text-white' : 'border-label3'}"
							onclick={() => toggleDone(item)}
							aria-pressed={item.done}
							aria-label="{item.done ? 'Marquer comme à acheter' : 'Marquer comme acheté'} : {item.label}"
						>
							{#if item.done}<span class="grid" style="animation: pop-in 220ms both"><Icon name="check" size={14} weight={3.2} /></span>{/if}
						</button>
						<button type="button" class="tappable row-body flex min-h-11 min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 text-left" onclick={() => openEquipment(item)}>
							<span class="body min-w-0 flex-1 truncate {item.done ? 'text-label2' : ''}">{item.label}</span>
							<span class="rounded-num body shrink-0 text-label2">{item.amount != null ? euro(item.amount) : '–'}</span>
						</button>
					</div>
				</SwipeRow>
			{/each}
			<Row icon="plus" action title="Ajouter du matériel" onclick={() => openEquipment(null)} />
		</Section>
	</div>

	<!-- Idées de peuplement -->
	{#if aquarium}
		<Carousel header={aquarium.volumeL ? `Idées pour ${aquarium.volumeL} L` : 'Idées de peuplement'} more={{ href: `/encyclopedie/idees?bac=${id}`, label: 'Tout voir' }}>
			{#each ideas as idea (idea.slug)}
				<IdeaTile {idea} tall href="/encyclopedie/idees/{idea.slug}?bac={id}" fit={aquarium.volumeL ? fitOf(idea, aquarium.volumeL) : null} />
			{:else}
				<p class="subhead px-1 text-label2">Renseigne le volume du bac pour obtenir des idées adaptées.</p>
			{/each}
		</Carousel>
	{/if}

	<!-- Espèces souhaitées -->
	<div id="sec-especes" class="scroll-mt-16">
		<Section header="Espèces souhaitées" variant="title">
			{#each wishes as item (item.id)}
				<SwipeRow trailing={[{ label: 'Retirer', icon: 'trash', color: 'var(--red)', onaction: () => remove(item) }]}>
					<div class="flex items-center gap-3 pl-4">
						<span class="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px] text-white" style="background: var(--green); --cut: var(--green)">
							<Icon name="fish" size={19} filled weight={2} />
						</span>
						<div class="row-body flex min-h-11 min-w-0 flex-1 flex-col justify-center py-2 pr-4">
							<span class="body truncate">{item.label}</span>
							{#if item.notes}<span class="footnote truncate text-label2">{item.notes}</span>{/if}
						</div>
					</div>
				</SwipeRow>
			{/each}
			<Row icon="plus" action title="Ajouter une espèce" onclick={() => (sheet = 'espece')} />
			<Row icon="chart" iconColor="var(--indigo)" title="Tester dans le simulateur" subtitle="Compatibilité, charge biologique" href="/aquariums/{id}/peuplement" />
		</Section>
	</div>

	<!-- Étapes à cocher -->
	{#if checks.length}
		<Section header="Avant la mise en eau" variant="title" footer="Coche ces étapes au fil de ta préparation.">
			{#each checks as item (item.id)}
				<li class="pl-4">
					<button type="button" class="tappable flex w-full items-center gap-3 text-left" onclick={() => toggleDone(item)} aria-pressed={item.done}>
						<span class="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-all duration-200 {item.done ? 'border-green bg-green text-white' : 'border-label3'}">
							{#if item.done}<span class="grid" style="animation: pop-in 220ms both"><Icon name="check" size={14} weight={3.2} /></span>{/if}
						</span>
						<span class="row-body body min-h-11 flex-1 py-2.5 pr-4 {item.done ? 'text-label2' : ''}">{item.label}</span>
					</button>
				</li>
			{/each}
		</Section>
	{/if}

	<button type="button" class="btn-filled mb-3 w-full" onclick={launch} disabled={busy}>Lancer la mise en eau</button>
	<p class="footnote mb-8 px-2 text-center text-label2">Le bac passe en cyclage : je te dirai quand tu pourras ajouter des poissons.</p>

	<Section>
		<Row icon="reglages" iconColor="var(--gray)" title="Nom, type d’eau et volume" href="/aquariums/{id}/reglages" />
		<Row title="Supprimer le projet" destructive onclick={removeProject} />
	</Section>

	<!-- Feuilles -->
	<Sheet
		open={sheet === 'equipement'}
		title={editing ? 'Modifier' : 'Nouveau matériel'}
		detent="medium"
		onclose={close}
		action={{ label: busy ? 'Envoi…' : editing ? 'OK' : 'Ajouter', onclick: saveEquipment, disabled: busy || label.trim() === '' || amountInvalid }}
	>
		<ul class="group ios-sheet-list">
			<li class="pl-4"><div class="row-body flex min-h-11 items-center pr-4">
				<input bind:value={label} placeholder="Ex. Filtre externe" aria-label="Nom du matériel" class="body h-11 w-full bg-transparent outline-none placeholder:text-label3" />
			</div></li>
			<li class="pl-4"><div class="row-body flex min-h-11 items-center gap-3 pr-4">
				<label for="equip-amount" class="body flex-1">Prix estimé</label>
				<input id="equip-amount" bind:value={amount} inputmode="decimal" placeholder="0" class="body rounded-num h-11 w-24 bg-transparent text-right outline-none placeholder:text-label3 {amountInvalid ? 'text-red' : 'text-label2 focus:text-label'}" />
				<span class="body text-label2">€</span>
			</div></li>
		</ul>
		{#if amountInvalid}<p class="footnote mt-2 px-4 text-red">Entre un montant positif, par exemple 89,90.</p>{/if}
	</Sheet>

	<Sheet
		open={sheet === 'budget'}
		title="Budget visé"
		detent="medium"
		onclose={close}
		action={{ label: busy ? 'Envoi…' : 'OK', onclick: saveBudget, disabled: busy || amountInvalid }}
	>
		<ul class="group">
			<li class="pl-4"><div class="row-body flex min-h-11 items-center gap-3 pr-4">
				<label for="budget-amount" class="body flex-1">Budget total</label>
				<input id="budget-amount" bind:value={amount} inputmode="decimal" placeholder="0" class="body rounded-num h-11 w-28 bg-transparent text-right outline-none placeholder:text-label3 {amountInvalid ? 'text-red' : 'text-label2 focus:text-label'}" />
				<span class="body text-label2">€</span>
			</div></li>
		</ul>
		<p class="footnote mt-2 px-4 text-label2">Laisse vide pour retirer le budget visé. Il sert à comparer avec le total du matériel.</p>
	</Sheet>

	<Sheet open={sheet === 'espece'} title="Ajouter une espèce" onclose={close} cancelLabel="OK">
		<SpeciesPicker onpick={addWish} water={speciesWater} placeholder="Chercher une espèce" />
		{#if wishes.length}
			<p class="footnote mt-4 px-1 text-label2">Dans ta liste : {wishes.map((w) => w.label).join(', ')}.</p>
		{/if}
	</Sheet>
{/if}

<style>
	.ios-sheet-list > li + li .row-body {
		box-shadow: inset 0 0.5px 0 var(--sep);
	}
</style>

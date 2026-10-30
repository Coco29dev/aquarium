<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { api, createResource, listResource } from '$lib/client/api';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import SpeciesThumb from '$lib/components/SpeciesThumb.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Segmented from '$lib/ios/Segmented.svelte';
	import Switch from '$lib/ios/Switch.svelte';
	import { ideaOf, speciesNamesOf } from '$lib/content/ideas';
	import { LEVEL_NAMES, animalCount, planIdea, plantsOf, volumeLabel, type PlannedLine, type Planting, type StockRole } from '$lib/domain/ideas';
	import { CATEGORY_LABELS, equipmentFor, isOwned, midPrice, totalOf, type EquipmentSuggestion } from '$lib/domain/equipment';
	import { BIOLOAD_LABELS, speciesName } from '$lib/domain/species';
	import { isProject } from '$lib/tank';
	import { SHORT_WATER } from '$lib/ui';
	import type { ProjectItem, Species } from '$lib/types';

	const idea = $derived(ideaOf(page.params.slug ?? ''));
	const tankId = $derived(Number(page.url.searchParams.get('bac')) || null);
	const tank = $derived(tankId ? store.view?.aquariums.find((a) => a.id === tankId) : undefined);

	let volume = $state(0);
	let ready = $state(false);
	let species = $state(new Map<string, Species>());
	let loadError = $state('');
	let adding = $state(false);
	let addingGear = $state(false);
	let planting = $state<Planting>('strict');
	let projectItems = $state<ProjectItem[]>([]);
	// Choix de l'utilisateur sur chaque élément de matériel ; sans choix, les indispensables manquants sont cochés.
	let gearChoice = $state<Record<string, boolean>>({});

	// Volume de départ : ?l, sinon le bac choisi, sinon le volume de référence de l'idée.
	$effect(() => {
		if (ready || !idea) return;
		const asked = Number(page.url.searchParams.get('l'));
		const start = asked > 0 ? asked : (tank?.volumeL ?? 0) || idea.ref;
		// Reste dans une plage qui a du sens pour le curseur.
		volume = Math.round(Math.min(Math.max(start, idea.volume[0] * 0.8), idea.volume[1] * 1.4));
		ready = true;
	});

	async function loadProject() {
		if (!tankId) return;
		try {
			projectItems = await listResource<ProjectItem>('project_items', tankId);
		} catch {
			projectItems = [];
		}
	}

	onMount(async () => {
		if (!idea) return;
		void loadProject();
		try {
			const rows = await api<Species[]>('GET', `/api/species?names=${encodeURIComponent(speciesNamesOf(idea).join(','))}`);
			const map = new Map<string, Species>();
			for (const s of rows) if (!map.has(s.scientificName.toLowerCase())) map.set(s.scientificName.toLowerCase(), s);
			species = map;
		} catch (e) {
			loadError = (e as Error).message;
		}
	});

	const speciesOf = (latin: string) => species.get(latin.toLowerCase()) ?? null;
	const plan = $derived(idea && ready ? planIdea(idea, volume, speciesOf) : null);
	const plantNames = $derived(idea ? plantsOf(idea, planting) : []);
	const gear = $derived(idea && ready ? equipmentFor(idea, volume, planting) : []);
	const equipmentItems = $derived(projectItems.filter((i) => i.kind === 'equipement'));
	const ownedIds = $derived(new Set(gear.filter((g) => isOwned(g, equipmentItems)).map((g) => g.id)));
	const isOn = (g: EquipmentSuggestion) => !ownedIds.has(g.id) && (gearChoice[g.id] ?? g.essential);
	const chosen = $derived(gear.filter(isOn));
	const gearTotal = $derived(totalOf(chosen));
	const euro = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`;

	const ROLE_LABEL: Record<StockRole, string> = {
		banc: 'En banc',
		vedette: 'Vedette',
		fond: 'Au fond',
		surface: 'En surface',
		nettoyeur: 'Nettoyeur',
		invertebre: 'Invertébré',
		corail: 'Corail'
	};
	const groups = $derived.by(() => {
		if (!plan) return [];
		const by = (f: (l: PlannedLine) => boolean) => plan.lines.filter(f);
		return [
			{ title: 'Poissons', icon: 'fish' as const, color: 'var(--blue)', lines: by((l) => !['invertebre', 'corail'].includes(l.role) && l.species?.kind !== 'invertebre' && l.species?.kind !== 'corail') },
			{ title: 'Invertébrés', icon: 'box' as const, color: 'var(--orange)', lines: by((l) => l.role === 'invertebre' || (l.species?.kind === 'invertebre' && l.role !== 'corail')) },
			{ title: 'Coraux et anémones', icon: 'coral' as const, color: 'var(--pink)', lines: by((l) => l.role === 'corail' || l.species?.kind === 'corail') }
		]
			.map((g) => ({ ...g, lines: g.lines.filter((l, i, all) => all.indexOf(l) === i) }))
			.filter((g) => g.lines.length);
	});

	const levelColor = { ok: 'var(--green)', elevee: 'var(--yellow)', limite: 'var(--orange)', surcharge: 'var(--red)' } as const;
	const severityColor = { bloquant: 'var(--red)', attention: 'var(--orange)', info: 'var(--gray)' } as const;
	const severityLabel = { bloquant: 'À éviter', attention: 'Attention', info: 'Info' } as const;
	const gauge = $derived(Math.min(1, plan?.bioload?.ratio ?? 0));
	const salt = $derived(idea ? idea.water === 'mer' || idea.water === 'recif' : false);

	const project = $derived(tank ? isProject(tank) : false);

	async function addGear() {
		if (!tankId || addingGear || !chosen.length) return;
		addingGear = true;
		try {
			let position = projectItems.reduce((max, i) => Math.max(max, i.position), 0) + 1;
			for (const g of chosen) {
				await createResource('project_items', tankId, {
					kind: 'equipement',
					label: g.label,
					amount: midPrice(g),
					notes: `Estimation ${euro(g.price[0])} à ${euro(g.price[1])} pour ${volume} L. ${g.detail}`,
					position: position++
				});
			}
			await loadProject();
			ui.show(`${chosen.length} élément${chosen.length > 1 ? 's' : ''} ajouté${chosen.length > 1 ? 's' : ''} au matériel du projet`, undefined, 'check');
		} catch (e) {
			ui.show((e as Error).message);
		} finally {
			addingGear = false;
		}
	}

	async function addToWishes() {
		if (!plan || !tankId || adding) return;
		adding = true;
		try {
			const existing = await listResource<{ speciesId: number | null; kind: string }>('project_items', tankId).catch(() => []);
			const have = new Set(existing.filter((i) => i.kind === 'espece').map((i) => i.speciesId));
			let position = existing.length + 1;
			let added = 0;
			const wanted: { species: Species | null; note: string }[] = [
				...plan.lines.map((line) => ({ species: line.species, note: `${line.quantity} conseillé${line.quantity > 1 ? 's' : ''} pour ${volume} L (idée « ${idea?.title} »)` })),
				...plantNames.map((name) => ({ species: speciesOf(name), note: `Plante du biotope ${planting === 'strict' ? 'strict' : 'mixte'} (idée « ${idea?.title} »)` }))
			];
			for (const line of wanted) {
				if (!line.species || have.has(line.species.id)) continue;
				have.add(line.species.id);
				await createResource('project_items', tankId, {
					kind: 'espece',
					label: speciesName(line.species),
					speciesId: line.species.id,
					notes: line.note,
					position: position++
				});
				added++;
			}
			ui.show(added ? `${added} espèce${added > 1 ? 's' : ''} ajoutée${added > 1 ? 's' : ''} à ta liste` : 'Tout est déjà dans ta liste', undefined, 'check');
		} catch (e) {
			ui.show((e as Error).message);
		} finally {
			adding = false;
		}
	}
</script>

<svelte:head><title>{idea?.title ?? 'Idée'} · Idées de peuplement</title></svelte:head>

<NavBar title={idea?.title ?? 'Idée introuvable'} back={{ href: tankId ? `/encyclopedie/idees?bac=${tankId}` : '/encyclopedie/idees', label: 'Idées' }} large={false} />

{#if !idea || !plan}
	<p class="body px-4 py-8 text-label2">Cette idée n’existe pas. <a class="btn-plain" href="/encyclopedie/idees">Voir toutes les idées</a></p>
{:else}
	<article class="pb-4">
		<header class="mb-5 px-1 pt-3">
			<p class="footnote font-semibold uppercase" style="color: {salt ? 'var(--cyan)' : 'var(--green)'}">{idea.region} · {SHORT_WATER[idea.water]}</p>
			<h1 class="title1 mt-0.5">{idea.title}</h1>
			<p class="body mt-1 text-label2">{idea.summary}</p>
			<p class="subhead mt-2 flex flex-wrap items-center gap-x-2 text-label2">
				<span>{volumeLabel(idea)}</span><span aria-hidden="true">·</span><span class="font-semibold">{LEVEL_NAMES[idea.level]}</span>
			</p>
		</header>

		<!-- Volume : les quantités s'adaptent -->
		<section class="raised mb-5 p-4" aria-label="Volume du bac">
			<div class="flex items-baseline justify-between">
				<h2 class="headline">Pour un bac de</h2>
				<p class="title2 tabular-nums">{volume} L</p>
			</div>
			<input
				type="range"
				class="mt-3 w-full accent-blue"
				min={Math.round(idea.volume[0] * 0.8)}
				max={Math.round(idea.volume[1] * 1.4)}
				step="5"
				bind:value={volume}
				aria-label="Volume du bac en litres"
			/>
			<div class="footnote mt-1 flex justify-between text-label2">
				<span>{Math.round(idea.volume[0] * 0.8)} L</span>
				<span>Idéal : {volumeLabel(idea)}</span>
				<span>{Math.round(idea.volume[1] * 1.4)} L</span>
			</div>
			{#if plan.tooSmall}
				<p class="subhead mt-3 rounded-[14px] bg-orange/12 px-3 py-2"><span class="font-semibold">Un peu juste.</span> Ce volume est en dessous de la plage conseillée : les quantités sont au plus bas.</p>
			{:else if plan.fit === 'proche'}
				<p class="subhead mt-3 text-label2">Hors de la plage idéale, mais encore envisageable : les quantités sont ajustées.</p>
			{/if}
		</section>

		<!-- Peuplement conseillé -->
		{#each groups as group (group.title)}
			<Section header={group.title} variant="title">
				{#each group.lines as line (line.latin)}
					{@const s = line.species}
					<Row
						href={s ? `/encyclopedie/especes?id=${s.id}` : `/encyclopedie/especes?q=${encodeURIComponent(line.latin)}`}
						title={s ? speciesName(s) : line.latin}
						subtitle="{s && speciesName(s) !== s.scientificName ? `${line.latin} · ` : ''}{ROLE_LABEL[line.role]}{s?.maxLengthCm ? ` · ${s.maxLengthCm} cm` : ''}"
						value="× {line.quantity}"
					>
						{#snippet leading()}
							{#if s}
								<SpeciesThumb species={s} class="h-10 w-10 shrink-0 rounded-[12px]" iconSize={20} />
							{:else}
								<span class="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-white" style="background: {group.color}; --cut: {group.color}"><Icon name={group.icon} size={20} filled weight={1.8} /></span>
							{/if}
						{/snippet}
					</Row>
				{/each}
			</Section>
		{/each}

		{#if loadError}
			<p class="footnote mb-4 px-1 text-label2">Fiches indisponibles hors ligne : les quantités sont données, la charge biologique ne peut pas être calculée.</p>
		{/if}

		<!-- Charge biologique -->
		{#if plan.analysed && plan.bioload}
			{@const b = plan.bioload}
			<section class="raised mb-5 p-4" aria-label="Charge biologique">
				<div class="flex items-baseline justify-between">
					<h2 class="headline">Charge biologique</h2>
					{#if b.level}<p class="subhead font-semibold" style="color: {levelColor[b.level]}">{BIOLOAD_LABELS[b.level]}</p>{/if}
				</div>
				<div class="mt-3 h-3 overflow-hidden rounded-full bg-fill3" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(gauge * 100)}>
					<div class="h-full rounded-full transition-all duration-500" style="width: {Math.max(4, gauge * 100)}%; background: {b.level ? levelColor[b.level] : 'var(--gray)'}"></div>
				</div>
				<p class="footnote mt-2 text-label2">
					{animalCount(plan)} animaux · {b.loadG} g de biomasse adulte pour une capacité estimée de {b.capacityG ?? '?'} g
					({b.ratio != null ? Math.round(b.ratio * 100) : '?'} %).
				</p>
				{#if plan.reduced}
					<p class="footnote mt-1 text-label2">Les quantités ont été réduites pour garder une marge de confort.</p>
				{/if}
				{#if idea.dense}
					<p class="footnote mt-1 text-label2">Bac volontairement dense : le calcul tient compte d’une filtration très puissante.</p>
				{/if}
			</section>
		{/if}

		<!-- Compatibilité -->
		{#if plan.analysed}
			<Section header="Compatibilité" variant="title" footer="Analyse automatique d’après les fiches : une aide, pas une garantie.">
				{#if plan.issues.length}
					{#each plan.issues as issue, i (i)}
						<li class="flex gap-3 px-4 py-3 shadow-[inset_0_0.5px_0_var(--sep)]">
							<span class="mt-0.5 shrink-0" style="color: {severityColor[issue.severity]}; --cut: var(--bg2)"><Icon name="alert" size={18} filled /></span>
							<p class="subhead min-w-0 flex-1"><span class="font-semibold" style="color: {severityColor[issue.severity]}">{severityLabel[issue.severity]}.</span> {issue.message}</p>
						</li>
					{/each}
				{:else}
					<li class="flex gap-3 px-4 py-3">
						<span class="mt-0.5 shrink-0 text-green" style="--cut: var(--bg2)"><Icon name="info" size={18} filled /></span>
						<p class="subhead min-w-0 flex-1">Aucun conflit détecté entre ces espèces à {volume} L.</p>
					</li>
				{/if}
			</Section>
		{/if}

		<!-- Plantes : biotope strict ou mixte -->
		<section class="mb-5" aria-label="Plantes">
			<div class="mb-2.5 flex items-baseline justify-between px-1">
				<h2 class="title3 font-bold">{salt ? 'Macro-algues' : 'Plantes'}</h2>
				<p class="footnote text-label2">{plantNames.length ? `${plantNames.length} proposée${plantNames.length > 1 ? 's' : ''}` : 'Aucune'}</p>
			</div>
			<Segmented
				label="Choix des plantes"
				bind:value={planting}
				options={[
					{ value: 'strict', label: 'Biotope strict' },
					{ value: 'mixte', label: 'Biotope mixte' }
				]}
			/>
			<p class="footnote mt-2 px-1 text-label2">
				{#if planting === 'strict'}
					Seulement ce qui pousse dans le milieu d’origine{plantNames.length ? '' : ' : et ce milieu n’en comporte pas'}.
				{:else}
					Les plantes du milieu, complétées de plantes d’aquarium qui supportent la même eau.
				{/if}
			</p>
			{#if plantNames.length}
				<ul class="raised mt-3 overflow-hidden">
					{#each plantNames as name, i (name)}
						{@const s = speciesOf(name)}
						<li class={i ? 'shadow-[inset_0_0.5px_0_var(--sep)]' : ''}>
							<a href={s ? `/encyclopedie/especes?id=${s.id}` : `/encyclopedie/especes?q=${encodeURIComponent(name)}`} class="tappable flex min-h-14 items-center gap-3 px-4 py-2">
								{#if s}
									<SpeciesThumb species={s} class="h-10 w-10 shrink-0 rounded-[12px]" iconSize={20} />
								{:else}
									<span class="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-green text-white" style="--cut: var(--green)"><Icon name="leaf" size={20} filled weight={1.8} /></span>
								{/if}
								<span class="min-w-0 flex-1">
									<span class="body block truncate">{s ? speciesName(s) : name}</span>
									<span class="footnote block truncate text-label2">{name}{s?.light ? ` · lumière ${['', 'faible', 'moyenne', 'forte'][s.light]}` : ''}{s?.co2 === 2 ? ' · CO₂ indispensable' : ''}</span>
								</span>
								<span class="text-label3"><Icon name="next" size={15} weight={2.4} /></span>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="subhead mt-3 rounded-[14px] bg-fill3 px-3 py-3">
					{#if salt}
						Un récif se passe de plantes : la roche vive et les coraux font le décor. Choisis « mixte » pour des macro-algues de refuge.
					{:else}
						Dans ce biotope, les rives sont nues : roches, sable et algues du biofilm. Choisis « mixte » si tu veux quelques plantes robustes.
					{/if}
				</p>
			{/if}
			{#if salt && plantNames.includes('Caulerpa prolifera')}
				<p class="footnote mt-2 px-1 text-label2">La caulerpe peut envahir le bac et se multiplie vite : surveille-la ou préfère la chaeto.</p>
			{/if}
		</section>

		<!-- Matériel conseillé -->
		<section class="mb-5" aria-label="Matériel conseillé">
			<div class="mb-2.5 flex items-baseline justify-between px-1">
				<h2 class="title3 font-bold">Matériel conseillé</h2>
				<p class="footnote text-label2">pour {volume} L</p>
			</div>
			<ul class="raised overflow-hidden">
				{#each gear as g, i (g.id)}
					{@const owned = ownedIds.has(g.id)}
					<li class="flex items-start gap-3 px-4 py-3 {i ? 'shadow-[inset_0_0.5px_0_var(--sep)]' : ''}">
						<div class="min-w-0 flex-1">
							<p class="body {owned ? 'text-label2' : ''}">{g.label}</p>
							<p class="footnote text-label2">{CATEGORY_LABELS[g.category]}{g.essential ? '' : ' · facultatif'}</p>
							<p class="footnote mt-0.5 text-label2">{g.detail}</p>
							<p class="subhead mt-1 font-semibold tabular-nums {owned ? 'text-green' : ''}">{owned ? 'Déjà dans ton projet' : `${euro(g.price[0])} à ${euro(g.price[1])}`}</p>
						</div>
						<Switch checked={isOn(g)} disabled={owned} label={g.label} onchange={(e) => (gearChoice[g.id] = e.currentTarget.checked)} />
					</li>
				{/each}
			</ul>
			<div class="raised mt-3 flex items-baseline justify-between px-4 py-3">
				<div>
					<p class="body font-semibold">Budget estimé</p>
					<p class="footnote text-label2">{chosen.length} élément{chosen.length > 1 ? 's' : ''} coché{chosen.length > 1 ? 's' : ''}</p>
				</div>
				<p class="title3 tabular-nums">{chosen.length ? `${euro(gearTotal[0])} à ${euro(gearTotal[1])}` : '0 €'}</p>
			</div>
			{#if project && tankId}
				<ul class="group mt-3">
					<Row icon="plus" iconColor="var(--green)" title={chosen.length ? `Ajouter ${chosen.length} élément${chosen.length > 1 ? 's' : ''} au matériel du projet` : 'Rien de coché à ajouter'} subtitle="Prix estimé retenu : milieu de la fourchette" onclick={addGear} action disabled={!chosen.length || addingGear} />
				</ul>
			{/if}
			<p class="footnote mt-2 px-1 text-label2">Estimations indicatives du neuf en France : compare plusieurs boutiques, l’occasion coûte souvent moins cher.</p>
		</section>

		<!-- Conditions et décor -->
		<section class="mb-5 px-1">
			<h2 class="title3 mb-2 font-bold">Eau et décor</h2>
			<ul class="mb-3 flex flex-wrap gap-2">
				<li class="footnote rounded-full bg-fill3 px-3 py-1.5 font-semibold">{idea.conditions.temp[0]} – {idea.conditions.temp[1]} °C</li>
				<li class="footnote rounded-full bg-fill3 px-3 py-1.5 font-semibold">pH {idea.conditions.ph[0]} – {idea.conditions.ph[1]}</li>
				{#if idea.conditions.dgh}<li class="footnote rounded-full bg-fill3 px-3 py-1.5 font-semibold">GH {idea.conditions.dgh[0]} – {idea.conditions.dgh[1]} °dGH</li>{/if}
			</ul>
			<p class="body leading-relaxed">{idea.decor}</p>
			{#if idea.tip}
				<div class="mt-3 flex gap-3 rounded-[22px] bg-blue/12 py-3 pl-4 pr-4">
					<span class="mt-0.5 shrink-0 text-blue" style="--cut: var(--bg)"><Icon name="info" size={22} filled /></span>
					<p class="subhead min-w-0 flex-1 leading-relaxed"><span class="font-semibold">Astuce.</span> {idea.tip}</p>
				</div>
			{/if}
			{#if idea.warn}
				<div class="mt-3 flex gap-3 rounded-[22px] bg-orange/12 py-3 pl-4 pr-4">
					<span class="mt-0.5 shrink-0 text-orange" style="--cut: var(--bg)"><Icon name="alert" size={22} filled /></span>
					<p class="subhead min-w-0 flex-1 leading-relaxed"><span class="font-semibold">Attention.</span> {idea.warn}</p>
				</div>
			{/if}
		</section>

		<!-- Actions -->
		<Section>
			{#if project && tankId}
				<Row icon="plus" iconColor="var(--green)" title="Ajouter à ma liste de souhaits" subtitle="{tank?.name} · animaux et plantes de cette idée" onclick={addToWishes} action />
			{:else if tankId}
				<Row icon="chart" iconColor="var(--indigo)" title="Tester dans le simulateur" subtitle="Compatibilité et charge de {tank?.name ?? 'ton bac'}" href="/aquariums/{tankId}/peuplement" />
			{/if}
			{#if idea.guide}
				{@const [t, g] = idea.guide.split('/')}
				<Row icon="book" iconColor="var(--orange)" title="Lire le guide du biotope" href="/encyclopedie/{t}/{g}" />
			{/if}
			<Row icon="search" iconColor="var(--teal)" title="D’autres idées pour {volume} L" href="/encyclopedie/idees?{new URLSearchParams({ ...(tankId ? { bac: String(tankId) } : {}), l: String(volume) })}" />
		</Section>

		<p class="caption1 px-4 pb-4 text-label2">Idée rédigée par Claude d’après les fiches de l’encyclopédie : vérifie la compatibilité avec ton vendeur avant d’acheter.</p>
	</article>
{/if}

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
	import { ideaOf, speciesNamesOf } from '$lib/content/ideas';
	import { LEVEL_NAMES, animalCount, planIdea, volumeLabel, type PlannedLine, type StockRole } from '$lib/domain/ideas';
	import { BIOLOAD_LABELS, speciesName } from '$lib/domain/species';
	import { isProject } from '$lib/tank';
	import { SHORT_WATER } from '$lib/ui';
	import type { Species } from '$lib/types';

	const idea = $derived(ideaOf(page.params.slug ?? ''));
	const tankId = $derived(Number(page.url.searchParams.get('bac')) || null);
	const tank = $derived(tankId ? store.view?.aquariums.find((a) => a.id === tankId) : undefined);

	let volume = $state(0);
	let ready = $state(false);
	let species = $state(new Map<string, Species>());
	let loadError = $state('');
	let adding = $state(false);

	// Volume de départ : ?l, sinon le bac choisi, sinon le volume de référence de l'idée.
	$effect(() => {
		if (ready || !idea) return;
		const asked = Number(page.url.searchParams.get('l'));
		const start = asked > 0 ? asked : (tank?.volumeL ?? 0) || idea.ref;
		// Reste dans une plage qui a du sens pour le curseur.
		volume = Math.round(Math.min(Math.max(start, idea.volume[0] * 0.8), idea.volume[1] * 1.4));
		ready = true;
	});

	onMount(async () => {
		if (!idea) return;
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

	async function addToWishes() {
		if (!plan || !tankId || adding) return;
		adding = true;
		try {
			const existing = await listResource<{ speciesId: number | null; kind: string }>('project_items', tankId).catch(() => []);
			const have = new Set(existing.filter((i) => i.kind === 'espece').map((i) => i.speciesId));
			let position = existing.length + 1;
			let added = 0;
			for (const line of plan.lines) {
				if (!line.species || have.has(line.species.id)) continue;
				await createResource('project_items', tankId, {
					kind: 'espece',
					label: speciesName(line.species),
					speciesId: line.species.id,
					notes: `${line.quantity} conseillé${line.quantity > 1 ? 's' : ''} pour ${volume} L (idée « ${idea?.title} »)`,
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

		<!-- Conditions et décor -->
		<section class="mb-5 px-1">
			<h2 class="title3 mb-2 font-bold">Eau et décor</h2>
			<ul class="mb-3 flex flex-wrap gap-2">
				<li class="footnote rounded-full bg-fill3 px-3 py-1.5 font-semibold">{idea.conditions.temp[0]} – {idea.conditions.temp[1]} °C</li>
				<li class="footnote rounded-full bg-fill3 px-3 py-1.5 font-semibold">pH {idea.conditions.ph[0]} – {idea.conditions.ph[1]}</li>
				{#if idea.conditions.dgh}<li class="footnote rounded-full bg-fill3 px-3 py-1.5 font-semibold">GH {idea.conditions.dgh[0]} – {idea.conditions.dgh[1]} °dGH</li>{/if}
			</ul>
			<p class="body leading-relaxed">{idea.decor}</p>
			{#if idea.plants?.length}
				<p class="subhead mt-3 text-label2">
					{salt ? 'Macro-algues' : 'Plantes conseillées'} :
					{#each idea.plants as plant, i (plant)}<a class="btn-plain" href="/encyclopedie/especes?q={encodeURIComponent(plant)}">{plant}</a>{i < idea.plants.length - 1 ? ', ' : '.'}{/each}
				</p>
			{/if}
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
				<Row icon="plus" iconColor="var(--green)" title="Ajouter à ma liste de souhaits" subtitle="{tank?.name} · espèces de cette idée" onclick={addToWishes} action />
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

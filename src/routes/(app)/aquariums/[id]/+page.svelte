<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { listResource } from '$lib/client/api';
	import { analyzeParameter, driftThreshold, slopePerDay } from '$lib/domain/drift';
	import { DAY_MS, dayInParis } from '$lib/domain/dates';
	import { cyclingForAquarium } from '$lib/domain/cycling';
	import { journeySteps, type JourneyStep } from '$lib/domain/journey';
	import { tankStability } from '$lib/domain/stability';
	import { daysSinceEvent } from '$lib/domain/events';
	import { stageOf, tankHealth } from '$lib/tank';
	import { SHORT_WATER, TANK_TONE, fmt, relativeDay, tankAge } from '$lib/ui';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import TankTabs from '$lib/ios/TankTabs.svelte';
	import Spark from '$lib/ios/Spark.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Sheet from '$lib/ios/Sheet.svelte';
	import JourneyCard from '$lib/ios/JourneyCard.svelte';
	import FeedButton from '$lib/ios/FeedButton.svelte';
	import EventSheet from '$lib/ios/EventSheet.svelte';
	import type { Parameter, ProjectItem } from '$lib/types';

	const id = $derived(Number(page.params.id));
	const view = $derived(store.view);
	const aquarium = $derived(view?.aquariums.find((a) => a.id === id));
	const health = $derived(view && aquarium ? tankHealth(view, aquarium) : null);
	const parameters = $derived((view?.parameters ?? []).filter((p) => p.aquariumId === id));
	const measurements = $derived((view?.measurements ?? []).filter((m) => m.aquariumId === id));
	const today = dayInParis();

	const stage = $derived(aquarium ? stageOf(aquarium) : 'actif');

	// Un bac en projet n'a pas de suivi : on ouvre directement son écran de projet.
	$effect(() => {
		if (aquarium && stage === 'projet') void goto(`/aquariums/${id}/projet`, { replaceState: true });
	});

	// --- Parcours du bac (étapes selon qu'il est en projet, en cyclage ou actif) ---
	let inhabitantsCount = $state(0);
	let projectItems = $state<ProjectItem[]>([]);
	onMount(async () => {
		try {
			const [inhabitants, items] = await Promise.all([
				listResource<{ leftOn: string | null }>('inhabitants', id),
				listResource<ProjectItem>('project_items', id)
			]);
			inhabitantsCount = inhabitants.filter((i) => !i.leftOn).length;
			projectItems = items;
		} catch {
			// Hors ligne : le parcours se déduit alors des seules données du cache.
		}
	});
	const journey = $derived(
		aquarium
			? journeySteps({
					aquarium,
					parameters,
					measurements,
					tasks: (view?.tasks ?? []).filter((t) => t.aquariumId === id),
					events: (view?.events ?? []).filter((e) => e.aquariumId === id),
					inhabitantsCount,
					projectItems,
					cycling: cyclingForAquarium(parameters, measurements),
					today
				})
			: []
	);
	const showJourney = $derived(stage !== 'actif' || journey.some((s) => s.status === 'current'));

	async function setStage(next: 'cyclage' | 'actif') {
		if (!aquarium) return;
		const ok = await ui.confirm(
			next === 'cyclage'
				? { title: 'Lancer la mise en eau ?', message: 'Le bac passe en cyclage : les tests tous les 2 jours et le coach de cyclage démarrent aujourd’hui.', confirmLabel: 'Mettre en eau' }
				: { title: 'Passer en bac actif ?', message: 'Le cyclage est terminé : le bac passe à sa routine d’entretien.', confirmLabel: 'Passer en actif' }
		);
		if (!ok) return;
		try {
			await store.setStage(id, next);
			ui.show(next === 'cyclage' ? 'Bac mis en eau' : 'Bac actif', undefined, 'check');
		} catch (e) {
			ui.show((e as Error).message);
		}
	}
	function onJourneyAction(step: JourneyStep) {
		const href = step.action?.href;
		if (!href) return;
		if (href === '?etape=mise-en-eau') void setStage('cyclage');
		else if (href === '?etape=actif') void setStage('actif');
		else void goto(href.startsWith('?') ? `/aquariums/${id}${href}` : href);
	}

	// Un lien ?etape=… (depuis une notification ou l'accueil guidé) déclenche la même confirmation.
	let handledEtape = false;
	$effect(() => {
		const etape = page.url.searchParams.get('etape');
		if (!etape || handledEtape || !aquarium) return;
		handledEtape = true;
		void goto(`/aquariums/${id}`, { replaceState: true, noScroll: true });
		if (etape === 'mise-en-eau' && stage === 'projet') void setStage('cyclage');
		else if (etape === 'actif' && stage === 'cyclage') void setStage('actif');
	});

	// --- Stabilité sur 30 jours ---
	const stability = $derived(tankStability(parameters, measurements));
	let showStability = $state(false);
	const stabilityLabel = (score: number) => (score >= 85 ? 'Très stable' : score >= 70 ? 'Stable' : score >= 50 ? 'Variable' : 'Instable');
	const stabilityTone = (score: number) => (score >= 70 ? 'var(--green)' : score >= 50 ? 'var(--orange)' : 'var(--red)');
	const RING = 2 * Math.PI * 15;
	const nameOf = (parameterId: number) => parameters.find((p) => p.id === parameterId)?.name ?? '';

	// --- Changement d'eau ---
	const waterDays = $derived(daysSinceEvent(view?.events ?? [], id, 'changement_eau'));
	const lastWater = $derived(
		[...(view?.events ?? [])]
			.filter((e) => e.aquariumId === id && e.kind === 'changement_eau' && (e.payload?.percent != null || e.payload?.litres != null))
			.sort((a, b) => b.at.localeCompare(a.at))[0] ?? null
	);
	let waterSheet = $state(false);
	const waterPrefill = $derived(
		lastWater
			? Object.fromEntries(Object.entries(lastWater.payload).filter(([k]) => ['percent', 'litres', 'source', 'conditioner'].includes(k)))
			: undefined
	);
	const waterDetail = $derived(
		lastWater
			? [lastWater.payload.percent != null ? `${fmt(lastWater.payload.percent as number, 0)} %` : null, lastWater.payload.litres != null ? `${fmt(lastWater.payload.litres as number, 0)} L` : null]
					.filter(Boolean)
					.join(' · ')
			: ''
	);

	type Trend = 'up' | 'down' | 'flat' | null;

	// Carte de paramètre : dernière valeur, tendance sur 7 jours, état.
	const tiles = $derived(
		parameters.map((p) => {
			const list = measurements.filter((m) => m.parameterId === p.id);
			const points = list.map((m) => ({ t: new Date(m.measuredAt).getTime(), v: m.value }));
			const last = list.length ? list[list.length - 1] : null;
			const alert = analyzeParameter(p, list);
			const recent = points.filter((pt) => pt.t >= Date.now() - 7 * DAY_MS);
			const slope = recent.length >= 2 ? slopePerDay(recent) : null;
			let trend: Trend = null;
			if (slope != null) {
				const change = slope * 7;
				const threshold = driftThreshold(p) ?? Math.abs(last?.value ?? 1) * 0.1;
				trend = Math.abs(change) < threshold * 0.25 ? 'flat' : change > 0 ? 'up' : 'down';
			}
			return { p, points: points.slice(-14), last, alert, trend };
		})
	);

	const stageIndex = { demarrage: 0, pic_nitrites: 1, finalisation: 2, pret: 3, aucune_mesure: -1 } as const;
	const stages = ['Ammoniac', 'Nitrites', 'Nitrates'];
	const trendLabel = { up: 'En hausse', down: 'En baisse', flat: 'Stable' } as const;

	/** Icône d'un paramètre selon sa clé. */
	function iconOf(p: Parameter): IconName {
		if (p.key === 'temp') return 'thermo';
		if (p.key === 'salinity') return 'drop';
		if (['nh3', 'no2', 'no3', 'po4'].includes(p.key ?? '')) return 'flask';
		return 'chart';
	}

	/** « Aujourd'hui 09:37 », « Hier », « il y a 3 j ». */
	function when(iso: string): string {
		const day = relativeDay(dayInParis(iso), today);
		if (day === "aujourd'hui") return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
		return day.charAt(0).toUpperCase() + day.slice(1);
	}

	// Photo de couverture façon fiche de Plans : parallaxe, barre de verre une fois la photo passée.
	const cover = $derived(aquarium?.coverPhotoId ?? null);
	let scrollY = $state(0);
	let heroH = $state(0);
	$effect(() => {
		const update = () => (scrollY = window.scrollY);
		update();
		addEventListener('scroll', update, { passive: true });
		return () => removeEventListener('scroll', update);
	});
	const past = $derived(heroH > 0 && scrollY > heroH - 100);

	const kicker = $derived(
		aquarium
			? [SHORT_WATER[aquarium.waterType], aquarium.volumeL ? `${fmt(aquarium.volumeL, 0)} L` : null, tankAge(aquarium) != null ? `jour ${tankAge(aquarium)}` : null]
					.filter(Boolean)
					.join(' · ')
			: undefined
	);
</script>

<svelte:head><title>{aquarium?.name ?? 'Bac'} · Aquarium</title></svelte:head>

{#if !aquarium || !health}
	<NavBar title="Bac" back={{ href: '/aquariums', label: 'Bacs' }} large={false} />
	<p class="subhead mt-10 text-center text-label2">Ce bac n’existe pas ou plus.</p>
{:else}
	{@const tone = TANK_TONE[aquarium.waterType]}
	{#if cover != null}
		<!-- Barre posée sur la photo : boutons de verre, puis verre et titre compact une fois la photo passée. -->
		<div
			class="fixed inset-x-0 top-0 z-20 mx-auto max-w-md transition-[background-color,box-shadow] duration-200 {past ? 'bar-material shadow-[0_0.5px_0_var(--sep)]' : ''}"
			style="padding-top: env(safe-area-inset-top)"
		>
			<div class="grid h-11 grid-cols-[1fr_auto_1fr] items-center px-3">
				<a
					href="/aquariums"
					data-nav="pop"
					class="pressable grid h-9 w-9 place-items-center justify-self-start rounded-full {past ? 'text-tint' : 'glass text-label'}"
					aria-label="Retour aux bacs"
				>
					<Icon name="back" size={22} weight={2.4} />
				</a>
				<p class="headline max-w-[56vw] truncate transition-opacity duration-200 {past ? 'opacity-100' : 'opacity-0'}">{aquarium.name}</p>
				<a
					href="/aquariums/{id}/reglages"
					class="pressable grid h-9 w-9 place-items-center justify-self-end rounded-full {past ? 'text-tint' : 'glass text-label'}"
					aria-label="Réglages du bac"
				>
					<Icon name="ellipsis" size={22} />
				</a>
			</div>
		</div>
		<div class="relative -mx-4 overflow-hidden bg-black" style="height: 42dvh; min-height: 260px" bind:clientHeight={heroH}>
			<img
				src="/api/photos/{cover}"
				alt=""
				class="absolute inset-0 h-full w-full object-cover"
				style="transform: translateY({Math.max(0, scrollY) * 0.4}px) scale({1 + Math.max(0, -scrollY) / 400}); transform-origin: top"
				draggable="false"
			/>
			<div class="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/65"></div>
			<div class="absolute inset-x-4 bottom-4 text-white">
				{#if kicker}<p class="footnote font-semibold uppercase text-white/80">{kicker}</p>{/if}
				<h1 class="large-title break-words drop-shadow-[0_1px_8px_rgb(0_0_0/0.35)]">{aquarium.name}</h1>
			</div>
		</div>
		<div class="mt-3"><TankTabs {aquarium} tab="suivi" /></div>
	{:else}
		<NavBar title={aquarium.name} back={{ href: '/aquariums', label: 'Bacs' }} {kicker}>
			{#snippet trailing()}
				<a href="/aquariums/{id}/reglages" class="glass pressable grid h-9 w-9 place-items-center rounded-full text-tint" aria-label="Réglages du bac">
					<Icon name="ellipsis" size={22} />
				</a>
			{/snippet}
			<TankTabs {aquarium} tab="suivi" />
		</NavBar>
	{/if}

	{#if showJourney}
		<div class="mt-3"><JourneyCard {aquarium} steps={journey} compact={stage === 'actif'} onaction={onJourneyAction} /></div>
	{/if}

	<!-- État du bac -->
	<div class="mb-6 mt-3">
		{#if health.coach}
			{@const at = stageIndex[health.coach.stage]}
			<div class="rounded-[22px] bg-bg2 p-4">
				<div class="mb-3 flex items-center gap-1.5 text-indigo">
					<Icon name="cycle" size={17} weight={2} />
					<span class="subhead font-semibold">Cyclage en cours</span>
				</div>
				<div class="mb-3 grid grid-cols-3 gap-1.5">
					{#each stages as s, i (s)}
						<div>
							<div class="mb-1 h-1.5 rounded-full {i < at ? 'bg-indigo' : i === at ? 'bg-indigo/40' : 'bg-fill'}"></div>
							<p class="caption1 font-semibold {i <= at ? 'text-label' : 'text-label3'}">{s}</p>
						</div>
					{/each}
				</div>
				<p class="headline">{health.coach.title.replace('Cyclage : ', '').replace(/^./, (c) => c.toUpperCase())}</p>
				<p class="subhead mt-0.5 text-label2">{health.coach.advice}</p>
			</div>
		{:else if health.alerts.length}
			<ul class="group">
				{#each health.alerts as a (a.parameterId)}
					{@const bad = a.level === 'hors_plage'}
					<li class="[&+li]:shadow-[inset_0_0.5px_0_var(--sep)]">
						<a href="/aquariums/{id}/parametre/{a.parameterId}" class="tappable flex items-center gap-3 px-4 py-3">
							<span class={bad ? 'text-red' : 'text-orange'} style="--cut: var(--bg2)"><Icon name="alert" size={22} filled weight={1.8} /></span>
							<div class="min-w-0 flex-1">
								<p class="subhead font-semibold {bad ? 'text-red' : 'text-orange'}">{bad ? 'Hors plage' : 'Dérive'}</p>
								<p class="body">{a.message}</p>
							</div>
							<span class="text-label3"><Icon name="next" size={16} weight={2.4} /></span>
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<div class="flex items-center gap-3 rounded-[22px] bg-bg2 px-4 py-3.5">
				<span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-green text-white"><Icon name="check" size={18} weight={2.8} /></span>
				<div>
					<p class="headline">{health.label}</p>
					{#if health.lastMeasuredAt}<p class="footnote text-label2">Dernière mesure : {when(health.lastMeasuredAt).toLowerCase()}</p>{/if}
				</div>
			</div>
		{/if}
	</div>

	<div class="mb-8 flex items-center gap-2.5">
		<a href="/mesurer?bac={id}" class="btn-filled min-w-0 flex-1">
			<Icon name="plus" size={20} weight={2.6} />Saisir des mesures
		</a>
		<FeedButton aquariumId={id} compact />
	</div>

	<!-- Entretien et stabilité -->
	<Section header="Entretien">
		<Row
			icon="drop"
			iconColor="var(--cyan)"
			title="Changement d’eau"
			subtitle={waterDays == null ? 'Aucun changement noté' : `${waterDays === 0 ? 'Aujourd’hui' : waterDays === 1 ? 'Hier' : `Il y a ${waterDays} jours`}${waterDetail ? ` · ${waterDetail}` : ''}`}
		>
			{#snippet trailing()}
				<button type="button" class="subhead rounded-full bg-tint/15 px-3.5 py-1.5 font-semibold text-tint active:opacity-60" onclick={() => (waterSheet = true)}>
					Fait
				</button>
			{/snippet}
		</Row>
		{#if stability.score != null}
			{@const sc = stability.score}
			<Row onclick={() => (showStability = true)} chevron>
				{#snippet leading()}
					<svg width="30" height="30" viewBox="0 0 36 36" class="shrink-0 -rotate-90" aria-hidden="true">
						<circle cx="18" cy="18" r="15" fill="none" stroke="var(--fill)" stroke-width="5" />
						<circle cx="18" cy="18" r="15" fill="none" stroke={stabilityTone(sc)} stroke-width="5" stroke-linecap="round" stroke-dasharray="{(RING * sc) / 100} {RING}" />
					</svg>
				{/snippet}
				<p class="body">Stabilité · <span class="rounded-num font-semibold" style="color: {stabilityTone(sc)}">{sc} %</span></p>
				<p class="subhead text-label2">{stabilityLabel(sc)} sur 30 jours</p>
			</Row>
		{/if}
	</Section>

	<!-- Paramètres, façon cartes Santé -->
	<section class="mb-8">
		<div class="mb-2 flex items-baseline justify-between px-1">
			<h2 class="title3 font-bold">Paramètres</h2>
			<a href="/aquariums/{id}/reglages" class="btn-plain subhead">Plages</a>
		</div>
		{#if tiles.length === 0}
			<p class="subhead rounded-[22px] bg-bg2 px-4 py-3.5 text-label2">Aucun paramètre suivi. Ajoute-en dans les réglages du bac.</p>
		{:else}
			<div class="flex flex-col gap-2.5">
				{#each tiles as t (t.p.id)}
					{@const state = t.alert?.level === 'hors_plage' ? 'bad' : t.alert?.level === 'derive' ? 'warn' : 'ok'}
					{@const color = state === 'bad' ? 'var(--red)' : state === 'warn' ? 'var(--orange)' : tone}
					<a href="/aquariums/{id}/parametre/{t.p.id}" class="pressable block rounded-[22px] bg-bg2 p-4">
						<div class="flex items-center gap-1.5" style="color: {color}; --cut: var(--bg2)">
							<Icon name={iconOf(t.p)} size={17} filled weight={1.8} />
							<span class="subhead min-w-0 flex-1 truncate font-semibold">{t.p.name}</span>
							{#if t.last}<span class="footnote shrink-0 text-label2">{when(t.last.measuredAt)}</span>{/if}
							<span class="text-label3"><Icon name="next" size={15} weight={2.4} /></span>
						</div>
						<div class="mt-2 flex items-end gap-3">
							<div class="min-w-0 flex-1">
								{#if t.last}
									<p class="rounded-num truncate">
										<span class="text-[30px] font-semibold leading-9">{fmt(t.last.value, t.p.decimals)}</span>
										{#if t.p.unit}<span class="subhead font-semibold text-label2"> {t.p.unit}</span>{/if}
									</p>
									<p class="footnote text-label2">
										{#if state === 'bad'}<span class="font-semibold text-red">Hors plage</span>
										{:else if state === 'warn'}<span class="font-semibold text-orange">Dérive</span>
										{:else if t.trend}{trendLabel[t.trend]}{/if}
										{#if t.p.min != null && t.p.max != null}<span> · plage {fmt(t.p.min, t.p.decimals)}–{fmt(t.p.max, t.p.decimals)}</span>{/if}
									</p>
								{:else}
									<p class="body text-label3">Pas encore de mesure</p>
								{/if}
							</div>
							<Spark points={t.points} min={t.p.min} max={t.p.max} {color} />
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</section>

	<Section>
		<Row href="/aquariums/{id}/journal" icon="book" iconColor="var(--brown)" title="Journal" subtitle="Événements, notes et photos du bac" />
		<Row href="/aquariums/{id}/aide" icon="info" iconColor="var(--orange)" title="Demander de l’aide" subtitle="Un résumé du bac à coller sur un forum" />
	</Section>

	<EventSheet
		open={waterSheet}
		aquariumId={id}
		volumeL={aquarium.volumeL}
		waterType={aquarium.waterType}
		kind="changement_eau"
		prefill={waterPrefill}
		onclose={() => (waterSheet = false)}
	/>

	<Sheet open={showStability} title="Stabilité" detent="medium" cancelLabel="Fermer" onclose={() => (showStability = false)}>
		<Section footer="Calculée sur 30 jours, à partir de la variabilité des mesures par rapport à leur plage et de la part de valeurs hors plage. Il faut au moins 3 mesures et une plage définie.">
			{#each [...stability.parameters].sort((a, b) => a.score - b.score) as s (s.parameterId)}
				<Row title={nameOf(s.parameterId)} subtitle={s.reason}>
					{#snippet trailing()}
						<span class="rounded-num headline" style="color: {stabilityTone(s.score)}">{s.score} %</span>
					{/snippet}
				</Row>
			{/each}
		</Section>
	</Sheet>
{/if}

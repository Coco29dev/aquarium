<script lang="ts">
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { analyzeParameter, driftThreshold, slopePerDay } from '$lib/domain/drift';
	import { DAY_MS, dayInParis } from '$lib/domain/dates';
	import { tankHealth } from '$lib/tank';
	import { SHORT_WATER, TANK_TONE, fmt, relativeDay, tankAge } from '$lib/ui';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import TankTabs from '$lib/ios/TankTabs.svelte';
	import Spark from '$lib/ios/Spark.svelte';
	import type { Parameter } from '$lib/types';

	const id = $derived(Number(page.params.id));
	const view = $derived(store.view);
	const aquarium = $derived(view?.aquariums.find((a) => a.id === id));
	const health = $derived(view && aquarium ? tankHealth(view, aquarium) : null);
	const parameters = $derived((view?.parameters ?? []).filter((p) => p.aquariumId === id));
	const measurements = $derived((view?.measurements ?? []).filter((m) => m.aquariumId === id));
	const today = dayInParis();

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
	<NavBar title={aquarium.name} back={{ href: '/aquariums', label: 'Bacs' }} {kicker}>
		{#snippet trailing()}
			<a href="/aquariums/{id}/reglages" class="glass pressable grid h-9 w-9 place-items-center rounded-full text-tint" aria-label="Réglages du bac">
				<Icon name="ellipsis" size={22} />
			</a>
		{/snippet}
		<TankTabs {aquarium} tab="suivi" />
	</NavBar>

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

	<a href="/mesurer?bac={id}" class="btn-filled mb-8 w-full">
		<Icon name="plus" size={20} weight={2.6} />Saisir des mesures
	</a>

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
{/if}

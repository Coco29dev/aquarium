<script lang="ts">
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { analyzeParameter, driftThreshold, slopePerDay } from '$lib/domain/drift';
	import { DAY_MS, dayInParis } from '$lib/domain/dates';
	import { tankHealth } from '$lib/tank';
	import { fmt, relativeDay } from '$lib/ui';
	import Icon from '$lib/components/Icon.svelte';
	import RangeBar from '$lib/components/RangeBar.svelte';
	import Sparkline from '$lib/components/Sparkline.svelte';
	import TankHeader from '$lib/components/TankHeader.svelte';
	import type { Parameter } from '$lib/types';

	const id = $derived(Number(page.params.id));
	const view = $derived(store.view);
	const aquarium = $derived(view?.aquariums.find((a) => a.id === id));
	const health = $derived(view && aquarium ? tankHealth(view, aquarium) : null);
	const parameters = $derived((view?.parameters ?? []).filter((p) => p.aquariumId === id));
	const measurements = $derived((view?.measurements ?? []).filter((m) => m.aquariumId === id));

	type Trend = 'up' | 'down' | 'flat' | null;

	// Tuile de paramètre : dernière valeur, tendance 7 j, état.
	const tiles = $derived(
		parameters.map((p) => {
			const list = measurements.filter((m) => m.parameterId === p.id);
			const points = list.map((m) => ({ t: new Date(m.measuredAt).getTime(), v: m.value }));
			const last = list.length ? list[list.length - 1] : null;
			const alert = analyzeParameter(p, list);
			const now = Date.now();
			const recent = points.filter((pt) => pt.t >= now - 7 * DAY_MS);
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
	const trendIcon = { up: 'up', down: 'down', flat: 'flat' } as const;
	const trendLabel = { up: 'en hausse', down: 'en baisse', flat: 'stable' } as const;

	const tone = (t: (typeof tiles)[number]) =>
		t.alert?.level === 'hors_plage' ? 'bad' : t.alert?.level === 'derive' ? 'warn' : null;
	const unit = (p: Parameter) => p.unit;
</script>

<svelte:head><title>{aquarium?.name ?? 'Bac'} · Bulle</title></svelte:head>

{#if !aquarium || !health}
	<p class="hand text-lg text-muted">Ce bac n’existe pas ou plus.</p>
{:else}
	<TankHeader {aquarium} tab="suivi" />

	<!-- État du bac -->
	{#if health.coach}
		{@const at = stageIndex[health.coach.stage]}
		<section class="card rise mb-5 overflow-hidden">
			<div class="grid grid-cols-3 border-b-2 border-edge bg-surface2">
				{#each stages as s, i (s)}
					<div class="flex flex-col items-center gap-1 px-1 py-3 text-center {i < 2 ? 'border-r-2 border-edge' : ''}">
						<span class="grid h-7 w-7 place-items-center rounded-full border-2 border-edge {i < at ? 'bg-ink text-on-ink' : i === at ? 'bg-sun text-[#16202e]' : 'bg-surface'}">
							{#if i < at}<Icon name="check" size={15} />{:else}<span class="num text-xs">{i + 1}</span>{/if}
						</span>
						<span class="text-xs font-bold">{s}</span>
					</div>
				{/each}
			</div>
			<div class="p-4">
				<p class="num mb-1 text-[11px] uppercase tracking-wider text-muted">Coach de cyclage</p>
				<p class="display mb-1 text-xl first-letter:uppercase">{health.coach.title.replace('Cyclage : ', '')}</p>
				<p class="hand text-lg leading-snug text-muted">{health.coach.advice}</p>
			</div>
		</section>
	{:else if health.alerts.length}
		<section class="rise mb-5 flex flex-col gap-2">
			{#each health.alerts as alert (alert.parameterId)}
				{@const bad = alert.level === 'hors_plage'}
				<a
					href="/aquariums/{id}/parametre/{alert.parameterId}"
					class="press flex items-center gap-3 rounded-[0.875rem] border-2 px-4 py-3 {bad ? 'border-bad bg-bad-soft text-bad' : 'border-warn bg-warn-soft text-warn'}"
				>
					<Icon name="alert" size={20} />
					<span class="min-w-0 flex-1 text-sm font-bold leading-snug">{alert.message}</span>
					<Icon name="next" size={18} />
				</a>
			{/each}
		</section>
	{:else}
		<p class="rise mb-5 flex items-center gap-2 text-sm font-bold text-ok">
			<span class="h-2.5 w-2.5 rounded-full border border-edge bg-ok"></span>{health.label}
			{#if health.lastMeasuredAt}
				<span class="font-normal text-muted">· mesuré {relativeDay(dayInParis(health.lastMeasuredAt))}</span>
			{/if}
		</p>
	{/if}

	<a href="/mesurer?bac={id}" class="btn rise mb-8 w-full text-base" style="animation-delay: 40ms">
		<Icon name="drop" size={20} />Saisir des mesures
	</a>

	<!-- Paramètres -->
	<section class="rise" style="animation-delay: 80ms">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="tape">Paramètres</h2>
			<a href="/aquariums/{id}/reglages" class="text-sm font-bold text-muted underline decoration-2 underline-offset-4">Plages</a>
		</div>
		{#if parameters.length === 0}
			<p class="hand text-lg text-muted">Aucun paramètre suivi. Ajoute-en dans les réglages du bac.</p>
		{:else}
			<ul class="grid grid-cols-2 gap-3">
				{#each tiles as t (t.p.id)}
					{@const state = tone(t)}
					<li class="min-w-0">
						<a
							href="/aquariums/{id}/parametre/{t.p.id}"
							class="card press flex h-full min-w-0 flex-col gap-2 p-3 {state === 'bad' ? 'bg-bad-soft' : state === 'warn' ? 'bg-warn-soft' : ''}"
						>
							<p class="flex items-center justify-between gap-1">
								<span class="truncate text-xs font-bold {state === 'bad' ? 'text-bad' : state === 'warn' ? 'text-warn' : 'text-muted'}">{t.p.name}</span>
								{#if t.trend}
									<span class="shrink-0 text-muted" title={trendLabel[t.trend]}>
										<Icon name={trendIcon[t.trend]} size={15} />
										<span class="sr-only">{trendLabel[t.trend]}</span>
									</span>
								{/if}
							</p>
							<p class="flex items-baseline gap-1">
								<span class="num text-[1.7rem] leading-none">{t.last ? fmt(t.last.value, t.p.decimals) : '—'}</span>
								{#if unit(t.p)}<span class="num text-xs text-muted">{unit(t.p)}</span>{/if}
							</p>
							<RangeBar value={t.last?.value ?? null} min={t.p.min} max={t.p.max} />
							<div class="mt-auto flex items-end justify-between gap-2">
								<span class="text-[11px] text-muted">{t.last ? relativeDay(dayInParis(t.last.measuredAt)) : 'jamais mesuré'}</span>
								<Sparkline
									points={t.points}
									min={t.p.min}
									max={t.p.max}
									width={64}
									height={24}
									tone={state === 'bad' ? 'var(--bad)' : state === 'warn' ? 'var(--warn)' : 'var(--ink)'}
								/>
							</div>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}

<script lang="ts">
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { analyzeParameter, driftThreshold, slopePerDay } from '$lib/domain/drift';
	import { DAY_MS, dayInParis } from '$lib/domain/dates';
	import { TANK_TONE, fmt, relativeDay, shortDate } from '$lib/ui';
	import Chart from '$lib/components/Chart.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import RangeBar from '$lib/components/RangeBar.svelte';

	const id = $derived(Number(page.params.id));
	const pid = $derived(Number(page.params.pid));
	const view = $derived(store.view);
	const aquarium = $derived(view?.aquariums.find((a) => a.id === id));
	const parameter = $derived(view?.parameters.find((p) => p.id === pid && p.aquariumId === id));
	const list = $derived((view?.measurements ?? []).filter((m) => m.parameterId === pid));
	const last = $derived(list.length ? list[list.length - 1] : null);
	const alert = $derived(parameter ? analyzeParameter(parameter, list) : null);

	const periods = [
		{ days: 14, label: '2 sem.' },
		{ days: 30, label: '1 mois' },
		{ days: 90, label: '3 mois' }
	];
	let days = $state(30);
	const points = $derived(
		list
			.map((m) => ({ t: new Date(m.measuredAt).getTime(), v: m.value }))
			.filter((p) => p.t >= Date.now() - days * DAY_MS)
	);

	// Variation estimée sur 7 jours (régression sur la dernière semaine).
	const change7d = $derived.by(() => {
		const recent = list
			.map((m) => ({ t: new Date(m.measuredAt).getTime(), v: m.value }))
			.filter((p) => p.t >= Date.now() - 7 * DAY_MS);
		const slope = recent.length >= 2 ? slopePerDay(recent) : null;
		return slope == null ? null : slope * 7;
	});
	const threshold = $derived(parameter ? driftThreshold(parameter) : null);

	let showAll = $state(false);
	const history = $derived([...list].reverse());
	const shown = $derived(showAll ? history : history.slice(0, 12));

	const outside = (v: number) =>
		parameter != null && ((parameter.min != null && v < parameter.min) || (parameter.max != null && v > parameter.max));
	const signed = (v: number, d: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v), d)}`;
	const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
</script>

<svelte:head><title>{parameter?.name ?? 'Paramètre'} · Bulle</title></svelte:head>

{#if !aquarium || !parameter}
	<p class="hand text-lg text-muted">Ce paramètre n’existe pas ou plus.</p>
{:else}
	{@const state = alert?.level === 'hors_plage' ? 'bad' : alert?.level === 'derive' ? 'warn' : 'ok'}
	<header class="-mx-5 -mt-6 mb-6 border-b-2 border-edge px-5 pb-5 pt-5" style="background: {TANK_TONE[aquarium.waterType]}">
		<a href="/aquariums/{id}" class="-ml-1 mb-4 flex w-fit items-center gap-1 text-sm font-bold"><Icon name="back" size={18} />{aquarium.name}</a>
		<p class="num text-[11px] uppercase tracking-wider">{parameter.name}</p>
		<p class="mt-2 flex items-baseline gap-2">
			<span class="num text-[3.4rem] leading-none">{last ? fmt(last.value, parameter.decimals) : '—'}</span>
			{#if parameter.unit}<span class="num text-lg">{parameter.unit}</span>{/if}
		</p>
		<p class="mt-2 text-sm">
			{last ? `Mesuré ${relativeDay(dayInParis(last.measuredAt))} à ${time(last.measuredAt)}` : 'Jamais mesuré'}
		</p>
	</header>

	<section class="card rise mb-6 flex flex-col gap-3 p-4">
		<p class="flex items-center gap-2 text-sm font-bold {state === 'bad' ? 'text-bad' : state === 'warn' ? 'text-warn' : 'text-ok'}">
			<span class="h-2.5 w-2.5 rounded-full border border-edge {state === 'bad' ? 'bg-bad' : state === 'warn' ? 'bg-warn' : 'bg-ok'}"></span>
			{alert ? alert.message : last ? 'Dans la plage et stable' : 'En attente d’une première mesure'}
		</p>
		<RangeBar value={last?.value ?? null} min={parameter.min} max={parameter.max} />
		<dl class="grid grid-cols-2 gap-3 text-sm">
			<div>
				<dt class="text-xs text-muted">Plage acceptable</dt>
				<dd class="num">
					{parameter.min == null && parameter.max == null
						? 'non définie'
						: `${parameter.min == null ? '…' : fmt(parameter.min, parameter.decimals)} – ${parameter.max == null ? '…' : fmt(parameter.max, parameter.decimals)}`}
				</dd>
			</div>
			<div>
				<dt class="text-xs text-muted">Sur 7 jours</dt>
				<dd class="num">
					{change7d == null ? '—' : `${signed(change7d, parameter.decimals)} ${parameter.unit}`}
					{#if threshold != null}<span class="text-xs text-muted"> / seuil {fmt(threshold, parameter.decimals)}</span>{/if}
				</dd>
			</div>
		</dl>
	</section>

	<section class="rise mb-6" style="animation-delay: 40ms">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="tape">Courbe</h2>
			<div class="flex rounded-lg border-2 border-edge bg-surface p-0.5" role="group" aria-label="Période">
				{#each periods as p (p.days)}
					<button
						onclick={() => (days = p.days)}
						aria-pressed={days === p.days}
						class="rounded-md px-2.5 py-1 text-xs font-bold {days === p.days ? 'bg-ink text-on-ink' : 'text-muted'}"
					>
						{p.label}
					</button>
				{/each}
			</div>
		</div>
		<div class="card-flat p-3">
			{#if points.length}
				<Chart {points} min={parameter.min} max={parameter.max} decimals={parameter.decimals} />
			{:else}
				<p class="hand py-6 text-center text-lg text-muted">Pas de mesure sur cette période.</p>
			{/if}
		</div>
	</section>

	<div class="rise mb-8 grid grid-cols-2 gap-3" style="animation-delay: 80ms">
		<a href="/mesurer?bac={id}" class="btn"><Icon name="drop" size={18} />Mesurer</a>
		<a href="/aquariums/{id}/reglages#param-{pid}" class="btn-ghost"><Icon name="edit" size={18} />Plage</a>
	</div>

	<section class="rise" style="animation-delay: 120ms">
		<h2 class="tape mb-3">Historique</h2>
		{#if history.length === 0}
			<p class="hand text-lg text-muted">Rien encore. La première mesure apparaîtra ici.</p>
		{:else}
			<ul class="card-flat divide-y-2 divide-line">
				{#each shown as m, i (m.measuredAt + i)}
					{@const prev = history[i + 1]}
					<li class="flex items-center gap-3 px-4 py-2.5">
						<div class="min-w-0 flex-1">
							<p class="text-sm font-bold first-letter:uppercase">{shortDate(m.measuredAt)}</p>
							<p class="num text-xs text-muted">{time(m.measuredAt)}{m.clientId && store.pending.some((o) => o.clientId === m.clientId) ? ' · en attente' : ''}</p>
						</div>
						{#if prev}
							<span class="num text-xs text-muted">{signed(m.value - prev.value, parameter.decimals)}</span>
						{/if}
						<span class="num w-20 text-right text-lg {outside(m.value) ? 'text-bad' : ''}">{fmt(m.value, parameter.decimals)}</span>
					</li>
				{/each}
			</ul>
			{#if history.length > shown.length}
				<button onclick={() => (showAll = true)} class="mt-3 w-full text-sm font-bold text-muted underline decoration-2 underline-offset-4">
					Voir les {history.length - shown.length} mesures plus anciennes
				</button>
			{/if}
		{/if}
	</section>
{/if}

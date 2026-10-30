<script lang="ts">
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { analyzeParameter, driftThreshold, slopePerDay } from '$lib/domain/drift';
	import { DAY_MS, dayInParis } from '$lib/domain/dates';
	import { fmt, relativeDay } from '$lib/ui';
	import Chart from '$lib/components/Chart.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Segmented from '$lib/ios/Segmented.svelte';

	const id = $derived(Number(page.params.id));
	const pid = $derived(Number(page.params.pid));
	const view = $derived(store.view);
	const aquarium = $derived(view?.aquariums.find((a) => a.id === id));
	const parameter = $derived(view?.parameters.find((p) => p.id === pid && p.aquariumId === id));
	const list = $derived((view?.measurements ?? []).filter((m) => m.parameterId === pid));
	const last = $derived(list.length ? list[list.length - 1] : null);
	const alert = $derived(parameter ? analyzeParameter(parameter, list) : null);
	const today = dayInParis();

	let days = $state(30);
	const periods = [
		{ value: 7, label: 'S' },
		{ value: 30, label: 'M' },
		{ value: 90, label: '3 M' }
	];
	const inPeriod = $derived(list.filter((m) => new Date(m.measuredAt).getTime() >= Date.now() - days * DAY_MS));
	const points = $derived(inPeriod.map((m) => ({ t: new Date(m.measuredAt).getTime(), v: m.value })));
	const average = $derived(inPeriod.length ? inPeriod.reduce((s, m) => s + m.value, 0) / inPeriod.length : null);
	const span = $derived.by(() => {
		if (!inPeriod.length) return '';
		const f = (iso: string, year = false) =>
			new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: year ? 'numeric' : undefined, timeZone: 'Europe/Paris' });
		return `${f(inPeriod[0].measuredAt)} – ${f(inPeriod[inPeriod.length - 1].measuredAt, true)}`;
	});

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
	const shown = $derived(showAll ? history : history.slice(0, 15));

	const outside = (v: number) =>
		parameter != null && ((parameter.min != null && v < parameter.min) || (parameter.max != null && v > parameter.max));
	const signed = (v: number, d: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v), d)}`;
	const unit = $derived(parameter?.unit ? ` ${parameter.unit}` : '');

	function dateLabel(iso: string): string {
		const day = relativeDay(dayInParis(iso), today);
		const time = new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
		if (day === "aujourd'hui") return `Aujourd’hui, ${time}`;
		if (day === 'hier') return `Hier, ${time}`;
		return `${new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })}, ${time}`;
	}
</script>

<svelte:head><title>{parameter?.name ?? 'Paramètre'} · Aquarium</title></svelte:head>

{#if !aquarium || !parameter}
	<NavBar title="Paramètre" back={{ href: `/aquariums/${id}`, label: 'Bac' }} large={false} />
	<p class="subhead mt-10 text-center text-label2">Ce paramètre n’existe pas ou plus.</p>
{:else}
	{@const state = alert?.level === 'hors_plage' ? 'bad' : alert?.level === 'derive' ? 'warn' : 'ok'}
	<NavBar title={parameter.name} back={{ href: `/aquariums/${id}`, label: aquarium.name }} large={false}>
		{#snippet trailing()}
			<a href="/mesurer?bac={id}" class="btn-plain pr-1" aria-label="Ajouter des données"><Icon name="plus" size={24} weight={2.2} /></a>
		{/snippet}
	</NavBar>

	<div class="mb-4 mt-2">
		<Segmented options={periods} bind:value={days} label="Période" />
	</div>

	<div class="mb-2 px-1">
		<p class="footnote font-semibold uppercase text-label2">Moyenne</p>
		<p class="rounded-num">
			<span class="text-[40px] font-semibold leading-[46px]">{average != null ? fmt(average, parameter.decimals) : '–'}</span>
			{#if parameter.unit}<span class="title3 font-semibold text-label2"> {parameter.unit}</span>{/if}
		</p>
		<p class="subhead text-label2">{span || 'Aucune donnée sur cette période'}</p>
	</div>

	<div class="mb-8 rounded-[22px] bg-bg2 px-2 pb-2 pt-3">
		<Chart {points} min={parameter.min} max={parameter.max} decimals={parameter.decimals} height={220} />
	</div>

	<Section header="Dernière mesure">
		<Row title={last ? dateLabel(last.measuredAt) : 'Aucune mesure'}>
			{#snippet trailing()}
				{#if last}
					<span class="rounded-num headline {state === 'bad' ? 'text-red' : state === 'warn' ? 'text-orange' : ''}">{fmt(last.value, parameter.decimals)}{unit}</span>
				{/if}
			{/snippet}
		</Row>
		{#if alert}
			<Row>
				<p class="subhead {state === 'bad' ? 'text-red' : 'text-orange'}">{alert.message}</p>
			</Row>
		{/if}
	</Section>

	<Section header="Plage acceptable" footer="En dehors de cette plage, la valeur est signalée sur l’écran Aujourd’hui.">
		<Row title="Minimum" value={parameter.min != null ? `${fmt(parameter.min, parameter.decimals)}${unit}` : 'Aucun'} />
		<Row title="Maximum" value={parameter.max != null ? `${fmt(parameter.max, parameter.decimals)}${unit}` : 'Aucun'} />
		<Row href="/aquariums/{id}/reglages#param-{pid}" title="Modifier la plage" action chevron={false} />
	</Section>

	<Section header="Tendance sur 7 jours" footer="Au-delà du seuil, une variation trop rapide est signalée même dans la plage, sauf si elle va dans le bon sens.">
		<Row title="Variation" value={change7d != null ? `${signed(change7d, parameter.decimals)}${unit}` : 'Pas assez de mesures'} />
		<Row title="Seuil d’alerte" value={threshold != null ? `${fmt(threshold, parameter.decimals)}${unit}` : 'Aucun'} />
	</Section>

	<Section>
		<Row href="/mesurer?bac={id}" icon="plus" iconColor="var(--blue)" title="Ajouter des données" />
	</Section>

	<Section header="Toutes les données">
		{#if shown.length === 0}
			<Row><p class="body text-label2">Aucune mesure.</p></Row>
		{/if}
		{#each shown as m (m.measuredAt + m.value)}
			<Row title={dateLabel(m.measuredAt)}>
				{#snippet trailing()}
					<span class="rounded-num body {outside(m.value) ? 'font-semibold text-red' : 'text-label2'}">{fmt(m.value, parameter.decimals)}{unit}</span>
				{/snippet}
			</Row>
		{/each}
		{#if history.length > shown.length}
			<Row title="Afficher tout ({history.length})" action chevron={false} onclick={() => (showAll = true)} />
		{/if}
	</Section>
{/if}

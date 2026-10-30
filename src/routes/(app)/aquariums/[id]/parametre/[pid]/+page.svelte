<script lang="ts">
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { analyzeParameter, driftThreshold, slopePerDay } from '$lib/domain/drift';
	import { DAY_MS, dayInParis } from '$lib/domain/dates';
	import { fmt, isPendingMeasurement, relativeDay } from '$lib/ui';
	import { ui } from '$lib/client/ui.svelte';
	import Chart from '$lib/components/Chart.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Segmented from '$lib/ios/Segmented.svelte';
	import Sheet from '$lib/ios/Sheet.svelte';
	import SwipeRow from '$lib/ios/SwipeRow.svelte';
	import StepButtons from '$lib/ios/StepButtons.svelte';
	import type { Measurement } from '$lib/types';

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

	// Comparaison avec un autre paramètre du bac, sur la même période.
	let compareId = $state<number | null>(null);
	let choosing = $state(false);
	const others = $derived((view?.parameters ?? []).filter((p) => p.aquariumId === id && p.id !== pid));
	const compareParam = $derived(others.find((p) => p.id === compareId) ?? null);
	const COMPARE_COLOR = 'var(--purple)';
	const compare = $derived.by(() => {
		if (!compareParam) return null;
		const since = Date.now() - days * DAY_MS;
		return {
			points: (view?.measurements ?? [])
				.filter((m) => m.parameterId === compareParam.id && new Date(m.measuredAt).getTime() >= since)
				.map((m) => ({ t: new Date(m.measuredAt).getTime(), v: m.value })),
			color: COMPARE_COLOR,
			label: compareParam.name,
			decimals: compareParam.decimals
		};
	});

	// Repères des changements d'eau : réalisations des tâches « eau » du bac.
	const markers = $derived.by(() => {
		const waterTasks = new Set((view?.tasks ?? []).filter((t) => t.aquariumId === id && t.kind === 'eau').map((t) => t.id));
		return (view?.completions ?? [])
			.filter((c) => waterTasks.has(c.taskId))
			.map((c) => {
				const t = new Date(c.doneAt).getTime();
				return { t, label: `Changement d’eau le ${new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` };
			});
	});

	// Modification d'une mesure déjà envoyée.
	let editing = $state<Measurement | null>(null);
	let editValue = $state('');
	let editAt = $state('');
	let saving = $state(false);
	const pad = (n: number) => String(n).padStart(2, '0');
	/** ISO → valeur d'un champ datetime-local (heure de l'iPhone). */
	function toLocal(iso: string): string {
		const d = new Date(iso);
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}
	const nowLocal = () => toLocal(new Date().toISOString());
	const parseValue = (s: string) => Number(s.replace(',', '.'));

	function openEdit(m: Measurement) {
		if (isPendingMeasurement(m) || m.id == null || !parameter) return;
		editing = m;
		editValue = fmt(m.value, parameter.decimals).replace(/\s/g, '');
		editAt = toLocal(m.measuredAt);
	}
	function nudge(direction: 1 | -1) {
		if (!parameter) return;
		const base = Number.isFinite(parseValue(editValue)) ? parseValue(editValue) : 0;
		const next = Math.max(0, Math.round((base + direction * parameter.step) * 1e6) / 1e6);
		editValue = fmt(next, parameter.decimals).replace(/\s/g, '');
	}
	const editValid = $derived(editValue.trim() !== '' && Number.isFinite(parseValue(editValue)) && editAt !== '');

	async function saveEdit() {
		if (!editing?.id || !editValid) return;
		saving = true;
		try {
			await store.updateMeasurement(editing.id, { value: parseValue(editValue), measuredAt: new Date(editAt).toISOString() });
			editing = null;
			ui.show('Mesure modifiée', undefined, 'check');
		} catch (e) {
			ui.show((e as Error).message);
		} finally {
			saving = false;
		}
	}

	async function remove(m: Measurement) {
		if (m.id == null || !parameter) return;
		const ok = await ui.confirm({
			title: 'Supprimer cette mesure ?',
			message: `${fmt(m.value, parameter.decimals)}${unit} · ${dateLabel(m.measuredAt)}. Elle disparaîtra des graphes et des alertes.`,
			confirmLabel: 'Supprimer',
			destructive: true
		});
		if (!ok) return;
		try {
			await store.deleteMeasurement(m.id);
			if (editing?.id === m.id) editing = null;
			ui.show('Mesure supprimée');
		} catch (e) {
			ui.show((e as Error).message);
		}
	}

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

	{#if compareParam}
		<div class="footnote mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-semibold">
			<span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-tint"></span>{parameter.name} <span class="font-normal text-label2">(à droite)</span></span>
			<span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full" style="background: {COMPARE_COLOR}"></span>{compareParam.name} <span class="font-normal text-label2">(à gauche)</span></span>
		</div>
	{/if}

	<div class="mb-3 rounded-[22px] bg-bg2 px-2 pb-2 pt-3">
		<Chart {points} min={parameter.min} max={parameter.max} decimals={parameter.decimals} height={220} {compare} {markers} />
	</div>
	{#if markers.length}
		<p class="footnote mb-5 flex items-center gap-1.5 px-1 text-label2">
			<svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true"><path d="M5 0.5S1 4.9 1 7.7a4 4 0 0 0 8 0C9 4.9 5 .5 5 .5z" fill="var(--cyan)" /></svg>
			Les pointillés bleus marquent les changements d’eau.
		</p>
	{:else}
		<div class="mb-5"></div>
	{/if}

	<Section>
		<Row
			icon="chart"
			iconColor="var(--purple)"
			title={compareParam ? `Comparé à ${compareParam.name}` : 'Comparer avec…'}
			onclick={() => (choosing = true)}
			chevron
		/>
		{#if compareParam}
			<Row title="Arrêter la comparaison" action chevron={false} onclick={() => (compareId = null)} />
		{/if}
	</Section>

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
		{#each shown as m (m.id ?? m.clientId ?? m.measuredAt + m.value)}
			{#if isPendingMeasurement(m) || m.id == null}
				<Row title={dateLabel(m.measuredAt)} subtitle="En attente d’envoi">
					{#snippet trailing()}
						<span class="rounded-num body text-label3">{fmt(m.value, parameter.decimals)}{unit}</span>
					{/snippet}
				</Row>
			{:else}
				<SwipeRow trailing={[{ label: 'Supprimer', icon: 'trash', color: 'var(--red)', onaction: () => remove(m) }]}>
					<Row bare title={dateLabel(m.measuredAt)} onclick={() => openEdit(m)}>
						{#snippet trailing()}
							<span class="rounded-num body {outside(m.value) ? 'font-semibold text-red' : 'text-label2'}">{fmt(m.value, parameter.decimals)}{unit}</span>
						{/snippet}
					</Row>
				</SwipeRow>
			{/if}
		{/each}
		{#if history.length > shown.length}
			<Row title="Afficher tout ({history.length})" action chevron={false} onclick={() => (showAll = true)} />
		{/if}
	</Section>
	<p class="footnote -mt-6 mb-8 px-4 text-label2">Touche une mesure pour la corriger, ou fais-la glisser vers la gauche pour la supprimer.</p>

	<Sheet open={choosing} title="Comparer avec" detent="medium" cancelLabel="Fermer" onclose={() => (choosing = false)}>
		<Section footer="La seconde courbe a sa propre échelle, à gauche du graphe.">
			{#each others as o (o.id)}
				<Row
					title={o.name}
					subtitle={o.unit || undefined}
					onclick={() => {
						compareId = o.id;
						choosing = false;
					}}
				>
					{#snippet trailing()}
						{#if o.id === compareId}<span class="text-tint"><Icon name="check" size={20} weight={2.6} /></span>{/if}
					{/snippet}
				</Row>
			{/each}
		</Section>
	</Sheet>

	<Sheet
		open={editing != null}
		title="Modifier la mesure"
		detent="medium"
		onclose={() => (editing = null)}
		action={{ label: 'OK', onclick: saveEdit, disabled: !editValid || saving }}
	>
		{#if editing}
			{@const v = parseValue(editValue)}
			<Section footer={Number.isFinite(v) && outside(v) ? 'Cette valeur est hors de la plage acceptable.' : undefined}>
				<li class="pl-4">
					<div class="row-body flex min-h-11 items-center gap-3 py-1.5 pr-4">
						<label for="edit-value" class="body flex-1">{parameter.name}</label>
						<input
							id="edit-value"
							bind:value={editValue}
							inputmode="decimal"
							class="rounded-num body w-20 bg-transparent text-right outline-none {Number.isFinite(v) && outside(v) ? 'text-red' : ''}"
						/>
						{#if parameter.unit}<span class="body text-label2">{parameter.unit}</span>{/if}
						<StepButtons onminus={() => nudge(-1)} onplus={() => nudge(1)} label={parameter.name} />
					</div>
				</li>
				<li class="pl-4">
					<div class="row-body flex min-h-11 items-center gap-3 py-1.5 pr-4">
						<label for="edit-at" class="body flex-1">Date</label>
						<input id="edit-at" type="datetime-local" bind:value={editAt} max={nowLocal()} class="body rounded-lg bg-fill3 px-2.5 py-1 text-right outline-none" />
					</div>
				</li>
			</Section>
			<Section>
				<Row title="Supprimer la mesure" destructive onclick={() => editing && remove(editing)} />
			</Section>
		{/if}
	</Sheet>
{/if}

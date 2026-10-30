<script lang="ts">
	import { onMount } from 'svelte';
	import { store } from '$lib/client/store.svelte';
	import { listResource } from '$lib/client/api';
	import { dayInParis } from '$lib/domain/dates';
	import type { IconName } from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Sheet from '$lib/ios/Sheet.svelte';
	import Segmented from '$lib/ios/Segmented.svelte';
	import InputRow from '$lib/ios/InputRow.svelte';
	import {
		afterWaterChange,
		dosageEffect,
		dosageMl,
		percentToReach,
		pptToSg,
		realVolume,
		remineralisation,
		saltForBatch,
		salinityAdjust,
		sgToPpt,
		tapRoMix,
		waterChangeLitres
	} from '$lib/domain/calculators';

	type Result<T> = { ok: true; value: T } | { ok: false; error: string };

	/** Exécute un calcul : renvoie le résultat ou le message d'erreur à afficher. */
	function run<T>(fn: () => T): Result<T> {
		try {
			return { ok: true, value: fn() };
		} catch (e) {
			return { ok: false, error: (e as Error).message };
		}
	}

	const aquariums = $derived(store.view?.aquariums ?? []);
	// 0 : volume saisi à la main.
	let selected = $state<number>(0);
	const tankOptions = $derived([
		...aquariums.map((a) => ({ value: a.id, label: a.name })),
		{ value: 0, label: 'Autre' }
	]);

	// Les champs sont des chaînes pour accepter la virgule et le vide.
	const n = (v: string) => Number(v.replace(',', '.'));
	const fmt = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });

	let volume = $state('100');
	let touched = false;
	$effect(() => {
		// Au premier affichage, le premier bac est présélectionné.
		if (!touched && selected === 0 && aquariums.length) selected = aquariums[0].id;
	});
	$effect(() => {
		const tank = aquariums.find((a) => a.id === selected);
		if (tank?.volumeL) volume = String(tank.volumeL);
	});

	// Dépenses du mois, pour la ligne « Dépenses » (en ligne seulement).
	let monthTotal = $state<number | null>(null);
	onMount(async () => {
		try {
			const month = dayInParis().slice(0, 7);
			const list = await listResource<{ amount: number; spentOn: string }>('expenses');
			monthTotal = list.filter((e) => e.spentOn.slice(0, 7) === month).reduce((s, e) => s + e.amount, 0);
		} catch {
			monthTotal = null;
		}
	});
	const eur = (v: number) => v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

	// Volume réel
	let L = $state('100'), W = $state('40'), H = $state('50'), glass = $state('8'), free = $state('3'), decor = $state('10');
	const realV = $derived(run(() => realVolume({ lengthCm: n(L), widthCm: n(W), heightCm: n(H), glassMm: n(glass), freeboardCm: n(free), displacedL: n(decor) })));

	// Changement d'eau
	let pct = $state('25'), cur = $state('40'), fresh = $state('0'), target = $state('20');
	const change = $derived(run(() => waterChangeLitres(n(volume), n(pct))));
	const after = $derived(run(() => afterWaterChange(n(cur), n(fresh), n(pct))));
	const need = $derived(run(() => percentToReach(n(cur), n(target), n(fresh), n(volume))));

	// Dosage
	let power = $state('100'), inc = $state('1'), ml = $state('2');
	const dose = $derived(run(() => dosageMl(n(volume), n(inc), n(power))));
	const doseEffect = $derived(run(() => dosageEffect(n(volume), n(ml), n(power))));

	// Reminéralisation
	let tapGh = $state('15'), roGh = $state('0'), targetGh = $state('6'), fromGh = $state('2'), gPerDeg = $state('0.02');
	const mix = $derived(run(() => tapRoMix(n(volume), n(targetGh), n(tapGh), n(roGh))));
	const remin = $derived(run(() => remineralisation(n(volume), n(fromGh), n(targetGh), n(gPerDeg))));

	// Salinité
	let sg = $state('1.026'), ppt = $state('35'), curPpt = $state('38'), freshPpt = $state('0');
	const toPpt = $derived(run(() => sgToPpt(n(sg))));
	const toSg = $derived(run(() => pptToSg(n(ppt))));
	const salt = $derived(run(() => saltForBatch(n(volume), n(ppt))));
	const adjust = $derived(run(() => salinityAdjust(n(volume), n(curPpt), n(ppt), n(freshPpt))));

	type ToolId = 'eau' | 'dosage' | 'remin' | 'sel' | 'volume';
	const tools: { id: ToolId; title: string; hint: string; icon: IconName; color: string }[] = [
		{ id: 'eau', title: "Changement d'eau", hint: 'Litres à remplacer, effet sur une valeur', icon: 'drop', color: 'var(--blue)' },
		{ id: 'dosage', title: "Dosage d'un produit", hint: 'Dose pour une hausse donnée', icon: 'flask', color: 'var(--purple)' },
		{ id: 'remin', title: 'Reminéralisation', hint: 'Robinet et osmose, sels à ajouter', icon: 'leaf', color: 'var(--green)' },
		{ id: 'sel', title: 'Salinité', hint: 'Densité, ppt, sel pour un bidon', icon: 'bacs', color: 'var(--indigo)' },
		{ id: 'volume', title: 'Volume réel', hint: 'Dimensions, verre, sol et décor', icon: 'box', color: 'var(--orange)' }
	];
	let open = $state<ToolId | null>(null);
	const tool = $derived(tools.find((t) => t.id === open));
</script>

<svelte:head><title>Atelier · Aquarium</title></svelte:head>

{#snippet hero(r: Result<unknown>, value: (v: any) => string, unit: string, label: string, color: string)}
	<div class="mb-6 mt-2 px-1 text-center">
		{#if r.ok}
			<p class="rounded-num leading-none" style="color: {color}">
				<span class="text-[64px] font-bold tracking-tight">{value(r.value)}</span>
				<span class="title3 font-semibold">{unit}</span>
			</p>
			<p class="subhead mt-1.5 text-label2">{label}</p>
		{:else}
			<p class="title3 text-label3">–</p>
			<p class="subhead mt-1.5 text-orange">{r.error}</p>
		{/if}
	</div>
{/snippet}

{#snippet info(r: Result<unknown>, title: string, text: (v: any) => string)}
	<li class="flex items-center gap-3 pl-4">
		<div class="row-body flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 py-2.5 pr-4">
			<span class="body">{title}</span>
			{#if r.ok}
				<span class="body rounded-num text-right text-label2">{text(r.value)}</span>
			{:else}
				<span class="subhead text-right text-orange">{r.error}</span>
			{/if}
		</div>
	</li>
{/snippet}

<NavBar title="Atelier" />

<Section class="mt-2">
	<Row href="/especes" icon="book" iconColor="var(--teal)" title="Encyclopédie des espèces" />
	<Row href="/depenses" icon="euro" iconColor="var(--green)" title="Dépenses" value={monthTotal != null ? eur(monthTotal) : undefined} />
</Section>

<Section header="Calculateurs" footer="Les calculs utilisent le volume du bac choisi. Vérifie toujours avec tes tests avant de doser.">
	{#each tools as t (t.id)}
		<Row onclick={() => (open = t.id)} icon={t.icon} iconColor={t.color} title={t.title} subtitle={t.hint} chevron />
	{/each}
</Section>

<Sheet open={open != null} title={tool?.title} cancelLabel="OK" onclose={() => (open = null)}>
	{#if tool}
		{#if open === 'eau'}
			{@render hero(change, (v) => fmt(v.litres), 'L', 'à retirer et remplacer', tool.color)}
		{:else if open === 'dosage'}
			{@render hero(dose, (v) => fmt(v.ml, 2), 'mL', 'à verser', tool.color)}
		{:else if open === 'remin'}
			{@render hero(remin, (v) => fmt(v.grams), 'g', 'de sels pour de l’osmose pure', tool.color)}
		{:else if open === 'sel'}
			{@render hero(salt, (v) => fmt(v.kg, 2), 'kg', `de sel pour ${fmt(n(volume), 0)} L à ${ppt} ppt`, tool.color)}
		{:else if open === 'volume'}
			{@render hero(realV, (v) => fmt(v.netL), 'L', 'd’eau réelle', tool.color)}
		{/if}

		{#if open !== 'volume'}
			<section class="mb-8">
				<h2 class="footnote px-4 pb-1.5 uppercase text-label2">Bac</h2>
				{#if aquariums.length}
					<div class="mb-2.5">
						<Segmented options={tankOptions} bind:value={selected} label="Bac" onchange={() => (touched = true)} />
					</div>
				{/if}
				<ul class="group ios-form">
					<InputRow label="Volume" bind:value={volume} inputmode="decimal" unit="L" oninput={() => ((selected = 0), (touched = true))} />
				</ul>
			</section>
		{/if}

		{#if open === 'eau'}
			<Section header="Changement" footer="« Valeur » : nitrates, phosphates, ce que tu veux faire baisser.">
				<InputRow label="Part changée" bind:value={pct} inputmode="decimal" unit="%" />
				<InputRow label="Valeur actuelle" bind:value={cur} inputmode="decimal" />
				<InputRow label="Valeur eau neuve" bind:value={fresh} inputmode="decimal" />
				<InputRow label="Valeur visée" bind:value={target} inputmode="decimal" />
			</Section>
			<Section header="Résultat">
				{@render info(after, 'Après ce changement', (v) => fmt(v, 2))}
				{@render info(need, 'Pour la cible', (v) => `${fmt(v.percent)} % · ${fmt(v.litres)} L`)}
			</Section>
		{:else if open === 'dosage'}
			<Section header="Produit" footer="Puissance : hausse × litres pour 1 mL. « 1 mL monte le KH de 1 dans 100 L » donne 100.">
				<InputRow label="Puissance" bind:value={power} inputmode="decimal" />
				<InputRow label="Hausse visée" bind:value={inc} inputmode="decimal" />
			</Section>
			<Section header="Effet d’une dose">
				<InputRow label="Dose" bind:value={ml} inputmode="decimal" unit="mL" />
				{@render info(doseEffect, 'Hausse obtenue', (v) => fmt(v.increase, 3))}
			</Section>
		{:else if open === 'remin'}
			<Section header="Dureté (°dGH)">
				<InputRow label="GH du robinet" bind:value={tapGh} inputmode="decimal" />
				<InputRow label="GH de l’osmose" bind:value={roGh} inputmode="decimal" />
				<InputRow label="GH visé" bind:value={targetGh} inputmode="decimal" />
			</Section>
			<Section header="Mélange robinet et osmose">
				{@render info(mix, 'Robinet', (v) => `${fmt(v.tapL)} L · ${v.tapPercent} %`)}
				{@render info(mix, 'Osmose', (v) => `${fmt(v.roL)} L`)}
			</Section>
			<Section header="Sels reminéralisants" footer="Dose de ton produit : grammes par litre pour monter de 1 °dGH (voir la notice).">
				<InputRow label="GH de départ" bind:value={fromGh} inputmode="decimal" />
				<InputRow label="Dose du produit" bind:value={gPerDeg} inputmode="decimal" unit="g/L" />
			</Section>
		{:else if open === 'sel'}
			<Section header="Conversion" footer="Indicatif à 25 °C (± 0,5 ppt). Vérifie au réfractomètre.">
				<InputRow label="Densité" bind:value={sg} inputmode="decimal" unit="SG" />
				{@render info(toPpt, 'Salinité', (v) => `${fmt(v)} ppt`)}
				<InputRow label="Salinité visée" bind:value={ppt} inputmode="decimal" unit="ppt" />
				{@render info(toSg, 'Densité visée', (v) => `${v.toFixed(4)} SG`)}
			</Section>
			<Section header="Corriger la salinité" footer="Pour la quantité de sel, suis aussi la notice de ta marque.">
				<InputRow label="Salinité actuelle" bind:value={curPpt} inputmode="decimal" unit="ppt" />
				<InputRow label="Eau ajoutée" bind:value={freshPpt} inputmode="decimal" unit="ppt" />
				{@render info(adjust, `Pour ${adjust.ok ? adjust.value.direction : 'corriger'}`, (v) => `${fmt(v.replaceL)} L à remplacer`)}
			</Section>
		{:else if open === 'volume'}
			<Section header="Dimensions intérieures">
				<InputRow label="Longueur" bind:value={L} inputmode="decimal" unit="cm" />
				<InputRow label="Largeur" bind:value={W} inputmode="decimal" unit="cm" />
				<InputRow label="Hauteur" bind:value={H} inputmode="decimal" unit="cm" />
			</Section>
			<Section header="Retranché">
				<InputRow label="Épaisseur du verre" bind:value={glass} inputmode="decimal" unit="mm" />
				<InputRow label="Sous le bord" bind:value={free} inputmode="decimal" unit="cm" />
				<InputRow label="Sol et décor" bind:value={decor} inputmode="decimal" unit="L" />
			</Section>
			<Section header="Détail">
				{@render info(realV, 'Volume brut', (v) => `${fmt(v.grossL)} L`)}
				{@render info(realV, 'Eau sans décor', (v) => `${fmt(v.waterL)} L`)}
			</Section>
			{#if realV.ok}
				<button
					class="btn-tinted w-full"
					onclick={() => {
						if (realV.ok) {
							volume = String(realV.value.netL);
							selected = 0;
							touched = true;
							open = 'eau';
						}
					}}
				>
					Utiliser {fmt(realV.value.netL)} L pour les calculs
				</button>
			{/if}
		{/if}
	{/if}
</Sheet>

<style>
	.ios-form > :global(li + li .row-body) {
		box-shadow: inset 0 0.5px 0 var(--sep);
	}
</style>

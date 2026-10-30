<script lang="ts">
	import { store } from '$lib/client/store.svelte';
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

	/** Exécute un calcul : renvoie le résultat ou le message d'erreur à afficher. */
	function run<T>(fn: () => T): { ok: true; value: T } | { ok: false; error: string } {
		try {
			return { ok: true, value: fn() };
		} catch (e) {
			return { ok: false, error: (e as Error).message };
		}
	}

	const aquariums = $derived(store.view?.aquariums ?? []);
	let selected = $state<number | null>(null);
	const prefill = $derived(aquariums.find((a) => a.id === selected)?.volumeL ?? null);

	// Les champs sont des chaînes pour accepter la virgule et le vide.
	const n = (v: string) => Number(v.replace(',', '.'));
	const fmt = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });

	let volume = $state('100');
	$effect(() => {
		if (prefill) volume = String(prefill);
	});

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

	const input = 'w-full rounded-lg border border-cyan-900 bg-slate-950 px-3 py-2 text-base';
	const card = 'rounded-lg bg-slate-900 p-4';
</script>

{#snippet field(label: string, id: string, getter: () => string, setter: (v: string) => void)}
	<label class="flex flex-col gap-1 text-xs text-slate-400">
		{label}
		<input {id} value={getter()} oninput={(e) => setter(e.currentTarget.value)} inputmode="decimal" class={input} />
	</label>
{/snippet}

{#snippet result(r: { ok: true; value: unknown } | { ok: false; error: string }, text: (v: any) => string)}
	{#if r.ok}
		<p class="mt-2 rounded-lg bg-cyan-950 p-3 text-sm text-cyan-100">{text(r.value)}</p>
	{:else}
		<p class="mt-2 text-sm text-amber-300">{r.error}</p>
	{/if}
{/snippet}

<svelte:head><title>Outils · Aquarium</title></svelte:head>

<h1 class="mb-4 text-2xl font-semibold">Outils</h1>

<div class="mb-6 grid grid-cols-2 gap-3">
	<label class="flex flex-col gap-1 text-xs text-slate-400">
		Aquarium
		<select bind:value={selected} class={input}>
			<option value={null}>—</option>
			{#each aquariums as a (a.id)}<option value={a.id}>{a.name}</option>{/each}
		</select>
	</label>
	{@render field('Volume (L)', 'volume', () => volume, (v) => (volume = v))}
</div>

<div class="flex flex-col gap-4">
	<details class={card}>
		<summary class="font-medium">Volume réel</summary>
		<div class="mt-3 grid grid-cols-3 gap-2">
			{@render field('Longueur (cm)', 'L', () => L, (v) => (L = v))}
			{@render field('Largeur (cm)', 'W', () => W, (v) => (W = v))}
			{@render field('Hauteur (cm)', 'H', () => H, (v) => (H = v))}
			{@render field('Verre (mm)', 'glass', () => glass, (v) => (glass = v))}
			{@render field('Niveau sous le bord (cm)', 'free', () => free, (v) => (free = v))}
			{@render field('Décor, sol (L)', 'decor', () => decor, (v) => (decor = v))}
		</div>
		{@render result(realV, (v) => `Volume brut ${fmt(v.grossL)} L · eau ${fmt(v.waterL)} L · volume net ${fmt(v.netL)} L`)}
		{#if realV.ok}
			<button class="mt-2 text-sm text-cyan-300 underline" onclick={() => realV.ok && (volume = String(realV.value.netL))}>
				Utiliser {fmt(realV.value.netL)} L comme volume
			</button>
		{/if}
	</details>

	<details class={card}>
		<summary class="font-medium">Changement d'eau</summary>
		<div class="mt-3 grid grid-cols-2 gap-2">
			{@render field('Changement (%)', 'pct', () => pct, (v) => (pct = v))}
			{@render field('Valeur actuelle (ex. nitrates)', 'cur', () => cur, (v) => (cur = v))}
			{@render field('Valeur eau neuve', 'fresh', () => fresh, (v) => (fresh = v))}
			{@render field('Valeur visée', 'target', () => target, (v) => (target = v))}
		</div>
		{@render result(change, (v) => `Retirer et remplacer ${fmt(v.litres)} L`)}
		{@render result(after, (v) => `Après ce changement : ${fmt(v, 2)}`)}
		{@render result(need, (v) => `Pour atteindre la cible : ${fmt(v.percent)} % soit ${fmt(v.litres)} L`)}
	</details>

	<details class={card}>
		<summary class="font-medium">Dosage d'un produit</summary>
		<p class="mt-2 text-xs text-slate-500">
			Puissance = hausse × litres pour 1 mL. Ex. « 1 mL monte le KH de 1 °dKH dans 100 L » → 100.
		</p>
		<div class="mt-3 grid grid-cols-3 gap-2">
			{@render field('Puissance', 'power', () => power, (v) => (power = v))}
			{@render field('Hausse visée', 'inc', () => inc, (v) => (inc = v))}
			{@render field('Dose (mL)', 'ml', () => ml, (v) => (ml = v))}
		</div>
		{@render result(dose, (v) => `Dose à verser : ${fmt(v.ml, 2)} mL`)}
		{@render result(doseEffect, (v) => `${fmt(n(ml), 2)} mL font monter de ${fmt(v.increase, 3)}`)}
	</details>

	<details class={card}>
		<summary class="font-medium">Reminéralisation</summary>
		<div class="mt-3 grid grid-cols-3 gap-2">
			{@render field('GH robinet', 'tapGh', () => tapGh, (v) => (tapGh = v))}
			{@render field('GH osmose', 'roGh', () => roGh, (v) => (roGh = v))}
			{@render field('GH visé', 'targetGh', () => targetGh, (v) => (targetGh = v))}
			{@render field('GH de départ', 'fromGh', () => fromGh, (v) => (fromGh = v))}
			{@render field('g/L par °dGH (produit)', 'gPerDeg', () => gPerDeg, (v) => (gPerDeg = v))}
		</div>
		{@render result(mix, (v) => `Mélange : ${fmt(v.tapL)} L de robinet (${v.tapPercent} %) + ${fmt(v.roL)} L d'osmose`)}
		{@render result(remin, (v) => `Sels à ajouter à de l'osmose : ${fmt(v.grams)} g`)}
	</details>

	<details class={card}>
		<summary class="font-medium">Salinité (eau de mer)</summary>
		<p class="mt-2 text-xs text-slate-500">Conversion indicative à 25 °C (±0,5 ppt) ; vérifie avec ton réfractomètre.</p>
		<div class="mt-3 grid grid-cols-2 gap-2">
			{@render field('Densité (SG)', 'sg', () => sg, (v) => (sg = v))}
			{@render field('Salinité visée (ppt)', 'ppt', () => ppt, (v) => (ppt = v))}
			{@render field('Salinité actuelle (ppt)', 'curPpt', () => curPpt, (v) => (curPpt = v))}
			{@render field('Eau ajoutée (ppt)', 'freshPpt', () => freshPpt, (v) => (freshPpt = v))}
		</div>
		{@render result(toPpt, (v) => `${sg} SG ≈ ${fmt(v)} ppt`)}
		{@render result(toSg, (v) => `${ppt} ppt ≈ ${v.toFixed(4)} SG`)}
		{@render result(salt, (v) => `Sel pour ${fmt(n(volume), 0)} L à ${ppt} ppt : environ ${fmt(v.kg, 2)} kg (suis la notice de ta marque)`)}
		{@render result(adjust, (v) => `Pour ${v.direction} la salinité : retirer puis remplacer ${fmt(v.replaceL)} L`)}
	</details>
</div>

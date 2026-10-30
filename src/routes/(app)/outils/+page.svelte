<script lang="ts">
	import { onMount } from 'svelte';
	import { store } from '$lib/client/store.svelte';
	import { listResource } from '$lib/client/api';
	import { dayInParis } from '$lib/domain/dates';
	import { TANK_TONE } from '$lib/ui';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
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
	let selected = $state<number | null>(null);
	const prefill = $derived(aquariums.find((a) => a.id === selected)?.volumeL ?? null);

	// Les champs sont des chaînes pour accepter la virgule et le vide.
	const n = (v: string) => Number(v.replace(',', '.'));
	const fmt = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });

	let volume = $state('100');
	$effect(() => {
		if (prefill) volume = String(prefill);
	});

	// Dépenses du mois, pour l'entrée « Dépenses » (en ligne seulement).
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

	// Une seule carte de calcul ouverte à la fois.
	let open = $state<string | null>('eau');
	const toggle = (id: string) => (open = open === id ? null : id);

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

	const tools: { id: string; title: string; hint: string; icon: IconName }[] = [
		{ id: 'eau', title: "Changement d'eau", hint: 'Litres à remplacer, valeur après, cible à atteindre', icon: 'drop' },
		{ id: 'dosage', title: "Dosage d'un produit", hint: 'Dose à verser pour une hausse donnée', icon: 'chart' },
		{ id: 'remin', title: 'Reminéralisation', hint: 'Mélange robinet et osmose, sels à ajouter', icon: 'leaf' },
		{ id: 'sel', title: 'Salinité', hint: 'Densité, ppt, sel pour un bidon', icon: 'bacs' },
		{ id: 'volume', title: 'Volume réel', hint: 'Dimensions, verre, sol et décor', icon: 'box' }
	];
</script>

{#snippet field(label: string, id: string, getter: () => string, setter: (v: string) => void)}
	<label class="flex min-w-0 flex-col gap-1 text-xs font-bold text-muted" for={id}>
		{label}
		<input {id} value={getter()} oninput={(e) => setter(e.currentTarget.value)} inputmode="decimal" class="field num" />
	</label>
{/snippet}

{#snippet big(r: Result<unknown>, value: (v: any) => string, unit: string, label: string)}
	{#if r.ok}
		<div class="flex flex-col">
			<span class="num text-[2.1rem] leading-none">{value(r.value)}<span class="ml-1 text-base text-muted">{unit}</span></span>
			<span class="mt-1 text-xs font-bold text-muted">{label}</span>
		</div>
	{:else}
		<p class="hand text-lg text-warn">{r.error}</p>
	{/if}
{/snippet}

{#snippet line(r: Result<unknown>, text: (v: any) => string)}
	{#if r.ok}
		<p class="flex items-start gap-2 text-sm"><Icon name="next" size={16} class="mt-0.5 text-muted" />{text(r.value)}</p>
	{:else}
		<p class="hand text-base text-warn">{r.error}</p>
	{/if}
{/snippet}

<svelte:head><title>Atelier · Bulle</title></svelte:head>

<div class="rise">
	<PageHeader title="Atelier" kicker="Outils, guide et comptes" />
</div>

<div class="rise mb-8 grid grid-cols-2 gap-3" style="animation-delay: 40ms">
	<a href="/especes" class="card press flex flex-col gap-3 overflow-hidden">
		<div class="border-b-2 border-edge px-4 pb-3 pt-4" style="background: var(--t-mer)">
			<Icon name="book" size={30} />
		</div>
		<div class="px-4 pb-4">
			<p class="display text-lg leading-tight">Encyclopédie des espèces</p>
			<p class="mt-1 text-xs text-muted">Poissons, coraux, plantes</p>
		</div>
	</a>
	<a href="/depenses" class="card press flex flex-col gap-3 overflow-hidden">
		<div class="border-b-2 border-edge bg-sun px-4 pb-3 pt-4 text-[#16202e]">
			<Icon name="euro" size={30} />
		</div>
		<div class="px-4 pb-4">
			<p class="display text-lg leading-tight">Dépenses</p>
			<p class="mt-1 text-xs text-muted">
				{#if monthTotal != null}Ce mois : <span class="num font-bold text-ink">{eur(monthTotal)}</span>{:else}Achats et budget{/if}
			</p>
		</div>
	</a>
</div>

<section class="rise" style="animation-delay: 80ms">
	<h2 class="tape mb-3">Calculateurs</h2>

	<div class="card-flat mb-4 flex flex-col gap-3 p-3">
		<p class="text-xs font-bold text-muted">Calculer pour</p>
		<div class="flex flex-wrap gap-2">
			{#each aquariums as a (a.id)}
				{@const on = selected === a.id}
				<button
					class="flex items-center gap-1.5 rounded-full border-2 border-edge px-3 py-1 text-sm font-bold {on ? 'bg-ink text-on-ink' : 'bg-surface'}"
					aria-pressed={on}
					onclick={() => (selected = on ? null : a.id)}
				>
					<span class="h-2.5 w-2.5 rounded-full border border-edge" style="background: {TANK_TONE[a.waterType]}"></span>
					{a.name}
				</button>
			{/each}
		</div>
		<label class="flex items-center gap-3 text-sm font-bold" for="volume">
			Volume
			<input id="volume" value={volume} oninput={(e) => { volume = e.currentTarget.value; selected = null; }} inputmode="decimal" class="field num w-28" />
			<span class="text-muted">L</span>
		</label>
	</div>

	<ul class="flex flex-col gap-3">
		{#each tools as t (t.id)}
			{@const on = open === t.id}
			<li class={on ? 'card' : 'card-flat'}>
				<button class="flex w-full items-center gap-3 p-4 text-left" aria-expanded={on} onclick={() => toggle(t.id)}>
					<span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2 border-edge {on ? 'bg-sun text-[#16202e]' : 'bg-surface2'}">
						<Icon name={t.icon} size={22} />
					</span>
					<span class="min-w-0 flex-1">
						<span class="block font-bold">{t.title}</span>
						<span class="block truncate text-xs text-muted">{t.hint}</span>
					</span>
					<Icon name={on ? 'down' : 'next'} size={18} class="text-muted" />
				</button>

				{#if on}
					<div class="rise flex flex-col gap-4 border-t-2 border-edge p-4">
						{#if t.id === 'eau'}
							<div class="grid grid-cols-2 gap-2">
								{@render field('Changement (%)', 'pct', () => pct, (v) => (pct = v))}
								{@render field('Valeur actuelle', 'cur', () => cur, (v) => (cur = v))}
								{@render field('Valeur eau neuve', 'fresh', () => fresh, (v) => (fresh = v))}
								{@render field('Valeur visée', 'target', () => target, (v) => (target = v))}
							</div>
							<p class="hand -mt-2 text-base text-muted">« Valeur » : nitrates, phosphates, ce que tu veux faire baisser.</p>
							<div class="rounded-xl border-2 border-edge bg-surface2 p-4">
								{@render big(change, (v) => fmt(v.litres), 'L', 'à retirer et remplacer')}
							</div>
							{@render line(after, (v) => `Après ce changement : ${fmt(v, 2)}`)}
							{@render line(need, (v) => `Pour atteindre la cible : ${fmt(v.percent)} %, soit ${fmt(v.litres)} L`)}
						{:else if t.id === 'dosage'}
							<p class="hand -mb-1 text-base text-muted">Puissance = hausse × litres pour 1 mL. « 1 mL monte le KH de 1 dans 100 L » → 100.</p>
							<div class="grid grid-cols-3 gap-2">
								{@render field('Puissance', 'power', () => power, (v) => (power = v))}
								{@render field('Hausse visée', 'inc', () => inc, (v) => (inc = v))}
								{@render field('Dose (mL)', 'ml', () => ml, (v) => (ml = v))}
							</div>
							<div class="rounded-xl border-2 border-edge bg-surface2 p-4">
								{@render big(dose, (v) => fmt(v.ml, 2), 'mL', 'à verser')}
							</div>
							{@render line(doseEffect, (v) => `${fmt(n(ml), 2)} mL font monter de ${fmt(v.increase, 3)}`)}
						{:else if t.id === 'remin'}
							<div class="grid grid-cols-3 gap-2">
								{@render field('GH robinet', 'tapGh', () => tapGh, (v) => (tapGh = v))}
								{@render field('GH osmose', 'roGh', () => roGh, (v) => (roGh = v))}
								{@render field('GH visé', 'targetGh', () => targetGh, (v) => (targetGh = v))}
								{@render field('GH de départ', 'fromGh', () => fromGh, (v) => (fromGh = v))}
								<div class="col-span-2">{@render field('g/L par °dGH (produit)', 'gPerDeg', () => gPerDeg, (v) => (gPerDeg = v))}</div>
							</div>
							<div class="grid grid-cols-2 gap-3 rounded-xl border-2 border-edge bg-surface2 p-4">
								{@render big(mix, (v) => fmt(v.tapL), 'L', `robinet (${mix.ok ? mix.value.tapPercent : 0} %)`)}
								{#if mix.ok}{@render big(mix, (v) => fmt(v.roL), 'L', 'osmose')}{/if}
							</div>
							{@render line(remin, (v) => `Sels à ajouter à de l'osmose pure : ${fmt(v.grams)} g`)}
						{:else if t.id === 'sel'}
							<p class="hand -mb-1 text-base text-muted">Conversion indicative à 25 °C (± 0,5 ppt). Vérifie au réfractomètre.</p>
							<div class="grid grid-cols-2 gap-2">
								{@render field('Densité (SG)', 'sg', () => sg, (v) => (sg = v))}
								{@render field('Salinité visée (ppt)', 'ppt', () => ppt, (v) => (ppt = v))}
								{@render field('Salinité actuelle (ppt)', 'curPpt', () => curPpt, (v) => (curPpt = v))}
								{@render field('Eau ajoutée (ppt)', 'freshPpt', () => freshPpt, (v) => (freshPpt = v))}
							</div>
							<div class="grid grid-cols-2 gap-3 rounded-xl border-2 border-edge bg-surface2 p-4">
								{@render big(toPpt, (v) => fmt(v), 'ppt', `pour ${sg} SG`)}
								{@render big(salt, (v) => fmt(v.kg, 2), 'kg', `de sel pour ${fmt(n(volume), 0)} L`)}
							</div>
							{@render line(toSg, (v) => `${ppt} ppt ≈ ${v.toFixed(4)} SG`)}
							{@render line(adjust, (v) => `Pour ${v.direction} la salinité : retirer puis remplacer ${fmt(v.replaceL)} L`)}
							<p class="text-xs text-muted">Pour la quantité de sel, suis aussi la notice de ta marque.</p>
						{:else if t.id === 'volume'}
							<div class="grid grid-cols-3 gap-2">
								{@render field('Longueur (cm)', 'L', () => L, (v) => (L = v))}
								{@render field('Largeur (cm)', 'W', () => W, (v) => (W = v))}
								{@render field('Hauteur (cm)', 'H', () => H, (v) => (H = v))}
								{@render field('Verre (mm)', 'glass', () => glass, (v) => (glass = v))}
								{@render field('Sous le bord (cm)', 'free', () => free, (v) => (free = v))}
								{@render field('Sol, décor (L)', 'decor', () => decor, (v) => (decor = v))}
							</div>
							<div class="rounded-xl border-2 border-edge bg-surface2 p-4">
								{@render big(realV, (v) => fmt(v.netL), 'L', "d'eau réelle")}
							</div>
							{@render line(realV, (v) => `Volume brut ${fmt(v.grossL)} L, eau sans décor ${fmt(v.waterL)} L`)}
							{#if realV.ok}
								<button class="btn-ghost self-start" onclick={() => realV.ok && ((volume = String(realV.value.netL)), (selected = null))}>
									Utiliser {fmt(realV.value.netL)} L comme volume
								</button>
							{/if}
						{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ul>
</section>

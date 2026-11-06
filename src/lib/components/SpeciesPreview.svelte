<script lang="ts">
	import { KIND_LABELS, type Species } from '$lib/types';
	import { speciesFit, speciesName, type TankContext } from '$lib/domain/species';
	import SpeciesThumb from './SpeciesThumb.svelte';

	/** Fiche d'une espèce avant ajout : photo, adéquation au bac, repères d'élevage, conseils. */
	interface Props {
		species: Species;
		tank?: TankContext;
	}
	let { species: s, tank }: Props = $props();

	const fit = $derived(tank ? speciesFit(s, tank) : null);
	const TONE = { ok: 'var(--green)', attention: 'var(--orange)', bloquant: 'var(--red)' } as const;
	const LEVELS = ['Facile', 'Intermédiaire', 'Exigeant'];
	const LIGHT = ['', 'Faible', 'Moyenne', 'Forte'];
	const CO2 = ['Inutile', 'Conseillé', 'Indispensable'];
	const n = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
	const cap = (v: string | null) => (v ? v[0].toUpperCase() + v.slice(1) : v);
	const span = (a: number | null, b: number | null, unit = '') => (a != null && b != null ? `${n(a)}–${n(b)}${unit}` : null);

	const facts = $derived(
		(
			[
				['Taille adulte', s.maxLengthCm ? `${n(s.maxLengthCm)} cm` : null],
				['Bac minimum', s.minTankL ? `${n(s.minTankL)} L` : null],
				['Température', span(s.tempMin, s.tempMax, ' °C')],
				['pH', span(s.phMin, s.phMax)],
				['Tempérament', cap(s.temperament)],
				['Régime', cap(s.diet)],
				['Zone', s.zone === 'tous' ? 'Toutes' : cap(s.zone)],
				['Groupe', s.groupMin && s.groupMin > 1 ? `${s.groupMin} minimum` : null],
				['Durée de vie', s.lifespanYears ? `${n(s.lifespanYears)} ans` : null],
				['Lumière', s.light ? LIGHT[s.light] : null],
				['CO₂', s.co2 != null ? CO2[s.co2] : null],
				['Récif', s.reefSafe == null ? null : s.reefSafe ? 'Compatible' : 'À éviter']
			] as [string, string | null][]
		).filter((f): f is [string, string] => Boolean(f[1]))
	);
</script>

<div class="flex flex-col gap-4">
	<div class="relative overflow-hidden rounded-[22px]">
		<SpeciesThumb species={s} class="aspect-[16/10] w-full" iconSize={56} alt={speciesName(s)} />
		<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 pb-3 pt-10 text-white">
			<h2 class="title2 leading-tight">{speciesName(s)}</h2>
			<p class="subhead italic opacity-85">{s.scientificName}</p>
		</div>
	</div>

	<div class="flex flex-wrap gap-1.5">
		<span class="caption1 rounded-full bg-fill3 px-2.5 py-1 font-semibold">{KIND_LABELS[s.kind]}</span>
		{#if s.difficulty}<span class="caption1 rounded-full bg-fill3 px-2.5 py-1 font-semibold">{LEVELS[s.difficulty - 1]}</span>{/if}
		{#if s.origin}<span class="caption1 rounded-full bg-fill3 px-2.5 py-1 text-label2">{s.origin}</span>{/if}
	</div>

	{#if fit && fit.notes.length}
		<ul class="group">
			{#each fit.notes as note, i (i)}
				<li class="flex items-start gap-2.5 px-4 py-3" style={i ? 'box-shadow: inset 0 0.5px 0 var(--sep)' : ''}>
					<span class="mt-[7px] h-2 w-2 shrink-0 rounded-full" style="background: {TONE[note.level]}"></span>
					<span class="subhead">{note.text}</span>
				</li>
			{/each}
		</ul>
	{/if}

	{#if s.description}<p class="body">{s.description}</p>{/if}

	{#if facts.length}
		<dl class="grid grid-cols-2 gap-px overflow-hidden rounded-[22px] bg-sep/40">
			{#each facts as [label, value] (label)}
				<div class="bg-bg2 px-4 py-3">
					<dt class="caption1 text-label2">{label}</dt>
					<dd class="subhead font-semibold">{value}</dd>
				</div>
			{/each}
		</dl>
	{/if}

	{#if s.care}
		<div>
			<h3 class="footnote mb-1.5 px-1 uppercase tracking-wide text-label2">Conseils d’élevage</h3>
			<p class="subhead rounded-[22px] bg-bg2 px-4 py-3">{s.care}</p>
		</div>
	{/if}

	{#if s.hasPhoto && s.photoAuthor}
		<p class="caption2 px-1 text-label3">Photo : {s.photoAuthor}{s.photoLicense ? ` · ${s.photoLicense}` : ''}</p>
	{/if}
</div>

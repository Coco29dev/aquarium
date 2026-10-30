<script lang="ts">
	import { onMount } from 'svelte';
	import SpeciesForm from '$lib/components/SpeciesForm.svelte';
	import SpeciesThumb from '$lib/components/SpeciesThumb.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { api } from '$lib/client/api';
	import { ui } from '$lib/client/ui.svelte';
	import { speciesName } from '$lib/domain/species';
	import { KIND_LABELS, type Species, type SpeciesKind } from '$lib/types';

	let query = $state('');
	let kind = $state<'' | SpeciesKind>('');
	let water = $state<'' | 'douce' | 'mer'>('');
	let all = $state(false);
	let results = $state<Species[]>([]);
	let loading = $state(false);
	let selected = $state<Species | null>(null);
	let editing = $state(false);
	let adding = $state(false);
	let message = $state('');
	let timer: ReturnType<typeof setTimeout>;

	async function search() {
		loading = true;
		try {
			const params = new URLSearchParams();
			if (query.trim().length >= 2) params.set('q', query.trim());
			if (kind) params.set('kind', kind);
			if (water) params.set('water', water);
			if (all) params.set('all', '1');
			results = await api<Species[]>('GET', `/api/species?${params}`);
			message = '';
		} catch (e) {
			message = (e as Error).message;
		} finally {
			loading = false;
		}
	}
	function later() {
		clearTimeout(timer);
		timer = setTimeout(search, 250);
	}
	onMount(search);

	async function open(id: number) {
		try {
			selected = await api<Species>('GET', `/api/species/${id}`);
			editing = false;
			adding = false;
			scrollTo({ top: 0 });
		} catch (e) {
			message = (e as Error).message;
		}
	}

	async function verify(s: Species) {
		await api('PATCH', `/api/species/${s.id}`, { verified: true });
		ui.show('Fiche marquée comme vérifiée');
		await open(s.id);
	}

	async function remove(s: Species) {
		if (!confirm(`Supprimer « ${speciesName(s)} » ?`)) return;
		try {
			await api('DELETE', `/api/species/${s.id}`);
			ui.show(`« ${speciesName(s)} » supprimée`);
			selected = null;
			await search();
		} catch (e) {
			message = (e as Error).message;
		}
	}

	const range = (a: number | null, b: number | null, unit = '') =>
		a == null || b == null ? null : `${a.toLocaleString('fr-FR')}–${b.toLocaleString('fr-FR')}${unit}`;
	const waterOf = (s: Species) =>
		[s.fresh && 'Douce', s.brackish && 'Saumâtre', s.salt && 'Mer'].filter(Boolean).join(', ') || null;
	const sourceLabel = (s: Species) =>
		({ fishbase: 'FishBase', sealifebase: 'SeaLifeBase', maison: 'saisie à la main', noyau: 'noyau encyclopédique' })[s.source];
	const est = (s: Species, key: string) => (s.estimated.includes(key) ? ' (estimé)' : '');

	/** Fiche d'élevage : seules les lignes renseignées sont affichées. */
	function facts(s: Species): { label: string; value: string }[] {
		const rows: [string, string | null][] = [
			['Température', range(s.tempMin, s.tempMax, ' °C')],
			['pH', range(s.phMin, s.phMax)],
			['Taille adulte', s.maxLengthCm ? `${s.maxLengthCm.toLocaleString('fr-FR')} cm` : null],
			['Volume min.', s.minTankL ? `${s.minTankL} L` : null],
			['Groupe min.', s.groupMin ? `${s.groupMin}${est(s, 'groupMin')}` : null],
			['Eau', waterOf(s)],
			['Tempérament', s.temperament],
			['Régime', s.diet ? `${s.diet}${est(s, 'diet')}` : null],
			['Zone du bac', s.zone ? `${s.zone}${est(s, 'zone')}` : null],
			['Compatible récif', s.reefSafe == null ? null : s.reefSafe ? 'oui' : 'non'],
			['Durée de vie', s.lifespanYears ? `${s.lifespanYears.toLocaleString('fr-FR')} ans` : null]
		];
		return rows.filter((r): r is [string, string] => r[1] != null).map(([label, value]) => ({ label, value }));
	}

	const KINDS: ['' | SpeciesKind, string][] = [['', 'Tout'], ...(Object.entries(KIND_LABELS) as [SpeciesKind, string][])];
	const WATERS: ['' | 'douce' | 'mer', string][] = [['', 'Toutes eaux'], ['douce', 'Eau douce'], ['mer', 'Eau de mer']];
</script>

<svelte:head><title>{selected ? speciesName(selected) : 'Espèces'} · Bulle</title></svelte:head>

{#if message}<p class="mb-4 rounded-lg border-2 border-bad bg-bad-soft p-3 text-sm font-bold text-bad" role="alert">{message}</p>{/if}

{#if adding}
	<div class="rise">
		<button class="-ml-1 mb-3 flex items-center gap-1 text-sm font-bold text-muted" onclick={() => (adding = false)}>
			<Icon name="back" size={18} />Espèces
		</button>
		<h1 class="display mb-2 text-[2.15rem]">Nouvelle espèce</h1>
		<p class="hand mb-5 text-lg text-muted">Remplis ce que tu sais, le reste peut attendre.</p>
		<SpeciesForm onsaved={open} oncancel={() => (adding = false)} />
	</div>
{:else if selected}
	{@const s = selected}
	{@const rows = facts(s)}
	<article class="rise">
		<button class="-ml-1 mb-4 flex items-center gap-1 text-sm font-bold text-muted" onclick={() => (selected = null)}>
			<Icon name="back" size={18} />Espèces
		</button>

		<figure class="mb-5">
			<SpeciesThumb species={s} alt={speciesName(s)} class="aspect-[4/3] w-full rounded-[0.875rem] border-2 shadow-[4px_4px_0_var(--shadow)]" iconSize={64} />
			{#if s.hasPhoto}
				<figcaption class="mt-2 text-[11px] text-muted">
					Photo : {s.photoAuthor ?? 'auteur inconnu'} · {s.photoLicense}
					{#if s.photoSource}· <a href={s.photoSource} target="_blank" rel="noreferrer" class="underline">source</a>{/if}
				</figcaption>
			{/if}
		</figure>

		<p class="num mb-1 text-[11px] uppercase tracking-wider text-muted">{KIND_LABELS[s.kind]} · {sourceLabel(s)}</p>
		<h1 class="display text-[2.3rem] break-words">{speciesName(s)}</h1>
		<p class="mt-1 text-lg italic">{s.scientificName}</p>
		{#if s.nameEn && s.nameEn !== speciesName(s)}<p class="text-sm text-muted">{s.nameEn}</p>{/if}

		{#if s.dataQuality === 'claude'}
			<div class="mt-5 flex flex-col gap-2">
				<span class="tape self-start">Fiche à vérifier</span>
				<div class="card-flat flex items-center gap-3 p-3">
					<p class="min-w-0 flex-1 text-sm">Rédigée de mémoire par Claude. Recoupe avant de t’y fier.</p>
					<button class="btn-ghost min-h-10 shrink-0 px-3 text-sm" onclick={() => verify(s)}>
						<Icon name="check" size={16} />Vérifiée
					</button>
				</div>
			</div>
		{:else if s.dataQuality === 'verifie'}
			<p class="chip mt-4 bg-ok-soft text-ok"><Icon name="check" size={13} />Fiche vérifiée</p>
		{/if}

		{#if s.description}<p class="mt-5 leading-relaxed">{s.description}</p>{/if}

		{#if !editing}
			<section class="mt-7">
				<h2 class="tape mb-3">Fiche d’élevage</h2>
				{#if rows.length}
					<dl class="card grid grid-cols-2 overflow-hidden">
						{#each rows as r, i (r.label)}
							{@const wide = rows.length % 2 === 1 && i === rows.length - 1}
							<div class="flex flex-col gap-0.5 border-edge px-4 py-3 {wide ? 'col-span-2' : i % 2 === 0 ? 'border-r-2' : ''} {i < rows.length - (rows.length % 2 === 0 ? 2 : 1) ? 'border-b-2' : ''}">
								<dt class="text-[11px] font-bold uppercase tracking-wide text-muted">{r.label}</dt>
								<dd class="num text-base first-letter:uppercase">{r.value}</dd>
							</div>
						{/each}
					</dl>
				{:else}
					<p class="hand text-lg text-muted">Rien de renseigné pour l’instant. Complète la fiche si tu connais l’espèce.</p>
				{/if}
				{#if s.notes}
					<div class="card-flat mt-4 p-4">
						<p class="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">Notes d’élevage</p>
						<p class="hand whitespace-pre-wrap text-lg leading-snug">{s.notes}</p>
					</div>
				{/if}
			</section>
			<div class="mt-6 flex flex-col gap-3">
				<button class="btn-ghost w-full" onclick={() => (editing = true)}><Icon name="edit" size={18} />Modifier la fiche</button>
				{#if s.source === 'maison'}
					<button class="flex items-center justify-center gap-2 py-2 text-sm font-bold text-bad" onclick={() => remove(s)}>
						<Icon name="trash" size={16} />Supprimer cette espèce
					</button>
				{/if}
			</div>
		{:else}
			<section class="mt-7">
				<h2 class="tape mb-3">Modifier</h2>
				{#key s.id}<SpeciesForm species={s} onsaved={open} oncancel={() => (editing = false)} />{/key}
			</section>
		{/if}
	</article>
{:else}
	<div class="rise">
		<PageHeader title="Espèces" kicker="Encyclopédie" back="/outils" backLabel="Atelier" />
	</div>

	<div class="rise mb-3" style="animation-delay: 30ms">
		<label class="card-flat flex items-center gap-2 px-3">
			<Icon name="search" size={20} class="text-muted" />
			<input
				bind:value={query}
				oninput={later}
				type="search"
				placeholder="Néon, Paracheirodon, clownfish…"
				class="min-w-0 flex-1 bg-transparent py-3 text-base outline-none"
				aria-label="Rechercher une espèce"
			/>
		</label>
	</div>

	<div class="rise -mx-5 mb-2 flex gap-2 overflow-x-auto px-5 pb-1" style="scrollbar-width: none; animation-delay: 50ms">
		{#each KINDS as [value, label] (value)}
			<button
				class="shrink-0 rounded-full border-2 border-edge px-3 py-1 text-sm font-bold {kind === value ? 'bg-ink text-on-ink' : 'bg-surface'}"
				aria-pressed={kind === value}
				onclick={() => ((kind = value), search())}
			>
				{label}
			</button>
		{/each}
	</div>
	<div class="rise mb-3 flex flex-wrap items-center gap-2" style="animation-delay: 70ms">
		{#each WATERS as [value, label] (value)}
			<button
				class="rounded-full px-3 py-1 text-xs font-bold {water === value ? 'bg-surface2 text-ink ring-2 ring-edge' : 'text-muted'}"
				aria-pressed={water === value}
				onclick={() => ((water = value), search())}
			>
				{label}
			</button>
		{/each}
	</div>
	<label class="mb-5 flex items-center gap-2 text-xs text-muted">
		<input type="checkbox" bind:checked={all} onchange={search} class="h-4 w-4 accent-primary" />
		Inclure la base brute (environ 8 000 espèces, souvent sans fiche)
	</label>

	{#if results.length}
		<ul class="mb-4 grid grid-cols-2 gap-3">
			{#each results as s (s.id)}
				<li>
					<button class="card press flex h-full w-full flex-col overflow-hidden text-left" onclick={() => open(s.id)}>
						<SpeciesThumb species={s} class="aspect-[4/3] w-full border-b-2" iconSize={36} />
						<span class="flex min-w-0 flex-1 flex-col gap-0.5 p-3">
							<span class="line-clamp-2 text-sm font-bold leading-tight">{speciesName(s)}</span>
							<span class="truncate text-xs italic text-muted">{s.scientificName}</span>
							<span class="mt-auto flex flex-wrap gap-1 pt-1.5">
								{#if s.maxLengthCm}<span class="num text-[11px] text-muted">{s.maxLengthCm.toLocaleString('fr-FR')} cm</span>{/if}
								{#if !s.curated}<span class="text-[11px] text-muted">· base brute</span>{/if}
								{#if s.dataQuality === 'verifie'}<span class="text-ok"><Icon name="check" size={13} /></span>{/if}
							</span>
						</span>
					</button>
				</li>
			{/each}
		</ul>
		{#if results.length >= 40}<p class="hand mb-4 text-center text-lg text-muted">Les 40 premières : précise ta recherche.</p>{/if}
	{:else if !loading}
		<div class="card-flat mb-4 flex flex-col items-center gap-2 px-4 py-8 text-center">
			<Icon name="fish" size={36} class="text-muted" />
			<p class="hand text-lg text-muted">Rien trouvé. Essaie le nom latin, ou coche la base brute.</p>
		</div>
	{:else}
		<p class="hand mb-4 text-lg text-muted">Je feuillette…</p>
	{/if}

	<button class="btn w-full" onclick={() => (adding = true)}><Icon name="plus" size={20} />Ajouter une espèce à la main</button>
	<p class="mt-8 text-xs leading-relaxed text-muted">
		Données de base : FishBase (fishbase.org) et SeaLifeBase (sealifebase.org), CC-BY-NC 4.0. Photos : Wikimedia Commons, auteurs et
		licences indiqués sous chaque image.
	</p>
{/if}

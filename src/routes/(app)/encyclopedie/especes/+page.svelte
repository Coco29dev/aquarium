<script lang="ts">
	import { onMount } from 'svelte';
	import SpeciesForm from '$lib/components/SpeciesForm.svelte';
	import SpeciesThumb from '$lib/components/SpeciesThumb.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Sheet from '$lib/ios/Sheet.svelte';
	import Segmented from '$lib/ios/Segmented.svelte';
	import SearchField from '$lib/ios/SearchField.svelte';
	import Switch from '$lib/ios/Switch.svelte';
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
	let busy = $state(false);
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
	onMount(() => {
		// Liens de l'encyclopédie : ?id=ID ouvre la fiche, ?q=, ?kind= et ?water= préremplissent la recherche.
		const params = new URLSearchParams(location.search);
		query = params.get('q') ?? '';
		const k = params.get('kind');
		if (k && k in KIND_LABELS) kind = k as SpeciesKind;
		const w = params.get('water');
		if (w === 'douce' || w === 'mer') water = w;
		void search();
		const id = Number(params.get('id'));
		if (Number.isInteger(id) && id > 0) void open(id);
	});

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

	async function saved(id: number) {
		const wasAdding = adding;
		await open(id);
		ui.show(wasAdding ? 'Espèce ajoutée' : 'Fiche enregistrée', undefined, 'check');
		void search();
	}

	async function verify(s: Species) {
		try {
			await api('PATCH', `/api/species/${s.id}`, { verified: true });
			ui.show('Fiche vérifiée', undefined, 'check');
			await open(s.id);
		} catch (e) {
			message = (e as Error).message;
		}
	}

	async function remove(s: Species) {
		const ok = await ui.confirm({
			title: `Supprimer « ${speciesName(s)} » ?`,
			message: 'La fiche sera retirée de l’encyclopédie.',
			confirmLabel: 'Supprimer',
			destructive: true
		});
		if (!ok) return;
		try {
			await api('DELETE', `/api/species/${s.id}`);
			ui.show(`${speciesName(s)} supprimée`);
			selected = null;
			await search();
		} catch (e) {
			message = (e as Error).message;
		}
	}

	const range = (a: number | null, b: number | null, unit = '') =>
		a == null || b == null ? null : `${a.toLocaleString('fr-FR')} – ${b.toLocaleString('fr-FR')}${unit}`;
	const waterOf = (s: Species) =>
		[s.fresh && 'Douce', s.brackish && 'Saumâtre', s.salt && 'Mer'].filter(Boolean).join(', ') || null;
	const sourceLabel = (s: Species) =>
		({ fishbase: 'FishBase', sealifebase: 'SeaLifeBase', maison: 'Saisie à la main', noyau: 'Encyclopédie' })[s.source];
	const est = (s: Species, key: string) => (s.estimated.includes(key) ? ' (estimé)' : '');
	const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
	const DIFFICULTY = { 1: 'Facile', 2: 'Intermédiaire', 3: 'Exigeant' } as const;
	const DIFFICULTY_COLOR = { 1: 'text-green', 2: 'text-orange', 3: 'text-red' } as const;
	const LIGHT = { 1: 'Faible', 2: 'Moyenne', 3: 'Forte' } as const;
	const CO2 = { 0: 'Inutile', 1: 'Conseillé', 2: 'Indispensable' } as const;

	/** Fiche d'élevage : seules les lignes renseignées sont affichées. */
	function facts(s: Species): { label: string; value: string }[] {
		const rows: [string, string | null][] = [
			['Température', range(s.tempMin, s.tempMax, ' °C')],
			['pH', range(s.phMin, s.phMax)],
			['Taille adulte', s.maxLengthCm ? `${s.maxLengthCm.toLocaleString('fr-FR')} cm` : null],
			['Bac minimum', s.minTankL ? `${s.minTankL} L` : null],
			['Groupe minimum', s.groupMin ? `${s.groupMin}${est(s, 'groupMin')}` : null],
			['Eau', waterOf(s)],
			['Tempérament', s.temperament ? cap(s.temperament) : null],
			['Régime', s.diet ? `${cap(s.diet)}${est(s, 'diet')}` : null],
			['Zone du bac', s.zone ? `${cap(s.zone)}${est(s, 'zone')}` : null],
			['Compatible récif', s.reefSafe == null ? null : s.reefSafe ? 'Oui' : 'Non'],
			['Durée de vie', s.lifespanYears ? `${s.lifespanYears.toLocaleString('fr-FR')} ans` : null],
			['Provenance', s.origin],
			['Difficulté', s.difficulty ? DIFFICULTY[s.difficulty] : null],
			['Lumière', s.light ? LIGHT[s.light] : null],
			['CO₂', s.co2 == null ? null : CO2[s.co2]]
		];
		return rows.filter((r): r is [string, string] => r[1] != null).map(([label, value]) => ({ label, value }));
	}

	const KINDS: ['' | SpeciesKind, string][] = [['', 'Tout'], ...(Object.entries(KIND_LABELS) as [SpeciesKind, string][])];
	const WATERS: { value: '' | 'douce' | 'mer'; label: string }[] = [
		{ value: '', label: 'Toutes' },
		{ value: 'douce', label: 'Eau douce' },
		{ value: 'mer', label: 'Eau de mer' }
	];
	const submit = (id: string) => (document.getElementById(id) as HTMLFormElement | null)?.requestSubmit();
</script>

<svelte:head><title>{selected ? speciesName(selected) : 'Espèces'} · Aquarium</title></svelte:head>

{#if selected}
	{@const s = selected}
	{@const rows = facts(s)}
	<NavBar title={speciesName(s)} large={false}>
		{#snippet leading()}
			<button class="btn-plain -ml-0.5 flex items-center gap-0.5 pr-2" onclick={() => (selected = null)}>
				<Icon name="back" size={26} weight={2.4} />Espèces
			</button>
		{/snippet}
		{#snippet trailing()}
			<button class="btn-plain px-2" onclick={() => (editing = true)}>Modifier</button>
		{/snippet}
	</NavBar>

	<article>
		<figure class="-mx-4 mb-4">
			<SpeciesThumb species={s} alt={speciesName(s)} class="aspect-[4/3] w-full" iconSize={88} />
			{#if s.hasPhoto}
				<figcaption class="caption1 mt-1.5 px-4 text-label2">
					{s.photoAuthor ?? 'Auteur inconnu'} · {s.photoLicense}
					{#if s.photoSource}· <a href={s.photoSource} target="_blank" rel="noreferrer" class="text-tint">Source</a>{/if}
				</figcaption>
			{/if}
		</figure>

		<div class="mb-6 px-1">
			<p class="footnote font-semibold uppercase text-label2">{KIND_LABELS[s.kind]}</p>
			<h1 class="title1 mt-0.5 break-words">{speciesName(s)}</h1>
			<p class="body mt-0.5 italic text-label2">{s.scientificName}</p>
			{#if s.nameEn && s.nameEn !== speciesName(s)}<p class="subhead text-label3">{s.nameEn}</p>{/if}
		</div>

		{#if s.dataQuality === 'claude'}
			<div class="mb-6 flex items-center gap-3 rounded-[22px] bg-orange/12 py-3 pl-4 pr-3">
				<span class="shrink-0 text-orange" style="--cut: var(--bg)"><Icon name="info" size={22} filled /></span>
				<p class="footnote min-w-0 flex-1">
					<span class="font-semibold">À vérifier.</span> Fiche rédigée de mémoire par Claude, recoupe avant de t’y fier.
				</p>
				<button class="subhead shrink-0 rounded-full bg-orange px-3.5 py-1.5 font-semibold text-white active:opacity-70" onclick={() => verify(s)}>
					Vérifiée
				</button>
			</div>
		{:else if s.dataQuality === 'verifie'}
			<p class="footnote mb-6 flex items-center gap-1.5 px-1 font-semibold text-green">
				<Icon name="check" size={15} weight={2.8} />Fiche vérifiée
			</p>
		{/if}

		{#if s.description}<p class="body mb-8 px-1 leading-relaxed">{s.description}</p>{/if}

		<Section header="Fiche d’élevage" variant="title">
			{#if rows.length}
				{#each rows as r (r.label)}
					<Row title={r.label} value={r.value} />
				{/each}
			{:else}
				<li class="subhead px-4 py-3 text-label2">Rien de renseigné pour l’instant.</li>
			{/if}
		</Section>

		{#if s.care}
			<Section header="Conseils d’entretien" variant="title">
				<li class="body px-4 py-3 leading-relaxed">{s.care}</li>
			</Section>
		{/if}

		{#if s.notes}
			<Section header="Notes d’élevage" variant="title">
				<li class="body whitespace-pre-wrap px-4 py-3">{s.notes}</li>
			</Section>
		{/if}

		<Section footer="Source : {sourceLabel(s)}.">
			<Row icon="edit" title="Modifier la fiche" action onclick={() => (editing = true)} />
			{#if s.source === 'maison'}
				<Row icon="trash" title="Supprimer cette espèce" destructive onclick={() => remove(s)} />
			{/if}
		</Section>
	</article>
{:else}
	<NavBar title="Espèces" back={{ href: '/encyclopedie', label: 'Encyclopédie' }}>
		{#snippet trailing()}
			<button class="btn-plain grid h-10 w-10 place-items-center" aria-label="Ajouter une espèce" onclick={() => (adding = true)}>
				<Icon name="plus" size={24} weight={2.2} />
			</button>
		{/snippet}
		<SearchField bind:value={query} oninput={later} placeholder="Néon, Paracheirodon, clown…" label="Rechercher une espèce" />
	</NavBar>

	<div class="mb-3 mt-1">
		<Segmented options={WATERS} bind:value={water} onchange={search} label="Type d’eau" />
	</div>
	<div class="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4" style="scrollbar-width: none">
		{#each KINDS as [value, label] (value)}
			<button
				class="subhead shrink-0 rounded-full px-3.5 py-1.5 font-semibold transition-colors {kind === value ? 'bg-tint text-white' : 'bg-bg2 text-label'}"
				aria-pressed={kind === value}
				onclick={() => ((kind = value), search())}
			>
				{label}
			</button>
		{/each}
	</div>

	{#if message}<p class="subhead mb-4 rounded-2xl bg-red/12 px-4 py-3 text-red" role="alert">{message}</p>{/if}

	{#if results.length}
		<Section footer={results.length >= 40 ? 'Les 40 premières : précise ta recherche.' : undefined}>
			{#each results as s (s.id)}
				<Row onclick={() => open(s.id)} chevron>
					{#snippet leading()}
						<SpeciesThumb species={s} class="my-2 h-[52px] w-[52px] shrink-0 rounded-[12px]" iconSize={24} />
					{/snippet}
					<p class="body truncate font-semibold">{speciesName(s)}</p>
					<p class="subhead truncate italic text-label2">{s.scientificName}</p>
					<p class="caption1 mt-0.5 flex items-center gap-1.5 text-label3">
						{KIND_LABELS[s.kind]}{s.maxLengthCm ? ` · ${s.maxLengthCm.toLocaleString('fr-FR')} cm` : ''}{!s.curated ? ' · base brute' : ''}
						{#if s.difficulty}<span class="font-semibold {DIFFICULTY_COLOR[s.difficulty]}">· {DIFFICULTY[s.difficulty]}</span>{/if}
						{#if s.dataQuality === 'verifie'}<span class="text-green"><Icon name="check" size={12} weight={3} /></span>{/if}
					</p>
				</Row>
			{/each}
		</Section>
	{:else if !loading}
		<div class="flex flex-col items-center px-8 py-14 text-center">
			<span class="mb-3 text-label3"><Icon name="search" size={48} weight={1.6} /></span>
			<p class="title3">Aucun résultat</p>
			<p class="subhead mt-1 text-label2">Essaie le nom latin, ou inclus la base complète ci-dessous.</p>
		</div>
	{:else}
		<div class="grid place-items-center py-14">
			<span class="h-6 w-6 animate-spin rounded-full border-[3px] border-fill border-t-label2" aria-label="Recherche"></span>
		</div>
	{/if}

	<Section footer="La base complète compte environ 8 000 espèces, souvent sans fiche d’élevage.">
		<Row title="Inclure la base complète">
			{#snippet trailing()}
				<Switch bind:checked={all} onchange={search} label="Inclure la base complète" />
			{/snippet}
		</Row>
		<Row icon="plus" title="Ajouter une espèce à la main" action onclick={() => (adding = true)} />
	</Section>

	<p class="caption1 px-4 pb-4 text-label2">
		Données de base : FishBase (fishbase.org) et SeaLifeBase (sealifebase.org), CC-BY-NC 4.0. Photos : Wikimedia Commons, auteurs et
		licences indiqués sous chaque image.
	</p>
{/if}

<Sheet
	open={adding}
	title="Nouvelle espèce"
	onclose={() => (adding = false)}
	action={{ label: 'Ajouter', onclick: () => submit('species-new'), disabled: busy }}
>
	{#if adding}<SpeciesForm formId="species-new" onsaved={saved} onbusy={(b) => (busy = b)} />{/if}
</Sheet>

<Sheet
	open={editing && selected != null}
	title="Modifier la fiche"
	onclose={() => (editing = false)}
	action={{ label: 'OK', onclick: () => submit('species-edit'), disabled: busy }}
>
	{#if editing && selected}
		{#key selected.id}<SpeciesForm species={selected} formId="species-edit" onsaved={saved} onbusy={(b) => (busy = b)} />{/key}
	{/if}
</Sheet>

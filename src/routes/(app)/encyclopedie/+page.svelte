<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import SearchField from '$lib/ios/SearchField.svelte';
	import { ALL_GUIDES, THEMES, guideOf, LEVEL_LABELS } from '$lib/content';

	let query = $state('');

	/** Minuscules sans accents : « ecrevisse » trouve « Écrevisse ». */
	const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
	const needle = $derived(fold(query.trim()));

	const results = $derived(
		needle.length < 2
			? []
			: ALL_GUIDES.filter(({ guide, theme }) => fold(`${guide.title} ${guide.summary} ${theme.title}`).includes(needle)).slice(0, 12)
	);

	const species: { href: string; title: string; subtitle: string; icon: 'fish' | 'leaf' | 'coral'; color: string }[] = [
		{ href: '/encyclopedie/especes?kind=poisson&water=douce', title: 'Poissons d’eau douce', subtitle: 'Characins, cichlidés, loches, vivipares…', icon: 'fish', color: 'var(--blue)' },
		{ href: '/encyclopedie/especes?kind=invertebre&water=douce', title: 'Crevettes, escargots, écrevisses', subtitle: 'Invertébrés d’eau douce', icon: 'fish', color: 'var(--orange)' },
		{ href: '/encyclopedie/especes?kind=plante', title: 'Plantes d’aquarium', subtitle: 'Lumière, CO₂ et difficulté pour chaque plante', icon: 'leaf', color: 'var(--green)' },
		{ href: '/encyclopedie/especes?water=mer', title: 'Eau de mer', subtitle: 'Poissons, coraux, invertébrés', icon: 'coral', color: 'var(--cyan)' }
	];

	// Les trois lectures pour commencer, puis les urgences les plus fréquentes.
	const START = ['demarrer/choisir-son-bac', 'demarrer/cycle-azote', 'demarrer/premiers-poissons'];
	const HELP = ['sante/mort-dun-poisson', 'sante/ichtyo', 'sante/ammoniac-nitrites', 'entretien/algues', 'entretien/eau-trouble'];
	const resolve = (refs: string[]) =>
		refs.flatMap((ref) => {
			const [t, g] = ref.split('/');
			const hit = guideOf(t, g);
			return hit ? [hit] : [];
		});
</script>

<svelte:head><title>Encyclopédie · Aquarium</title></svelte:head>

<NavBar title="Encyclopédie">
	<SearchField bind:value={query} placeholder="Cyclage, algues, néon…" label="Rechercher dans l’encyclopédie" />
</NavBar>

{#if needle.length >= 2}
	{#if results.length}
		<Section header="Guides">
			{#each results as { theme, guide } (theme.slug + guide.slug)}
				<Row href="/encyclopedie/{theme.slug}/{guide.slug}" icon={theme.icon} iconColor={theme.color} title={guide.title} subtitle={guide.summary} />
			{/each}
		</Section>
	{:else}
		<p class="subhead px-4 pb-4 text-label2">Aucun guide ne correspond.</p>
	{/if}
	<Section>
		<Row href="/encyclopedie/especes?q={encodeURIComponent(query.trim())}" icon="search" iconColor="var(--teal)" title="Chercher « {query.trim()} » dans les espèces" />
	</Section>
{:else}
	<Section header="Espèces" footer="Chaque fiche donne les conditions, la taille adulte, la difficulté, la provenance et des conseils d’entretien.">
		{#each species as s (s.href)}
			<Row href={s.href} icon={s.icon} iconColor={s.color} title={s.title} subtitle={s.subtitle} />
		{/each}
		<Row href="/encyclopedie/especes" icon="search" title="Toutes les espèces" action />
	</Section>

	<Section header="Pour commencer">
		{#each resolve(START) as { theme, guide } (guide.slug)}
			<Row href="/encyclopedie/{theme.slug}/{guide.slug}" icon={theme.icon} iconColor={theme.color} title={guide.title} subtitle={guide.summary} />
		{/each}
	</Section>

	<Section header="Guides par thème">
		{#each THEMES as theme (theme.slug)}
			<Row
				href="/encyclopedie/{theme.slug}"
				icon={theme.icon}
				iconColor={theme.color}
				title={theme.title}
				subtitle={theme.summary}
				value={String(theme.guides.length)}
			/>
		{/each}
	</Section>

	<Section header="Un souci ? Regarde ici d’abord" footer="Informations générales, pas un avis vétérinaire. Pour un traitement, suis toujours la notice du produit ou demande conseil à un professionnel.">
		{#each resolve(HELP) as { theme, guide } (guide.slug)}
			<Row href="/encyclopedie/{theme.slug}/{guide.slug}" icon="alert" iconColor="var(--red)" title={guide.title} subtitle={LEVEL_LABELS[guide.level ?? 'debutant'] + ' · ' + guide.minutes + ' min'} />
		{/each}
	</Section>

	<p class="caption1 px-4 pb-4 text-label2">
		Fiches d’espèces : données de base FishBase et SeaLifeBase (CC-BY-NC 4.0) enrichies et rédigées avec Claude ; les fiches non vérifiées sont signalées.
		Photos : Wikimedia Commons.
	</p>
{/if}

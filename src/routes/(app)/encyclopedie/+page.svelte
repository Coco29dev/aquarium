<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import SearchField from '$lib/ios/SearchField.svelte';
	import Tile from '$lib/relief/Tile.svelte';
	import Carousel from '$lib/relief/Carousel.svelte';
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
	<!-- Espèces : mosaïque, une grande tuile et trois plus petites -->
	<section class="mb-8" aria-label="Espèces">
		<div class="grid grid-cols-2 gap-3">
			<Tile href="/encyclopedie/especes?kind=poisson&water=douce" tone="var(--blue)" variant="solid" mark="fish" class="rise row-span-2 flex min-h-[15rem] flex-col justify-end">
				<p class="caption1 font-semibold uppercase tracking-wide text-white/80">Eau douce</p>
				<p class="title2 mt-1">Poissons</p>
				<p class="footnote mt-1 text-white/85">Characins, cichlidés, loches, vivipares…</p>
			</Tile>
			<Tile href="/encyclopedie/especes?kind=plante" tone="var(--green)" variant="solid" mark="leaf" class="rise min-h-[7rem]">
				<p class="title3">Plantes</p>
				<p class="footnote mt-1 text-white/85">Lumière, CO₂, difficulté</p>
			</Tile>
			<Tile href="/encyclopedie/especes?kind=invertebre&water=douce" tone="var(--orange)" variant="solid" mark="box" class="rise min-h-[7rem]">
				<p class="title3">Invertébrés</p>
				<p class="footnote mt-1 text-white/85">Crevettes, escargots</p>
			</Tile>
			<Tile href="/encyclopedie/especes?water=mer" tone="var(--cyan)" variant="soft" mark="coral" class="rise col-span-2 min-h-[5.5rem]">
				<div class="flex items-center gap-3">
					<div class="min-w-0 flex-1">
						<p class="title3">Eau de mer</p>
						<p class="footnote mt-0.5 text-label2">Poissons, coraux, invertébrés</p>
					</div>
				</div>
			</Tile>
		</div>
		<a href="/encyclopedie/especes" class="btn-plain subhead mt-3 block px-1 font-semibold">Toutes les espèces →</a>
	</section>

	<!-- Pour commencer : trois lectures en cartes hautes -->
	<Carousel header="Pour commencer">
		{#each resolve(START) as { theme, guide }, i (guide.slug)}
			<Tile href="/encyclopedie/{theme.slug}/{guide.slug}" tone={theme.color} variant="solid" mark={theme.icon} class="flex min-h-[12rem] w-[68%] max-w-64 shrink-0 snap-start flex-col justify-end {i === 1 ? 'mt-5' : ''}">
				<p class="caption1 font-semibold uppercase tracking-wide text-white/80">{guide.minutes} min · {LEVEL_LABELS[guide.level ?? 'debutant']}</p>
				<p class="headline mt-1">{guide.title}</p>
				<p class="footnote mt-1 line-clamp-2 text-white/85">{guide.summary}</p>
			</Tile>
		{/each}
	</Carousel>

	<!-- Thèmes : grille de tuiles teintées -->
	<section class="mb-8" aria-label="Guides par thème">
		<h2 class="title3 mb-2.5 px-1 font-bold">Guides par thème</h2>
		<div class="grid grid-cols-2 gap-3">
			{#each THEMES as theme, i (theme.slug)}
				<Tile href="/encyclopedie/{theme.slug}" tone={theme.color} variant="soft" mark={theme.icon} class="reveal flex min-h-[7.5rem] flex-col justify-between {i === THEMES.length - 1 && THEMES.length % 2 ? 'col-span-2' : ''}">
					<span class="grid h-9 w-9 place-items-center rounded-[12px] text-white" style="background: {theme.color}; --cut: {theme.color}"><Icon name={theme.icon} size={20} filled weight={1.8} /></span>
					<div class="mt-3">
						<p class="headline">{theme.title}</p>
						<p class="footnote text-label2">{theme.guides.length} guide{theme.guides.length > 1 ? 's' : ''}</p>
					</div>
				</Tile>
			{/each}
		</div>
	</section>

	<!-- Dépannage -->
	<section class="reveal mb-8">
		<h2 class="title3 mb-2.5 px-1 font-bold">Un souci ? Regarde ici d’abord</h2>
		<ul class="raised overflow-hidden" style="border-left: 5px solid var(--red)">
			{#each resolve(HELP) as { theme, guide }, i (guide.slug)}
				<li class={i ? 'shadow-[inset_0_0.5px_0_var(--sep)]' : ''}>
					<a href="/encyclopedie/{theme.slug}/{guide.slug}" class="tappable flex min-h-12 items-center gap-3 px-4 py-2.5">
						<span class="text-red" style="--cut: var(--bg2)"><Icon name="alert" size={18} filled weight={1.8} /></span>
						<span class="body min-w-0 flex-1">{guide.title}</span>
						<span class="text-label3"><Icon name="next" size={15} weight={2.4} /></span>
					</a>
				</li>
			{/each}
		</ul>
		<p class="footnote mt-2 px-4 text-label2">Informations générales, pas un avis vétérinaire. Pour un traitement, suis la notice du produit ou demande conseil à un professionnel.</p>
	</section>

	<p class="caption1 px-4 pb-4 text-label2">
		Fiches d’espèces : données de base FishBase et SeaLifeBase (CC-BY-NC 4.0) enrichies et rédigées avec Claude ; les fiches non vérifiées sont signalées.
		Photos : Wikimedia Commons.
	</p>
{/if}

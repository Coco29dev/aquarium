<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import { LEVEL_LABELS, resolveRelated } from '$lib/content';

	let { data } = $props();
	const theme = $derived(data.theme);
	const guide = $derived(data.guide);
	const related = $derived((guide.related ?? []).flatMap((ref: string) => resolveRelated(ref) ?? []));
	const LEVEL_COLOR = { debutant: 'text-green', intermediaire: 'text-orange', avance: 'text-red' } as const;
</script>

<svelte:head><title>{guide.title} · Encyclopédie</title></svelte:head>

<NavBar title={guide.title} back={{ href: `/encyclopedie/${theme.slug}`, label: 'Guides' }} large={false} />

<article class="pb-4">
	<header class="mb-6 px-1 pt-3">
		<p class="footnote font-semibold uppercase" style="color: {theme.color}">{theme.title}</p>
		<h1 class="title1 mt-0.5">{guide.title}</h1>
		<p class="body mt-1 text-label2">{guide.summary}</p>
		<p class="subhead mt-2 flex items-center gap-2 text-label2">
			{#if guide.level}<span class="font-semibold {LEVEL_COLOR[guide.level]}">{LEVEL_LABELS[guide.level]}</span><span aria-hidden="true">·</span>{/if}
			<span>{guide.minutes} min de lecture</span>
		</p>
	</header>

	{#each guide.blocks as block, i (i)}
		<section class="mb-6 px-1">
			{#if block.h}<h2 class="title3 mb-2 font-bold">{block.h}</h2>{/if}
			{#each block.p ?? [] as paragraph}
				<p class="body mb-3 leading-relaxed">{paragraph}</p>
			{/each}
			{#if block.list}
				<ul class="space-y-2">
					{#each block.list as item}
						<li class="body flex gap-3 leading-relaxed">
							<span class="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full" style="background: {theme.color}" aria-hidden="true"></span>
							<span class="min-w-0 flex-1">{item}</span>
						</li>
					{/each}
				</ul>
			{/if}
			{#if block.steps}
				<ol class="space-y-3">
					{#each block.steps as step, n}
						<li class="body flex gap-3 leading-relaxed">
							<span class="caption1 mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full font-bold text-white" style="background: {theme.color}">{n + 1}</span>
							<span class="min-w-0 flex-1">{step}</span>
						</li>
					{/each}
				</ol>
			{/if}
			{#if block.tip}
				<div class="mt-3 flex gap-3 rounded-[22px] bg-blue/12 py-3 pl-4 pr-4">
					<span class="mt-0.5 shrink-0 text-blue" style="--cut: var(--bg)"><Icon name="info" size={22} filled /></span>
					<p class="subhead min-w-0 flex-1 leading-relaxed"><span class="font-semibold">Astuce.</span> {block.tip}</p>
				</div>
			{/if}
			{#if block.warn}
				<div class="mt-3 flex gap-3 rounded-[22px] bg-orange/12 py-3 pl-4 pr-4">
					<span class="mt-0.5 shrink-0 text-orange" style="--cut: var(--bg)"><Icon name="alert" size={22} filled /></span>
					<p class="subhead min-w-0 flex-1 leading-relaxed"><span class="font-semibold">Attention.</span> {block.warn}</p>
				</div>
			{/if}
		</section>
	{/each}
</article>

{#if guide.species?.length}
	<Section header="Espèces à découvrir" footer="Touche une espèce pour ouvrir sa fiche dans l’encyclopédie.">
		{#each guide.species as latin (latin)}
			<Row href="/encyclopedie/especes?q={encodeURIComponent(latin)}" icon="fish" iconColor="var(--teal)" title={latin} />
		{/each}
	</Section>
{/if}

{#if guide.tool}
	<Section>
		<Row href={guide.tool.href} icon="outils" iconColor="var(--blue)" title={guide.tool.label} />
	</Section>
{/if}

{#if related.length}
	<Section header="À lire ensuite">
		{#each related as r (r.theme.slug + r.guide.slug)}
			<Row href="/encyclopedie/{r.theme.slug}/{r.guide.slug}" icon={r.theme.icon} iconColor={r.theme.color} title={r.guide.title} subtitle={r.guide.summary} />
		{/each}
	</Section>
{/if}

<script lang="ts">
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';

	let { data } = $props();
	const theme = $derived(data.theme);
</script>

<svelte:head><title>{theme.title} · Encyclopédie</title></svelte:head>

<NavBar title={theme.title} back={{ href: '/encyclopedie', label: 'Encyclopédie' }} />

<p class="body mb-6 px-1 text-label2">{theme.summary}</p>

<Section>
	{#each theme.guides as guide (guide.slug)}
		<Row href="/encyclopedie/{theme.slug}/{guide.slug}" icon={theme.icon} iconColor={theme.color} title={guide.title} subtitle={guide.summary} value="{guide.minutes} min" />
	{/each}
</Section>

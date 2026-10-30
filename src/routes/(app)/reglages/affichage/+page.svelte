<script lang="ts">
	import { onMount } from 'svelte';
	import { ui } from '$lib/client/ui.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Switch from '$lib/ios/Switch.svelte';
	import Icon from '$lib/components/Icon.svelte';

	// Apparence de l'iPhone, pour savoir quel aperçu est coché en mode Automatique.
	let systemDark = $state(false);
	onMount(() => {
		const mq = matchMedia('(prefers-color-scheme: dark)');
		systemDark = mq.matches;
		const onChange = () => (systemDark = mq.matches);
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	const auto = $derived(ui.theme === 'auto');
	const current = $derived(ui.theme === 'auto' ? (systemDark ? 'dark' : 'light') : ui.theme);

	function toggleAuto(event: Event) {
		const on = (event.currentTarget as HTMLInputElement).checked;
		ui.setTheme(on ? 'auto' : current);
	}

	// Couleurs fixes : chaque aperçu montre un thème précis, quel que soit le thème actif.
	const previews = [
		{ id: 'light', label: 'Clair', bg: '#f2f2f7', card: '#ffffff', ink: '#000000', soft: 'rgb(60 60 67 / 0.18)', frame: '#d1d1d6' },
		{ id: 'dark', label: 'Sombre', bg: '#000000', card: '#1c1c1e', ink: '#ffffff', soft: 'rgb(235 235 245 / 0.18)', frame: '#3a3a3c' }
	] as const;
</script>

<svelte:head><title>Affichage · Aquarium</title></svelte:head>

<NavBar title="Affichage" back={{ href: '/reglages', label: 'Réglages' }} large={false} />

<Section
	header="Apparence"
	class="mt-2"
	footer={auto ? 'Aquarium suit l’apparence de ton iPhone et passe en sombre en même temps que lui.' : 'Aquarium garde cette apparence, quelle que soit celle de ton iPhone.'}
>
	<li class="grid grid-cols-2 gap-4 px-6 pb-4 pt-5">
		{#each previews as p (p.id)}
			{@const on = current === p.id}
			<button class="flex flex-col items-center gap-2.5" onclick={() => ui.setTheme(p.id)} aria-pressed={on} aria-label="Apparence {p.label.toLowerCase()}">
				<span
					class="relative block aspect-[9/16] w-full max-w-[104px] overflow-hidden rounded-[18px] border-[3px] shadow-[0_2px_8px_rgb(0_0_0/0.12)] transition-[border-color] duration-200"
					style="background: {p.bg}; border-color: {on ? 'var(--tint)' : p.frame}"
					aria-hidden="true"
				>
					<span class="absolute left-[12%] right-[12%] top-[9%] h-[6%] rounded-full" style="background: {p.ink}; opacity: 0.85; width: 46%"></span>
					<span class="absolute left-[10%] right-[10%] top-[22%] h-[24%] rounded-[8px]" style="background: {p.card}">
						<span class="absolute left-[10%] top-[18%] h-[14%] w-[44%] rounded-full" style="background: #34c759"></span>
						<span class="absolute bottom-[18%] left-[10%] h-[22%] w-[34%] rounded-[4px]" style="background: {p.ink}; opacity: 0.8"></span>
					</span>
					<span class="absolute left-[10%] right-[10%] top-[50%] h-[30%] rounded-[8px]" style="background: {p.card}">
						<span class="absolute left-[10%] right-[10%] top-[22%] h-[10%] rounded-full" style="background: {p.soft}"></span>
						<span class="absolute left-[10%] right-[30%] top-[48%] h-[10%] rounded-full" style="background: {p.soft}"></span>
						<span class="absolute left-[10%] right-[20%] top-[74%] h-[10%] rounded-full" style="background: {p.soft}"></span>
					</span>
					<span class="absolute bottom-[4%] left-[10%] right-[10%] h-[8%] rounded-full" style="background: {p.card}; box-shadow: 0 1px 3px rgb(0 0 0 / 0.2)"></span>
				</span>
				<span class="subhead font-medium">{p.label}</span>
				<span
					class="grid h-[22px] w-[22px] place-items-center rounded-full border-[1.5px] transition-colors duration-200 {on ? 'border-tint bg-tint text-white' : 'border-label3'}"
					aria-hidden="true"
				>
					{#if on}<Icon name="check" size={13} weight={3.2} />{/if}
				</span>
			</button>
		{/each}
	</li>
	<Row title="Automatique">
		{#snippet trailing()}
			<Switch checked={auto} onchange={toggleAuto} label="Apparence automatique" />
		{/snippet}
	</Row>
</Section>

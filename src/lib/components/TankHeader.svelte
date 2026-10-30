<script lang="ts">
	import Icon from './Icon.svelte';
	import { SHORT_WATER, TANK_TONE, fmt, tankAge } from '$lib/ui';
	import type { Aquarium } from '$lib/types';

	// En-tête commun aux écrans d'un bac : bandeau de sa couleur, nom, repères, onglets internes.
	export type TankTab = 'suivi' | 'taches' | 'vivants' | 'journal' | 'reglages';
	interface Props {
		aquarium: Aquarium;
		tab: TankTab;
	}
	let { aquarium, tab }: Props = $props();

	const age = $derived(tankAge(aquarium));
	const tabs: { id: TankTab; label: string; href: string }[] = $derived([
		{ id: 'suivi', label: 'Suivi', href: `/aquariums/${aquarium.id}` },
		{ id: 'taches', label: 'Tâches', href: `/aquariums/${aquarium.id}/taches` },
		{ id: 'vivants', label: 'Vivants', href: `/aquariums/${aquarium.id}/inventaire` },
		{ id: 'journal', label: 'Journal', href: `/aquariums/${aquarium.id}/journal` }
	]);
</script>

<header class="-mx-5 -mt-6 mb-6">
	<div
		class="relative border-b-2 border-edge px-5 pb-5 pt-5"
		style="background: {TANK_TONE[aquarium.waterType]}; view-transition-name: tank-{aquarium.id}"
	>
		<div class="mb-4 flex items-center justify-between">
			<a href="/aquariums" class="-ml-1 flex items-center gap-1 text-sm font-bold"><Icon name="back" size={18} />Bacs</a>
			<a
				href="/aquariums/{aquarium.id}/reglages"
				class="press grid h-10 w-10 place-items-center rounded-full border-2 border-edge shadow-[2px_2px_0_var(--shadow)] {tab === 'reglages' ? 'bg-ink text-on-ink' : 'bg-surface'}"
				aria-label="Réglages du bac"
				aria-current={tab === 'reglages' ? 'page' : undefined}
			>
				<Icon name="gear" size={20} />
			</a>
		</div>
		<p class="num text-[11px] uppercase tracking-wider">
			{SHORT_WATER[aquarium.waterType]}{aquarium.volumeL ? ` · ${fmt(aquarium.volumeL, 0)} L` : ''}{age != null ? ` · jour ${age}` : ''}
		</p>
		<h1 class="display mt-1 text-[2.4rem] break-words">{aquarium.name}</h1>
	</div>
	<nav class="flex gap-1.5 overflow-x-auto border-b-2 border-edge bg-surface px-5 py-2" style="scrollbar-width: none" aria-label="Sections du bac">
		{#each tabs as t (t.id)}
			<a
				href={t.href}
				aria-current={tab === t.id ? 'page' : undefined}
				class="shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-bold {tab === t.id ? 'bg-ink text-on-ink' : 'text-muted'}"
			>
				{t.label}
			</a>
		{/each}
	</nav>
</header>

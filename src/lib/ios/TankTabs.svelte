<script lang="ts">
	import { goto } from '$app/navigation';
	import Segmented from './Segmented.svelte';
	import type { Aquarium } from '$lib/types';

	/** Contrôle segmenté des sections d'un bac : Suivi · Tâches · Vivants · Journal. */
	export type TankTab = 'suivi' | 'taches' | 'vivants' | 'journal';
	interface Props {
		aquarium: Pick<Aquarium, 'id'>;
		tab: TankTab;
	}
	let { aquarium, tab }: Props = $props();

	const paths: Record<TankTab, string> = { suivi: '', taches: '/taches', vivants: '/inventaire', journal: '/journal' };
	const options: { value: TankTab; label: string }[] = [
		{ value: 'suivi', label: 'Suivi' },
		{ value: 'taches', label: 'Tâches' },
		{ value: 'vivants', label: 'Vivants' },
		{ value: 'journal', label: 'Journal' }
	];
	let value = $derived(tab);
</script>

<Segmented
	{options}
	{value}
	label="Sections du bac"
	onchange={(v) => {
		if (v !== tab) void goto(`/aquariums/${aquarium.id}${paths[v]}`, { replaceState: true, noScroll: true });
	}}
/>

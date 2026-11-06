<script lang="ts">
	import Segmented from './Segmented.svelte';
	import type { Aquarium } from '$lib/types';

	/** Contrôle segmenté des sections d'un bac : Suivi · Tâches · Vivants · Journal. */
	export type TankTab = 'suivi' | 'taches' | 'vivants' | 'journal';
	interface Props {
		aquarium: Pick<Aquarium, 'id'>;
		tab: TankTab;
		onselect: (tab: TankTab) => void;
	}
	let { aquarium: _aquarium, tab, onselect }: Props = $props();

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
		if (v !== tab) onselect(v);
	}}
/>

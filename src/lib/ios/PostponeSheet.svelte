<script lang="ts">
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { addDays, dayInParis } from '$lib/domain/dates';
	import { shortDate } from '$lib/ui';
	import Sheet from './Sheet.svelte';
	import Section from './Section.svelte';
	import Row from './Row.svelte';
	import type { Task } from '$lib/types';

	// Feuille « Reporter » : trois délais, comme les options de report de Rappels.
	let { task = $bindable() }: { task: Task | null } = $props();

	const choices = [
		{ days: 1, label: 'Demain' },
		{ days: 3, label: 'Dans 3 jours' },
		{ days: 7, label: 'Dans une semaine' }
	];

	async function postpone(days: number, label: string) {
		const t = task;
		if (!t) return;
		task = null;
		try {
			await store.postponeTask(t.id, days);
			ui.show(`Reportée : ${label.toLowerCase()}`, undefined, 'calendar');
		} catch (error) {
			ui.show((error as Error).message);
		}
	}
</script>

<Sheet open={task != null} title="Reporter" detent="medium" onclose={() => (task = null)}>
	<Section footer={task ? `« ${task.title} » reviendra à la date choisie. La fréquence ne change pas.` : undefined}>
		{#each choices as c (c.days)}
			<Row icon="calendar" iconColor="var(--orange)" title={c.label} value={shortDate(`${addDays(dayInParis(), c.days)}T12:00:00`)} onclick={() => postpone(c.days, c.label)} />
		{/each}
	</Section>
</Sheet>

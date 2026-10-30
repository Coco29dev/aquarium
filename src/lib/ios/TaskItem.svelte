<script lang="ts">
	import { goto } from '$app/navigation';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { relativeDay } from '$lib/ui';
	import Icon from '$lib/components/Icon.svelte';
	import SwipeRow from './SwipeRow.svelte';
	import { contextMenu } from './contextMenu';
	import type { Task } from '$lib/types';

	/**
	 * Tâche façon Rappels : rond à cocher, glisser vers la droite pour « Fait »,
	 * vers la gauche pour « Reporter » ou « Ignorer », appui long pour le menu.
	 * À placer dans un <ul class="group">.
	 */
	interface Props {
		task: Task;
		detail: string;
		late?: boolean;
		/** Nom et couleur du bac (sur les écrans qui mélangent plusieurs bacs). */
		tankName?: string;
		tankColor?: string;
		/** Ouvre la feuille « Reporter » de l'écran. */
		onpostpone: (task: Task) => void;
		/** Toucher la ligne ; sinon « Modifier » mène à l'onglet Tâches du bac. */
		onedit?: (task: Task) => void;
	}
	let { task, detail, late = false, tankName, tankColor, onpostpone, onedit }: Props = $props();

	const done = $derived(Boolean(ui.checking[task.id]));
	const toggle = () => (done ? ui.uncheck(task.id) : ui.check(task.id, task.title));
	const edit = () => (onedit ? onedit(task) : goto(`/aquariums/${task.aquariumId}/taches`));

	async function skip() {
		try {
			await store.skipTask(task.id);
			const next = store.view?.tasks.find((t) => t.id === task.id)?.nextDue;
			ui.show(next ? `Prochaine échéance : ${relativeDay(next)}` : 'Tâche ignorée cette fois', undefined, 'calendar');
		} catch (error) {
			ui.show((error as Error).message);
		}
	}
	async function tomorrow() {
		try {
			await store.postponeTask(task.id, 1);
			ui.show('Reportée à demain', undefined, 'calendar');
		} catch (error) {
			ui.show((error as Error).message);
		}
	}

	const items = $derived([
		{ label: done ? 'Annuler « Fait »' : 'Fait', icon: 'check' as const, onselect: toggle },
		{ label: 'Reporter à demain', icon: 'calendar' as const, onselect: tomorrow },
		{ label: 'Reporter…', icon: 'next' as const, onselect: () => onpostpone(task) },
		{ label: 'Ignorer cette fois', icon: 'undo' as const, onselect: skip },
		{ label: 'Modifier', icon: 'edit' as const, onselect: edit }
	]);
</script>

<SwipeRow
	leading={[{ label: done ? 'Annuler' : 'Fait', icon: done ? 'undo' : 'check', color: done ? 'var(--gray)' : 'var(--green)', onaction: toggle }]}
	trailing={[
		{ label: 'Reporter', icon: 'calendar', color: 'var(--orange)', onaction: () => onpostpone(task) },
		{ label: 'Ignorer', icon: 'undo', color: 'var(--gray)', onaction: skip }
	]}
>
	<div class="flex items-start gap-3 pl-4" use:contextMenu={{ items }}>
		<button
			class="mt-2.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-all duration-200 {done ? 'border-tint bg-tint text-white' : 'border-label3'}"
			onclick={toggle}
			aria-pressed={done}
			aria-label="{done ? 'Annuler' : 'Marquer comme fait'} : {task.title}"
		>
			{#if done}<span class="grid" style="animation: pop-in 220ms both"><Icon name="check" size={14} weight={3.2} /></span>{/if}
		</button>
		<button class="row-body min-w-0 flex-1 py-2.5 pr-4 text-left" onclick={edit}>
			<p class="body {done ? 'text-label3' : ''}">{task.title}</p>
			<p class="footnote flex items-center gap-1.5">
				{#if tankName}<span style="color: {tankColor}" class="font-semibold">{tankName}</span>{/if}
				<span class={late && !done ? 'text-red' : 'text-label2'}>{detail}</span>
			</p>
		</button>
	</div>
</SwipeRow>

<script lang="ts">
	import Icon from './Icon.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { TANK_TONE } from '$lib/ui';
	import type { Aquarium, Task } from '$lib/types';

	// Ligne de tâche : grosse case ronde à cocher, tampon « fait » à la coche, annulable.
	interface Props {
		task: Task;
		aquarium?: Aquarium;
		detail: string;
		late?: boolean;
	}
	let { task, aquarium, detail, late = false }: Props = $props();

	const done = $derived(Boolean(ui.checking[task.id]));
</script>

<li class="relative flex items-center gap-3 px-3 py-3">
	<button
		onclick={() => (done ? ui.uncheck(task.id) : ui.check(task.id, task.title))}
		class="press grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-edge shadow-[2px_2px_0_var(--shadow)] {done ? 'bg-ink text-on-ink' : 'bg-surface'}"
		aria-pressed={done}
		aria-label="{done ? 'Annuler' : 'Marquer comme fait'} : {task.title}"
	>
		{#if done}<Icon name="check" size={22} />{/if}
	</button>
	<div class="min-w-0 flex-1">
		<p class="truncate font-bold {done ? 'text-muted line-through decoration-2' : ''}">{task.title}</p>
		<p class="flex items-center gap-1.5 text-xs text-muted">
			{#if aquarium}
				<span class="h-2.5 w-2.5 shrink-0 rounded-full border border-edge" style="background: {TANK_TONE[aquarium.waterType]}"></span>
				<span class="truncate">{aquarium.name}</span>
				<span aria-hidden="true">·</span>
			{/if}
			<span class={late && !done ? 'font-bold text-bad' : ''}>{detail}</span>
		</p>
	</div>
	{#if done}
		<span class="stamp pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-md border-[2.5px] border-ok px-2 py-0.5 font-mono text-sm font-bold uppercase tracking-widest text-ok" aria-hidden="true">Fait</span>
	{/if}
</li>

<style>
	.stamp {
		animation: stamp 320ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
		translate: 0 -50%;
		transform: rotate(-8deg);
	}
</style>

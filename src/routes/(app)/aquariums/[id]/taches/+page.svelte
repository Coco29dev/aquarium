<script lang="ts">
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { dueTasks } from '$lib/domain/tasks';
	import { dayInParis } from '$lib/domain/dates';
	import { TASK_KINDS } from '$lib/templates';
	import { lateBy, relativeDay, shortDate } from '$lib/ui';
	import Icon from '$lib/components/Icon.svelte';
	import TankHeader from '$lib/components/TankHeader.svelte';
	import TaskRow from '$lib/components/TaskRow.svelte';
	import type { Task } from '$lib/types';

	const id = $derived(Number(page.params.id));
	const view = $derived(store.view);
	const aquarium = $derived(view?.aquariums.find((a) => a.id === id));
	const tasks = $derived((view?.tasks ?? []).filter((t) => t.aquariumId === id));
	const today = dayInParis();
	const due = $derived(dueTasks(tasks));
	const dueIds = $derived(new Set(due.map((t) => t.id)));
	const upcoming = $derived(
		tasks.filter((t) => t.active && !dueIds.has(t.id)).sort((a, b) => a.nextDue.localeCompare(b.nextDue))
	);
	const paused = $derived(tasks.filter((t) => !t.active));
	const history = $derived(
		(view?.completions ?? [])
			.filter((c) => tasks.some((t) => t.id === c.taskId))
			.slice(-20)
			.reverse()
	);
	const titleOf = (taskId: number) => tasks.find((t) => t.id === taskId)?.title ?? 'Tâche supprimée';
	const kindLabel = (kind: string) => TASK_KINDS.find((k) => k.value === kind)?.label ?? 'Autre';
	const every = (n: number) => (n === 1 ? 'tous les jours' : `tous les ${n} j`);

	let message = $state('');
	let editing = $state<number | null>(null);

	async function run(action: () => Promise<unknown>) {
		message = '';
		try {
			await action();
		} catch (error) {
			message = (error as Error).message;
		}
	}

	// --- Nouvelle tâche
	let kind = $state<string>(TASK_KINDS[0].value);
	let title = $state<string>(TASK_KINDS[0].label);
	let everyDays = $state<number>(TASK_KINDS[0].everyDays);
	function pickKind(k: (typeof TASK_KINDS)[number]) {
		const previous = TASK_KINDS.find((x) => x.value === kind);
		if (!title.trim() || title === previous?.label) title = k.value === 'autre' ? '' : k.label;
		kind = k.value;
		everyDays = k.everyDays;
	}
	async function addTask(event: SubmitEvent) {
		event.preventDefault();
		await run(async () => {
			await store.mutate('POST', `/api/aquariums/${id}/tasks`, { title, kind, everyDays });
			pickKind(TASK_KINDS[0]);
			title = TASK_KINDS[0].label;
		});
	}

	// --- Modification
	async function saveTask(event: SubmitEvent, taskId: number) {
		event.preventDefault();
		const f = new FormData(event.currentTarget as HTMLFormElement);
		await run(async () => {
			await store.mutate('PATCH', `/api/tasks/${taskId}`, {
				title: f.get('title'),
				everyDays: Number(f.get('everyDays')),
				nextDue: f.get('nextDue') || undefined,
				active: f.get('active') === 'on'
			});
			editing = null;
		});
	}
	async function removeTask(taskId: number, name: string) {
		if (!confirm(`Supprimer la tâche « ${name} » ?`)) return;
		await run(async () => {
			await store.mutate('DELETE', `/api/tasks/${taskId}`);
			editing = null;
		});
	}
</script>

<svelte:head><title>Tâches · {aquarium?.name ?? 'Bac'} · Bulle</title></svelte:head>

{#snippet editForm(t: Task)}
	<form onsubmit={(e) => saveTask(e, t.id)} class="flex flex-col gap-3 border-t-2 border-edge bg-surface2 p-4">
		<label class="flex flex-col gap-1 text-xs font-bold text-muted">
			Intitulé
			<input name="title" value={t.title} required class="field text-base font-normal text-ink" />
		</label>
		<div class="grid grid-cols-2 gap-3">
			<label class="flex flex-col gap-1 text-xs font-bold text-muted">
				Tous les (jours)
				<input name="everyDays" type="number" min="1" max="365" value={t.everyDays} class="field num font-normal text-ink" />
			</label>
			<label class="flex flex-col gap-1 text-xs font-bold text-muted">
				Prochaine fois
				<input name="nextDue" type="date" value={t.nextDue} class="field font-normal text-ink" />
			</label>
		</div>
		<label class="flex items-center gap-3 text-sm font-bold">
			<input name="active" type="checkbox" checked={t.active} class="h-5 w-5 accent-primary" />
			Active (décoche pour mettre en pause)
		</label>
		<div class="grid grid-cols-2 gap-3">
			<button class="btn">Enregistrer</button>
			<button type="button" onclick={() => removeTask(t.id, t.title)} class="btn-ghost text-bad">
				<Icon name="trash" size={18} />Supprimer
			</button>
		</div>
	</form>
{/snippet}

{#snippet taskLine(t: Task, muted: boolean)}
	<li>
		<button
			onclick={() => (editing = editing === t.id ? null : t.id)}
			aria-expanded={editing === t.id}
			class="flex w-full items-center gap-3 px-4 py-3 text-left"
		>
			<div class="min-w-0 flex-1">
				<p class="truncate font-bold {muted ? 'text-muted' : ''}">{t.title}</p>
				<p class="text-xs text-muted">{kindLabel(t.kind)} · {every(t.everyDays)}</p>
			</div>
			{#if !muted}
				<span class="num shrink-0 rounded-md border-[1.5px] border-edge px-2 py-0.5 text-xs">{relativeDay(t.nextDue, today)}</span>
			{:else}
				<span class="chip text-muted">En pause</span>
			{/if}
			<Icon name="edit" size={18} class="shrink-0 text-muted" />
		</button>
		{#if editing === t.id}{@render editForm(t)}{/if}
	</li>
{/snippet}

{#if !aquarium}
	<p class="hand text-lg text-muted">Ce bac n’existe pas ou plus.</p>
{:else}
	<TankHeader {aquarium} tab="taches" />

	{#if message}<p class="mb-4 rounded-lg border-2 border-bad bg-bad-soft px-3 py-2 text-sm font-bold text-bad" role="alert">{message}</p>{/if}

	<section class="rise mb-8">
		<h2 class="tape mb-3">À faire</h2>
		{#if due.length === 0}
			<div class="card-flat px-4 py-4"><p class="hand text-lg text-muted">Rien à faire pour ce bac aujourd’hui.</p></div>
		{:else}
			<ul class="card divide-y-2 divide-line">
				{#each due as task (task.id)}
					{@const late = lateBy(task, today)}
					<TaskRow {task} detail={late ? `en retard de ${late} j` : every(task.everyDays)} late={late > 0} />
				{/each}
			</ul>
		{/if}
	</section>

	{#if upcoming.length || paused.length}
		<section class="rise mb-8" style="animation-delay: 40ms">
			<h2 class="tape mb-3">Calendrier</h2>
			<ul class="card-flat divide-y-2 divide-line overflow-hidden">
				{#each upcoming as t (t.id)}{@render taskLine(t, false)}{/each}
				{#each paused as t (t.id)}{@render taskLine(t, true)}{/each}
			</ul>
			{#if due.length}
				<p class="mt-2 text-xs text-muted">Les tâches dues se modifient une fois faites, ou depuis le calendrier quand elles reviennent.</p>
			{/if}
		</section>
	{/if}

	<section class="rise mb-8" style="animation-delay: 80ms">
		<h2 class="tape mb-3">Nouvelle tâche</h2>
		<form onsubmit={addTask} class="card flex flex-col gap-4 p-4">
			<div class="flex flex-wrap gap-2" role="group" aria-label="Type de tâche">
				{#each TASK_KINDS as k (k.value)}
					<button
						type="button"
						onclick={() => pickKind(k)}
						aria-pressed={kind === k.value}
						class="rounded-full border-2 border-edge px-3 py-1.5 text-sm font-bold {kind === k.value ? 'bg-ink text-on-ink' : 'bg-surface'}"
					>
						{k.label}
					</button>
				{/each}
			</div>
			<input bind:value={title} required maxlength="100" placeholder="Intitulé" class="field" aria-label="Intitulé" />
			<div class="flex items-center justify-between gap-3">
				<span class="text-sm font-bold">Tous les</span>
				<div class="flex items-center gap-2">
					<button type="button" onclick={() => (everyDays = Math.max(1, everyDays - 1))} class="press grid h-10 w-10 place-items-center rounded-lg border-2 border-edge bg-surface2 text-lg font-bold" aria-label="Moins souvent">−</button>
					<input bind:value={everyDays} type="number" min="1" max="365" class="field num w-16 px-1 text-center" aria-label="Fréquence en jours" />
					<button type="button" onclick={() => (everyDays = Math.min(365, everyDays + 1))} class="press grid h-10 w-10 place-items-center rounded-lg border-2 border-edge bg-surface2 text-lg font-bold" aria-label="Plus espacé">+</button>
					<span class="text-sm font-bold">jours</span>
				</div>
			</div>
			<button class="btn w-full" disabled={!title.trim()}><Icon name="plus" size={18} />Ajouter</button>
		</form>
	</section>

	<section class="rise" style="animation-delay: 120ms">
		<h2 class="tape mb-3">Fait récemment</h2>
		{#if history.length === 0}
			<p class="hand text-lg text-muted">L’historique se remplit à chaque tâche cochée.</p>
		{:else}
			<ol class="relative ml-2 flex flex-col gap-3 border-l-2 border-dashed border-edge pl-5">
				{#each history as c, i (c.doneAt + c.taskId + i)}
					<li class="relative">
						<span class="absolute -left-[1.72rem] top-1 grid h-4 w-4 place-items-center rounded-full border-2 border-edge bg-ok"></span>
						<p class="text-sm font-bold">{titleOf(c.taskId)}</p>
						<p class="text-xs text-muted first-letter:uppercase">{shortDate(c.doneAt)}{c.note ? ` · ${c.note}` : ''}</p>
					</li>
				{/each}
			</ol>
		{/if}
	</section>
{/if}

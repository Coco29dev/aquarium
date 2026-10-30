<script lang="ts">
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { dueTasks } from '$lib/domain/tasks';
	import { dayInParis } from '$lib/domain/dates';
	import { TASK_KINDS } from '$lib/templates';
	import { SHORT_WATER, fmt, lateBy, relativeDay, tankAge } from '$lib/ui';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import TankTabs from '$lib/ios/TankTabs.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Sheet from '$lib/ios/Sheet.svelte';
	import FieldRow from '$lib/ios/FieldRow.svelte';
	import Stepper from '$lib/ios/Stepper.svelte';
	import Switch from '$lib/ios/Switch.svelte';
	import type { Task } from '$lib/types';

	const id = $derived(Number(page.params.id));
	const view = $derived(store.view);
	const aquarium = $derived(view?.aquariums.find((a) => a.id === id));
	const tasks = $derived((view?.tasks ?? []).filter((t) => t.aquariumId === id));
	const today = dayInParis();
	const due = $derived(dueTasks(tasks));
	const dueIds = $derived(new Set(due.map((t) => t.id)));
	const upcoming = $derived(tasks.filter((t) => t.active && !dueIds.has(t.id)).sort((a, b) => a.nextDue.localeCompare(b.nextDue)));
	const paused = $derived(tasks.filter((t) => !t.active));
	const history = $derived(
		(view?.completions ?? [])
			.filter((c) => tasks.some((t) => t.id === c.taskId))
			.slice(-15)
			.reverse()
	);
	const titleOf = (taskId: number) => tasks.find((t) => t.id === taskId)?.title ?? 'Tâche supprimée';
	const every = (n: number) => (n === 1 ? 'Tous les jours' : `Tous les ${n} jours`);

	const KIND_STYLE: Record<string, { icon: IconName; color: string }> = {
		eau: { icon: 'drop', color: 'var(--blue)' },
		filtre: { icon: 'sync', color: 'var(--teal)' },
		test: { icon: 'flask', color: 'var(--purple)' },
		dosage: { icon: 'drop', color: 'var(--orange)' },
		autre: { icon: 'calendar', color: 'var(--gray)' }
	};
	const kindStyle = (kind: string) => KIND_STYLE[kind] ?? KIND_STYLE.autre;

	async function run(action: () => Promise<unknown>): Promise<boolean> {
		try {
			await action();
			return true;
		} catch (error) {
			ui.show((error as Error).message);
			return false;
		}
	}

	// --- Nouvelle tâche
	let adding = $state(false);
	let kind = $state<string>(TASK_KINDS[0].value);
	let title = $state<string>(TASK_KINDS[0].label);
	let everyDays = $state<number>(TASK_KINDS[0].everyDays);
	function openAdd() {
		kind = TASK_KINDS[0].value;
		title = TASK_KINDS[0].label;
		everyDays = TASK_KINDS[0].everyDays;
		adding = true;
	}
	function pickKind(k: (typeof TASK_KINDS)[number]) {
		const previous = TASK_KINDS.find((x) => x.value === kind);
		if (!title.trim() || title === previous?.label) title = k.value === 'autre' ? '' : k.label;
		kind = k.value;
		everyDays = k.everyDays;
	}
	async function addTask() {
		if (!title.trim()) return;
		const ok = await run(() => store.mutate('POST', `/api/aquariums/${id}/tasks`, { title: title.trim(), kind, everyDays }));
		if (ok) {
			adding = false;
			ui.show('Tâche ajoutée', undefined, 'check');
		}
	}

	// --- Modification
	let editing = $state<Task | null>(null);
	let eTitle = $state('');
	let eEvery = $state(7);
	let eNext = $state('');
	let eActive = $state(true);
	function openEdit(t: Task) {
		editing = t;
		eTitle = t.title;
		eEvery = t.everyDays;
		eNext = t.nextDue;
		eActive = t.active;
	}
	async function saveTask() {
		if (!editing || !eTitle.trim()) return;
		const taskId = editing.id;
		const ok = await run(() =>
			store.mutate('PATCH', `/api/tasks/${taskId}`, {
				title: eTitle.trim(),
				everyDays: eEvery,
				nextDue: eNext || undefined,
				active: eActive
			})
		);
		if (ok) editing = null;
	}
	async function removeTask() {
		if (!editing) return;
		const t = editing;
		const yes = await ui.confirm({
			title: `Supprimer « ${t.title} » ?`,
			message: 'L’historique de cette tâche sera aussi supprimé.',
			confirmLabel: 'Supprimer',
			destructive: true
		});
		if (!yes) return;
		const ok = await run(() => store.mutate('DELETE', `/api/tasks/${t.id}`));
		if (ok) editing = null;
	}

	const kicker = $derived(
		aquarium
			? [SHORT_WATER[aquarium.waterType], aquarium.volumeL ? `${fmt(aquarium.volumeL, 0)} L` : null, tankAge(aquarium) != null ? `jour ${tankAge(aquarium)}` : null]
					.filter(Boolean)
					.join(' · ')
			: undefined
	);

	function dueLabel(t: Task): string {
		const late = lateBy(t, today);
		if (late) return late === 1 ? 'Hier' : `En retard de ${late} jours`;
		return "Aujourd'hui";
	}
	const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
	const doneLabel = (iso: string) => {
		const day = relativeDay(dayInParis(iso), today);
		return cap(day === "aujourd'hui" ? `aujourd’hui, ${new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}` : day);
	};
</script>

<svelte:head><title>Tâches · {aquarium?.name ?? 'Bac'} · Aquarium</title></svelte:head>

{#if !aquarium}
	<NavBar title="Tâches" back={{ href: '/aquariums', label: 'Bacs' }} large={false} />
	<p class="subhead mt-10 text-center text-label2">Ce bac n’existe pas ou plus.</p>
{:else}
	<NavBar title={aquarium.name} back={{ href: '/aquariums', label: 'Bacs' }} {kicker}>
		{#snippet trailing()}
			<button class="glass pressable grid h-9 w-9 place-items-center rounded-full text-tint" onclick={openAdd} aria-label="Nouvelle tâche">
				<Icon name="plus" size={20} weight={2.4} />
			</button>
		{/snippet}
		<TankTabs {aquarium} tab="taches" />
	</NavBar>

	<div class="mt-3"></div>

	<!-- À faire, façon Rappels -->
	<Section header="À faire" variant="title" inset={false}>
		{#if due.length === 0}
			<p class="subhead rounded-[22px] bg-bg2 px-4 py-3.5 text-label2">Rien à faire aujourd’hui pour ce bac.</p>
		{:else}
			<ul class="group task-list">
				{#each due as task (task.id)}
					{@const done = Boolean(ui.checking[task.id])}
					{@const late = lateBy(task, today) > 0}
					<li class="flex items-start gap-3 pl-4">
						<button
							class="mt-2.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-all duration-200 {done ? 'border-tint bg-tint text-white' : 'border-label3'}"
							onclick={() => (done ? ui.uncheck(task.id) : ui.check(task.id, task.title))}
							aria-pressed={done}
							aria-label="{done ? 'Annuler' : 'Marquer comme fait'} : {task.title}"
						>
							{#if done}<span class="grid" style="animation: pop-in 220ms both"><Icon name="check" size={14} weight={3.2} /></span>{/if}
						</button>
						<button class="row-body min-w-0 flex-1 py-2.5 pr-4 text-left" onclick={() => openEdit(task)}>
							<p class="body {done ? 'text-label3' : ''}">{task.title}</p>
							<p class="footnote {late && !done ? 'text-red' : 'text-label2'}">{dueLabel(task)} · {every(task.everyDays).toLowerCase()}</p>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</Section>

	{#if upcoming.length}
		<Section header="Prochainement">
			{#each upcoming as t (t.id)}
				{@const k = kindStyle(t.kind)}
				<Row icon={k.icon} iconColor={k.color} title={t.title} subtitle={every(t.everyDays)} value={cap(relativeDay(t.nextDue, today))} onclick={() => openEdit(t)} chevron />
			{/each}
		</Section>
	{/if}

	{#if paused.length}
		<Section header="En pause" footer="Une tâche en pause n’apparaît plus dans À faire et n’envoie pas de rappel.">
			{#each paused as t (t.id)}
				<Row icon="calendar" iconColor="var(--gray)" title={t.title} subtitle={every(t.everyDays)} onclick={() => openEdit(t)} chevron />
			{/each}
		</Section>
	{/if}

	<Section>
		<Row icon="plus" iconColor="var(--blue)" title="Nouvelle tâche" onclick={openAdd} />
	</Section>

	{#if history.length}
		<Section header="Fait récemment">
			{#each history as c (c.doneAt + c.taskId)}
				<Row title={titleOf(c.taskId)} value={doneLabel(c.doneAt)}>
					{#snippet leading()}
						<span class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-green text-white"><Icon name="check" size={14} weight={3} /></span>
					{/snippet}
				</Row>
			{/each}
		</Section>
	{/if}

	<!-- Nouvelle tâche -->
	<Sheet open={adding} title="Nouvelle tâche" onclose={() => (adding = false)} action={{ label: 'Ajouter', onclick: addTask, disabled: !title.trim() }}>
		<Section>
			<FieldRow id="new-title" label="Intitulé" placeholder="Intitulé" bind:value={title} wide required />
		</Section>
		<Section header="Type">
			{#each TASK_KINDS as k (k.value)}
				{@const s = kindStyle(k.value)}
				<Row icon={s.icon} iconColor={s.color} title={k.label} onclick={() => pickKind(k)}>
					{#snippet trailing()}
						{#if kind === k.value}<span class="text-tint"><Icon name="check" size={20} weight={2.6} /></span>{/if}
					{/snippet}
				</Row>
			{/each}
		</Section>
		<Section header="Fréquence" footer="La prochaine échéance est comptée à partir du jour où tu la coches.">
			<Row title={every(everyDays)}>
				{#snippet trailing()}<Stepper bind:value={everyDays} label="Fréquence en jours" />{/snippet}
			</Row>
		</Section>
	</Sheet>

	<!-- Modification -->
	<Sheet open={editing != null} title="Tâche" onclose={() => (editing = null)} action={{ label: 'OK', onclick: saveTask, disabled: !eTitle.trim() }}>
		<Section>
			<FieldRow id="edit-title" label="Intitulé" placeholder="Intitulé" bind:value={eTitle} wide required />
		</Section>
		<Section header="Planification">
			<Row title={every(eEvery)}>
				{#snippet trailing()}<Stepper bind:value={eEvery} label="Fréquence en jours" />{/snippet}
			</Row>
			<FieldRow id="edit-next" label="Prochaine fois" type="date" bind:value={eNext} />
			<li class="pl-4">
				<label class="row-body flex min-h-11 items-center gap-3 pr-4">
					<span class="body flex-1">Active</span>
					<Switch bind:checked={eActive} />
				</label>
			</li>
		</Section>
		<Section>
			<Row title="Supprimer la tâche" destructive onclick={removeTask} />
		</Section>
	</Sheet>
{/if}

<style>
	.task-list > li + li .row-body {
		box-shadow: inset 0 0.5px 0 var(--sep);
	}
</style>

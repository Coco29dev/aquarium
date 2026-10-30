<script lang="ts">
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { collectAlerts } from '$lib/domain/drift';
	import { addDays, dayInParis } from '$lib/domain/dates';
	import { consumableLife } from '$lib/domain/consumables';
	import { tankHealth } from '$lib/tank';
	import { TANK_TONE, lateBy } from '$lib/ui';
	import Icon from '$lib/components/Icon.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import Sparkline from '$lib/components/Sparkline.svelte';
	import TankCard from '$lib/components/TankCard.svelte';
	import TaskRow from '$lib/components/TaskRow.svelte';
	import type { Task } from '$lib/types';

	const view = $derived(store.view);
	const today = dayInParis();
	const aquariums = $derived(view?.aquariums ?? []);
	const tankOf = (id: number) => aquariums.find((a) => a.id === id);
	const health = $derived(view ? aquariums.map((a) => ({ aquarium: a, health: tankHealth(view, a) })) : []);

	// Semaine glissante : aujourd'hui (avec les retards) puis les 6 jours suivants.
	const week = $derived(
		Array.from({ length: 7 }, (_, i) => {
			const day = addDays(today, i);
			const tasks = (view?.tasks ?? []).filter((t) => t.active && (i === 0 ? t.nextDue <= day : t.nextDue === day));
			const date = new Date(`${day}T12:00:00`);
			return {
				day,
				tasks,
				weekday: i === 0 ? 'Auj.' : date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''),
				num: date.getDate()
			};
		})
	);
	let selectedDay = $state(today);
	const selected = $derived(week.find((d) => d.day === selectedDay) ?? week[0]);
	const sortedTasks = $derived([...selected.tasks].sort((a, b) => a.nextDue.localeCompare(b.nextDue)));

	const doneToday = $derived(
		(view?.completions ?? [])
			.filter((c) => dayInParis(c.doneAt) === today)
			.map((c) => ({ c, task: view?.tasks.find((t) => t.id === c.taskId) }))
			.filter((x): x is { c: typeof x.c; task: Task } => Boolean(x.task))
			.reverse()
	);

	const alerts = $derived(view ? collectAlerts(view.parameters, view.measurements) : []);
	const paramOf = (id: number) => view?.parameters.find((p) => p.id === id);
	const pointsOf = (id: number) =>
		(view?.measurements ?? [])
			.filter((m) => m.parameterId === id)
			.slice(-12)
			.map((m) => ({ t: new Date(m.measuredAt).getTime(), v: m.value }));

	const coaches = $derived(health.filter((h) => h.health.coach));

	const consumablesDue = $derived(
		(view?.consumables ?? [])
			.map((c) => ({ c, life: consumableLife(c, c.history, today) }))
			.filter((x) => x.life.status === 'en_retard' || x.life.status === 'bientot')
			.sort((a, b) => (a.life.daysLeft ?? 0) - (b.life.daysLeft ?? 0))
	);

	const todoCount = $derived(week[0].tasks.filter((t) => !ui.checking[t.id]).length);
	const summary = $derived.by(() => {
		const parts: string[] = [];
		if (todoCount) parts.push(`${todoCount} chose${todoCount > 1 ? 's' : ''} à faire`);
		if (alerts.length) parts.push(`${alerts.length} valeur${alerts.length > 1 ? 's' : ''} à surveiller`);
		return parts.length ? parts.join(', ') + '.' : 'Rien d’urgent. Profite de tes bacs.';
	});

	const longDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });

	function taskDetail(t: Task): { text: string; late: boolean } {
		const late = lateBy(t, today);
		if (late) return { text: `en retard de ${late} j`, late: true };
		return { text: t.everyDays === 1 ? 'tous les jours' : `tous les ${t.everyDays} j`, late: false };
	}

	const stageIndex = { demarrage: 0, pic_nitrites: 1, finalisation: 2, pret: 3, aucune_mesure: -1 } as const;
	const stages = ['Ammoniac', 'Nitrites', 'Nitrates'];
</script>

<svelte:head><title>Aujourd'hui · Bulle</title></svelte:head>

<header class="rise mb-6">
	<div class="mb-4 flex items-center justify-between">
		<p class="num text-xs uppercase tracking-wider text-muted">{longDate}</p>
		<Logo size={40} />
	</div>
	<h1 class="display text-[2.6rem]">Aujourd’hui</h1>
	<p class="hand mt-2 text-xl leading-snug text-muted">{summary}</p>
</header>

{#if view && aquariums.length === 0}
	<section class="card rise flex flex-col items-start gap-4 p-5">
		<Logo size={72} />
		<h2 class="display text-2xl">Ton premier bac</h2>
		<p class="text-sm text-muted">
			Donne-lui un nom et un type d'eau : je prépare les paramètres à suivre et leurs plages, tu pourras tout ajuster.
		</p>
		<a href="/aquariums/nouveau" class="btn">Créer un bac</a>
	</section>
{:else}
	<!-- Bacs -->
	<section class="rise -mx-5 mb-8" style="animation-delay: 40ms">
		<div class="flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-3 pt-1" style="scrollbar-width: none">
			{#each health as { aquarium, health: h } (aquarium.id)}
				<div class="snap-start"><TankCard {aquarium} health={h} compact /></div>
			{/each}
			<a href="/aquariums/nouveau" class="press flex w-24 shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-[0.875rem] border-2 border-dashed border-edge text-xs font-bold text-muted">
				<Icon name="plus" size={22} />Nouveau bac
			</a>
		</div>
	</section>

	<!-- Planning de la semaine -->
	<section class="rise mb-8" style="animation-delay: 80ms">
		<div class="mb-3 flex items-baseline justify-between">
			<h2 class="tape">À faire</h2>
		</div>
		<div class="mb-3 grid grid-cols-7 gap-1.5" role="tablist" aria-label="Jours de la semaine">
			{#each week as d (d.day)}
				{@const on = d.day === selectedDay}
				<button
					role="tab"
					aria-selected={on}
					onclick={() => (selectedDay = d.day)}
					class="flex flex-col items-center gap-0.5 rounded-lg border-2 py-1.5 {on ? 'border-edge bg-ink text-on-ink' : 'border-transparent'}"
				>
					<span class="text-[10px] font-bold uppercase {on ? '' : 'text-muted'}">{d.weekday}</span>
					<span class="num text-base">{d.num}</span>
					<span class="flex h-1.5 gap-0.5">
						{#each d.tasks.slice(0, 3) as t (t.id)}
							<span class="h-1.5 w-1.5 rounded-full {on ? 'bg-sun' : t.nextDue < today ? 'bg-bad' : 'bg-ink'}"></span>
						{/each}
					</span>
				</button>
			{/each}
		</div>

		{#if sortedTasks.length === 0}
			<div class="card-flat flex items-center gap-3 px-4 py-4">
				<span class="text-2xl" aria-hidden="true">〰</span>
				<p class="hand text-lg text-muted">
					{selectedDay === today ? 'Rien à faire aujourd’hui.' : 'Rien de prévu ce jour-là.'}
				</p>
			</div>
		{:else}
			<ul class="card divide-y-2 divide-line">
				{#each sortedTasks as task (task.id)}
					{@const d = taskDetail(task)}
					<TaskRow {task} aquarium={tankOf(task.aquariumId)} detail={d.text} late={d.late} />
				{/each}
			</ul>
		{/if}

		{#if selectedDay === today && doneToday.length}
			<div class="mt-4">
				<p class="num mb-2 text-[11px] uppercase tracking-wider text-muted">Déjà fait aujourd’hui</p>
				<ul class="flex flex-col gap-1.5">
					{#each doneToday as { c, task } (c.doneAt + task.id)}
						<li class="flex items-center gap-2 text-sm text-muted">
							<span class="grid h-5 w-5 place-items-center rounded-full bg-ok text-surface"><Icon name="check" size={13} /></span>
							<span class="line-through decoration-2">{task.title}</span>
							<span class="num ml-auto text-xs">{new Date(c.doneAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</section>

	<!-- Alertes -->
	{#if alerts.length}
		<section class="rise mb-8" style="animation-delay: 120ms">
			<h2 class="tape mb-3">À surveiller</h2>
			<ul class="flex flex-col gap-3">
				{#each alerts as alert (alert.parameterId)}
					{@const p = paramOf(alert.parameterId)}
					{@const tank = tankOf(alert.aquariumId)}
					{@const bad = alert.level === 'hors_plage'}
					<li class="card overflow-hidden">
						<a href="/aquariums/{alert.aquariumId}/parametre/{alert.parameterId}" class="flex items-center gap-3 p-4">
							<div class="min-w-0 flex-1">
								<p class="mb-1.5 flex items-center gap-2">
									<span class="chip {bad ? 'bg-bad-soft text-bad' : 'bg-warn-soft text-warn'}">
										<Icon name="alert" size={12} />{bad ? 'Hors plage' : 'Dérive'}
									</span>
									{#if tank}<span class="truncate text-xs text-muted">{tank.name}</span>{/if}
								</p>
								<p class="font-bold leading-snug">{alert.message}</p>
							</div>
							{#if p}
								<Sparkline points={pointsOf(p.id)} min={p.min} max={p.max} tone={bad ? 'var(--bad)' : 'var(--warn)'} />
							{/if}
						</a>
						<a
							href="/mesurer?bac={alert.aquariumId}"
							class="flex items-center justify-center gap-2 border-t-2 border-edge py-2.5 text-sm font-bold active:bg-surface2"
						>
							<Icon name="drop" size={16} />Refaire une mesure
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Coach de cyclage -->
	{#each coaches as { aquarium, health: h } (aquarium.id)}
		{@const at = stageIndex[h.coach?.stage ?? 'aucune_mesure']}
		<section class="rise mb-8" style="animation-delay: 160ms">
			<h2 class="tape mb-3">Cyclage · {aquarium.name}</h2>
			<a href="/aquariums/{aquarium.id}" class="card press block overflow-hidden">
				<div class="grid grid-cols-3 border-b-2 border-edge" style="background: {TANK_TONE[aquarium.waterType]}">
					{#each stages as s, i (s)}
						<div class="flex flex-col items-center gap-1 px-1 py-3 text-center {i < 2 ? 'border-r-2 border-edge' : ''}">
							<span class="grid h-7 w-7 place-items-center rounded-full border-2 border-edge {i < at ? 'bg-ink text-on-ink' : i === at ? 'bg-sun' : 'bg-surface'}">
								{#if i < at}<Icon name="check" size={15} />{:else}<span class="num text-xs">{i + 1}</span>{/if}
							</span>
							<span class="text-xs font-bold">{s}</span>
						</div>
					{/each}
				</div>
				<div class="p-4">
					<p class="display mb-1 text-xl first-letter:uppercase">{h.coach?.title.replace('Cyclage : ', '')}</p>
					<p class="hand text-lg leading-snug text-muted">{h.coach?.advice}</p>
				</div>
			</a>
		</section>
	{/each}

	<!-- Consommables -->
	{#if consumablesDue.length}
		<section class="rise mb-8" style="animation-delay: 200ms">
			<h2 class="tape mb-3">À remplacer</h2>
			<ul class="card divide-y-2 divide-line">
				{#each consumablesDue as { c, life } (c.id)}
					<li>
						<a href="/aquariums/{c.aquariumId}/inventaire" class="flex items-center gap-3 px-4 py-3">
							<Icon name="box" size={22} />
							<div class="min-w-0 flex-1">
								<p class="truncate font-bold">{c.name}</p>
								<p class="text-xs text-muted">{tankOf(c.aquariumId)?.name}</p>
							</div>
							<span class="chip {life.status === 'en_retard' ? 'bg-bad-soft text-bad' : 'bg-warn-soft text-warn'}">
								{life.daysLeft! < 0 ? `+${-life.daysLeft!} j` : `${life.daysLeft} j`}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
{/if}

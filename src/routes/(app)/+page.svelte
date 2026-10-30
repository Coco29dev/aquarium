<script lang="ts">
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { collectAlerts } from '$lib/domain/drift';
	import { addDays, dayInParis } from '$lib/domain/dates';
	import { consumableLife } from '$lib/domain/consumables';
	import { tankHealth } from '$lib/tank';
	import { SHORT_WATER, TANK_ICON, TANK_TONE, fmt, lateBy } from '$lib/ui';
	import Icon from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Spark from '$lib/ios/Spark.svelte';
	import type { Task } from '$lib/types';

	const view = $derived(store.view);
	const today = dayInParis();
	const aquariums = $derived(view?.aquariums ?? []);
	const tankOf = (id: number) => aquariums.find((a) => a.id === id);
	const health = $derived(view ? aquariums.map((a) => ({ aquarium: a, health: tankHealth(view, a) })) : []);

	// Bandeau de semaine façon Calendrier : aujourd'hui (avec les retards) puis 6 jours.
	const week = $derived(
		Array.from({ length: 7 }, (_, i) => {
			const day = addDays(today, i);
			const tasks = (view?.tasks ?? []).filter((t) => t.active && (i === 0 ? t.nextDue <= day : t.nextDue === day));
			const date = new Date(`${day}T12:00:00`);
			return {
				day,
				tasks,
				letter: date.toLocaleDateString('fr-FR', { weekday: 'narrow' }),
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
	const pointsOf = (id: number, n = 14) =>
		(view?.measurements ?? [])
			.filter((m) => m.parameterId === id)
			.slice(-n)
			.map((m) => ({ t: new Date(m.measuredAt).getTime(), v: m.value }));
	const lastOf = (id: number) => {
		const list = (view?.measurements ?? []).filter((m) => m.parameterId === id);
		return list.length ? list[list.length - 1] : null;
	};
	/** Paramètres vedettes d'un bac pour sa carte : température puis nitrates. */
	const featured = (aquariumId: number) =>
		['temp', 'no3']
			.map((k) => view?.parameters.find((p) => p.aquariumId === aquariumId && p.key === k))
			.filter((p): p is NonNullable<typeof p> => Boolean(p));

	const consumablesDue = $derived(
		(view?.consumables ?? [])
			.map((c) => ({ c, life: consumableLife(c, c.history, today) }))
			.filter((x) => x.life.status === 'en_retard' || x.life.status === 'bientot')
			.sort((a, b) => (a.life.daysLeft ?? 0) - (b.life.daysLeft ?? 0))
	);

	const kicker = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });

	function taskDetail(t: Task): { text: string; late: boolean } {
		const late = lateBy(t, today);
		if (late) return { text: late === 1 ? 'Hier' : `En retard de ${late} jours`, late: true };
		return { text: t.everyDays === 1 ? 'Tous les jours' : `Tous les ${t.everyDays} jours`, late: false };
	}

	const stageIndex = { demarrage: 0, pic_nitrites: 1, finalisation: 2, pret: 3, aucune_mesure: -1 } as const;
	const stages = ['Ammoniac', 'Nitrites', 'Nitrates'];
</script>

<svelte:head><title>Aujourd'hui · Aquarium</title></svelte:head>

<NavBar title="Aujourd’hui" {kicker} />

{#if view && aquariums.length === 0}
	<div class="mt-16 flex flex-col items-center px-6 text-center">
		<span class="mb-4 grid h-20 w-20 place-items-center rounded-[22px] bg-gradient-to-b from-cyan to-blue text-white shadow-lg" style="--cut: var(--blue)">
			<Icon name="fish" size={44} filled weight={1.6} />
		</span>
		<h2 class="title2">Aucun bac pour l’instant</h2>
		<p class="subhead mt-1.5 text-label2">Ajoute ton premier aquarium : je prépare les paramètres à suivre et leurs plages.</p>
		<a href="/aquariums/nouveau" class="btn-filled mt-6">Ajouter un bac</a>
	</div>
{:else}
	<!-- Cartes des bacs, façon widgets -->
	<div class="-mx-4 mb-8 mt-2 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1" style="scrollbar-width: none">
		{#each health as { aquarium, health: h } (aquarium.id)}
			{@const tone = TANK_TONE[aquarium.waterType]}
			<a href="/aquariums/{aquarium.id}" class="pressable flex w-[78%] max-w-72 shrink-0 snap-start flex-col rounded-[22px] bg-bg2 p-4">
				<div class="flex items-center gap-2" style="color: {tone}">
					<Icon name={TANK_ICON[aquarium.waterType]} size={20} filled weight={1.6} />
					<span class="headline min-w-0 flex-1 truncate">{aquarium.name}</span>
					<span class="text-label3"><Icon name="next" size={16} weight={2.4} /></span>
				</div>
				<p class="footnote mt-0.5 text-label2">
					{SHORT_WATER[aquarium.waterType]}{aquarium.volumeL ? ` · ${fmt(aquarium.volumeL, 0)} L` : ''}
				</p>
				<div class="mt-4 flex gap-6">
					{#each featured(aquarium.id) as p (p.id)}
						{@const last = lastOf(p.id)}
						<div>
							<p class="caption1 font-semibold text-label2">{p.key === 'temp' ? 'Température' : 'Nitrates'}</p>
							<p class="rounded-num">
								<span class="text-[28px] font-semibold leading-8">{last ? fmt(last.value, p.decimals) : '–'}</span>
								<span class="subhead font-semibold text-label2">{p.unit}</span>
							</p>
						</div>
					{/each}
				</div>
				<p class="footnote mt-3 flex items-center gap-1.5 font-semibold {h.level === 'bad' ? 'text-red' : h.level === 'warn' ? 'text-orange' : h.level === 'cycle' ? 'text-indigo' : 'text-green'}">
					<Icon name={h.level === 'ok' ? 'check' : h.level === 'cycle' ? 'cycle' : 'alert'} size={15} weight={2.6} />
					{h.label}
				</p>
			</a>
		{/each}
	</div>

	<!-- À faire, façon Rappels -->
	<section class="mb-8">
		<div class="mb-2 flex items-baseline justify-between px-1">
			<h2 class="title3 font-bold">À faire</h2>
		</div>
		<div class="group mb-2.5 grid grid-cols-7 px-1.5 py-2" role="tablist" aria-label="Jours de la semaine">
			{#each week as d, i (d.day)}
				{@const on = d.day === selectedDay}
				<button role="tab" aria-selected={on} onclick={() => (selectedDay = d.day)} class="flex flex-col items-center gap-1">
					<span class="caption2 font-semibold uppercase text-label2">{d.letter}</span>
					<span
						class="rounded-num grid h-9 w-9 place-items-center rounded-full text-[19px] transition-colors {on ? (i === 0 ? 'bg-red text-white' : 'bg-label text-bg2') : i === 0 ? 'font-semibold text-red' : ''}"
					>
						{d.num}
					</span>
					<span class="flex h-1.5 gap-[3px]">
						{#each d.tasks.slice(0, 3) as t (t.id)}
							<span class="h-[5px] w-[5px] rounded-full {t.nextDue < today ? 'bg-red' : 'bg-label3'}"></span>
						{/each}
					</span>
				</button>
			{/each}
		</div>

		{#if sortedTasks.length === 0}
			<p class="group subhead px-4 py-3.5 text-label2">
				{selectedDay === today ? 'Rien à faire aujourd’hui.' : 'Rien de prévu ce jour-là.'}
			</p>
		{:else}
			<ul class="group ios-tasks">
				{#each sortedTasks as task (task.id)}
					{@const d = taskDetail(task)}
					{@const tank = tankOf(task.aquariumId)}
					{@const done = Boolean(ui.checking[task.id])}
					<li class="flex items-start gap-3 pl-4">
						<button
							class="mt-2.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-all duration-200 {done ? 'border-tint bg-tint text-white' : 'border-label3'}"
							onclick={() => (done ? ui.uncheck(task.id) : ui.check(task.id, task.title))}
							aria-pressed={done}
							aria-label="{done ? 'Annuler' : 'Marquer comme fait'} : {task.title}"
						>
							{#if done}<span class="grid" style="animation: pop-in 220ms both"><Icon name="check" size={14} weight={3.2} /></span>{/if}
						</button>
						<div class="row-body min-w-0 flex-1 py-2.5 pr-4">
							<p class="body {done ? 'text-label3' : ''}">{task.title}</p>
							<p class="footnote flex items-center gap-1.5">
								{#if tank}<span style="color: {TANK_TONE[tank.waterType]}" class="font-semibold">{tank.name}</span>{/if}
								<span class={d.late && !done ? 'text-red' : 'text-label2'}>{d.text}</span>
							</p>
						</div>
					</li>
				{/each}
			</ul>
		{/if}

		{#if selectedDay === today && doneToday.length}
			<p class="footnote mt-2 px-4 text-label2">
				Fait aujourd’hui : {doneToday.map((d) => d.task.title).join(', ')}.
			</p>
		{/if}
	</section>

	<!-- À surveiller, façon « Points forts » de Santé -->
	{#if alerts.length}
		<Section header="À surveiller" variant="title" inset={false}>
			<div class="flex flex-col gap-2.5">
				{#each alerts as alert (alert.parameterId)}
					{@const p = paramOf(alert.parameterId)}
					{@const tank = tankOf(alert.aquariumId)}
					{@const bad = alert.level === 'hors_plage'}
					<a href="/aquariums/{alert.aquariumId}/parametre/{alert.parameterId}" class="pressable group block p-4">
						<div class="mb-2 flex items-center gap-1.5 {bad ? 'text-red' : 'text-orange'}" style="--cut: var(--bg2)">
							<Icon name="alert" size={17} filled weight={1.8} />
							<span class="subhead flex-1 font-semibold">{p?.name ?? 'Paramètre'}</span>
							<span class="footnote text-label2">{tank?.name}</span>
							<span class="text-label3"><Icon name="next" size={15} weight={2.4} /></span>
						</div>
						<div class="flex items-end gap-4">
							<p class="body min-w-0 flex-1 font-semibold">{alert.message}</p>
							{#if p}<Spark points={pointsOf(p.id)} min={p.min} max={p.max} color={bad ? 'var(--red)' : 'var(--orange)'} />{/if}
						</div>
					</a>
				{/each}
			</div>
		</Section>
	{/if}

	<!-- Coach de cyclage -->
	{#each health.filter((h) => h.health.coach) as { aquarium, health: h } (aquarium.id)}
		{@const at = stageIndex[h.coach?.stage ?? 'aucune_mesure']}
		<Section header="Cyclage" variant="title" inset={false}>
			<a href="/aquariums/{aquarium.id}" class="pressable group block p-4">
				<div class="mb-3 flex items-center gap-1.5 text-indigo">
					<Icon name="cycle" size={17} weight={2} />
					<span class="subhead flex-1 font-semibold">{aquarium.name}</span>
					<span class="text-label3"><Icon name="next" size={15} weight={2.4} /></span>
				</div>
				<div class="mb-3 grid grid-cols-3 gap-1.5">
					{#each stages as s, i (s)}
						<div>
							<div class="mb-1 h-1.5 rounded-full {i < at ? 'bg-indigo' : i === at ? 'bg-indigo/40' : 'bg-fill'}"></div>
							<p class="caption1 font-semibold {i <= at ? 'text-label' : 'text-label3'}">{s}</p>
						</div>
					{/each}
				</div>
				<p class="headline">{h.coach?.title.replace('Cyclage : ', '').replace(/^./, (c) => c.toUpperCase())}</p>
				<p class="subhead mt-0.5 text-label2">{h.coach?.advice}</p>
			</a>
		</Section>
	{/each}

	<!-- Consommables -->
	{#if consumablesDue.length}
		<Section header="À remplacer" variant="title">
			{#each consumablesDue as { c, life } (c.id)}
				<Row href="/aquariums/{c.aquariumId}/inventaire" icon="box" iconColor="var(--brown)" title={c.name} subtitle={tankOf(c.aquariumId)?.name}>
					{#snippet trailing()}
						<span class="subhead font-semibold {life.status === 'en_retard' ? 'text-red' : 'text-orange'}">
							{life.daysLeft! < 0 ? `+${-life.daysLeft!} j` : `${life.daysLeft} j`}
						</span>
					{/snippet}
				</Row>
			{/each}
		</Section>
	{/if}
{/if}

<style>
	.ios-tasks > li + li .row-body {
		box-shadow: inset 0 0.5px 0 var(--sep);
	}
</style>

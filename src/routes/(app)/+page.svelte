<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { collectTankAlerts } from '$lib/domain/drift';
	import { addDays, dayInParis } from '$lib/domain/dates';
	import { consumableLife } from '$lib/domain/consumables';
	import { tankHealth } from '$lib/tank';
	import { SHORT_WATER, TANK_ICON, TANK_TONE, fmt, lateBy } from '$lib/ui';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Spark from '$lib/ios/Spark.svelte';
	import SearchButton from '$lib/ios/SearchButton.svelte';
	import TaskItem from '$lib/ios/TaskItem.svelte';
	import PostponeSheet from '$lib/ios/PostponeSheet.svelte';
	import { contextMenu } from '$lib/ios/contextMenu';
	import type { Aquarium, Task } from '$lib/types';

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

	/** Réalisations du jour, y compris celles cochées hors ligne et pas encore envoyées. */
	const doneToday = $derived(
		(view?.completions ?? [])
			.filter((c) => dayInParis(c.doneAt) === today)
			.map((c) => ({
				c,
				task: view?.tasks.find((t) => t.id === c.taskId),
				pending: store.pending.some((op) => op.type === 'completion' && op.taskId === c.taskId && op.doneAt === c.doneAt)
			}))
			.filter((x): x is { c: typeof x.c; task: Task; pending: boolean } => Boolean(x.task))
			.reverse()
	);

	const alerts = $derived(view ? collectTankAlerts(view) : []);
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
	const coaches = $derived(health.filter((h) => h.health.coach));
	const lateTasks = $derived(week[0].tasks.filter((t) => lateBy(t, today) > 0 && !ui.checking[t.id]));

	// Carte de synthèse : une ligne par chose qui demande de l'attention, la plus grave d'abord.
	interface Attention {
		key: string;
		icon: IconName;
		color: string;
		text: string;
		detail?: string;
		href: string;
	}
	const attention = $derived.by<Attention[]>(() => {
		const list: Attention[] = [];
		for (const a of alerts) {
			const bad = a.level === 'hors_plage';
			list.push({
				key: `a${a.parameterId}`,
				icon: 'alert',
				color: bad ? 'var(--red)' : 'var(--orange)',
				text: a.message,
				detail: tankOf(a.aquariumId)?.name,
				href: `/aquariums/${a.aquariumId}/parametre/${a.parameterId}`
			});
		}
		for (const t of lateTasks) {
			const late = lateBy(t, today);
			list.push({
				key: `t${t.id}`,
				icon: 'calendar',
				color: 'var(--red)',
				text: `${t.title} : en retard de ${late} jour${late > 1 ? 's' : ''}`,
				detail: tankOf(t.aquariumId)?.name,
				href: `/aquariums/${t.aquariumId}/taches`
			});
		}
		for (const { aquarium, health: h } of coaches) {
			list.push({
				key: `c${aquarium.id}`,
				icon: 'cycle',
				color: 'var(--indigo)',
				text: `Cyclage : ${(h.coach?.title ?? '').replace('Cyclage : ', '')}`,
				detail: aquarium.name,
				href: `/aquariums/${aquarium.id}`
			});
		}
		for (const { c } of consumablesDue.filter((x) => x.life.status === 'en_retard')) {
			list.push({
				key: `k${c.id}`,
				icon: 'box',
				color: 'var(--brown)',
				text: `${c.name} à remplacer`,
				detail: tankOf(c.aquariumId)?.name,
				href: `/aquariums/${c.aquariumId}/inventaire`
			});
		}
		return list;
	});

	// Sections de détail repliables ; l'état est mémorisé sur l'appareil.
	type Fold = 'surveiller' | 'cyclage' | 'remplacer';
	let open = $state<Record<Fold, boolean>>({ surveiller: false, cyclage: false, remplacer: false });
	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem('today-open') ?? '{}');
			open = { ...open, ...saved };
		} catch {
			// Stockage indisponible : tout reste replié.
		}
	});
	function toggleFold(k: Fold) {
		open = { ...open, [k]: !open[k] };
		try {
			localStorage.setItem('today-open', JSON.stringify(open));
		} catch {
			// Sans stockage, l'état ne survit pas à la fermeture : sans gravité.
		}
	}

	let postponing = $state<Task | null>(null);

	const kicker = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });

	function taskDetail(t: Task): { text: string; late: boolean } {
		const late = lateBy(t, today);
		if (late) return { text: late === 1 ? 'Hier' : `En retard de ${late} jours`, late: true };
		return { text: t.everyDays === 1 ? 'Tous les jours' : `Tous les ${t.everyDays} jours`, late: false };
	}

	const tankMenu = (a: Aquarium) => ({
		items: [
			{ label: 'Ouvrir', icon: 'bacs' as const, onselect: () => goto(`/aquariums/${a.id}`) },
			{ label: 'Saisir des mesures', icon: 'drop' as const, onselect: () => goto(`/mesurer?bac=${a.id}`) },
			{ label: 'Journal', icon: 'note' as const, onselect: () => goto(`/aquariums/${a.id}/journal`) },
			{ label: 'Réglages', icon: 'gear' as const, onselect: () => goto(`/aquariums/${a.id}/reglages`) }
		]
	});

	const stageIndex = { demarrage: 0, pic_nitrites: 1, finalisation: 2, pret: 3, aucune_mesure: -1 } as const;
	const stages = ['Ammoniac', 'Nitrites', 'Nitrates'];
</script>

<svelte:head><title>Aujourd'hui · Aquarium</title></svelte:head>

<NavBar title="Aujourd’hui" {kicker}>
	{#snippet trailing()}<SearchButton />{/snippet}
</NavBar>

{#snippet foldHeader(k: Fold, title: string, count: number)}
	<button class="mb-2 flex w-full items-center gap-2 px-1 text-left" onclick={() => toggleFold(k)} aria-expanded={open[k]}>
		<h2 class="title3 flex-1 font-bold">{title}</h2>
		<span class="subhead text-label2">{count}</span>
		<span class="text-label3 transition-transform duration-300 {open[k] ? 'rotate-90' : ''}"><Icon name="next" size={17} weight={2.6} /></span>
	</button>
{/snippet}

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
	<!-- Synthèse : tout va bien, ou ce qui demande de l'attention -->
	<section class="group mb-6 mt-2">
		{#if attention.length === 0}
			<div class="flex items-center gap-3 p-4">
				<span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-green text-white"><Icon name="check" size={22} weight={3} /></span>
				<div class="min-w-0">
					<p class="headline">Tout va bien</p>
					<p class="subhead text-label2">Aucune valeur hors plage, rien en retard.</p>
				</div>
			</div>
		{:else}
			<div class="flex items-center gap-3 px-4 pb-2 pt-4">
				<span class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white {attention.some((a) => a.color === 'var(--red)') ? 'bg-red' : 'bg-orange'}" style="--cut: transparent">
					<Icon name="alert" size={21} weight={2.4} />
				</span>
				<p class="headline min-w-0 flex-1">
					{attention.length === 1 ? 'Une chose demande ton attention' : `${attention.length} choses demandent ton attention`}
				</p>
			</div>
			<ul class="attention">
				{#each attention as a (a.key)}
					<li>
						<a href={a.href} class="tappable flex items-center gap-3 pl-4">
							<span class="w-[30px] shrink-0 text-center" style="color: {a.color}; --cut: var(--bg2)"><Icon name={a.icon} size={19} filled weight={1.8} /></span>
							<div class="row-body flex min-h-11 min-w-0 flex-1 items-center gap-2 py-2 pr-4">
								<p class="subhead min-w-0 flex-1">{a.text}</p>
								{#if a.detail}<span class="footnote shrink-0 text-label2">{a.detail}</span>{/if}
								<span class="shrink-0 text-label3"><Icon name="next" size={15} weight={2.4} /></span>
							</div>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- Cartes des bacs, façon widgets -->
	<div class="-mx-4 mb-8 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1" style="scrollbar-width: none">
		{#each health as { aquarium, health: h } (aquarium.id)}
			{@const tone = TANK_TONE[aquarium.waterType]}
			<a
				href="/aquariums/{aquarium.id}"
				class="pressable flex w-[78%] max-w-72 shrink-0 snap-start flex-col rounded-[22px] bg-bg2 p-4"
				use:contextMenu={tankMenu(aquarium)}
			>
				<div class="flex items-center gap-2" style="color: {tone}; --cut: var(--bg2)">
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
					<TaskItem
						{task}
						detail={d.text}
						late={d.late}
						tankName={tank?.name}
						tankColor={tank ? TANK_TONE[tank.waterType] : undefined}
						onpostpone={(t) => (postponing = t)}
					/>
				{/each}
			</ul>
			<p class="footnote mt-2 px-4 text-label2">Glisse une tâche vers la droite pour la cocher, vers la gauche pour la reporter.</p>
		{/if}

		{#if selectedDay === today && doneToday.length}
			<p class="footnote mt-2 px-4 text-label2">
				Fait aujourd’hui :
				{#each doneToday as d, i (d.c.doneAt + d.task.id)}{i ? ', ' : ''}{d.task.title}{#if d.pending}<span class="text-label3"> (en attente d’envoi)</span>{/if}{/each}.
			</p>
		{/if}
	</section>

	<!-- À surveiller, façon « Points forts » de Santé -->
	{#if alerts.length}
		<section class="mb-8">
			{@render foldHeader('surveiller', 'À surveiller', alerts.length)}
			{#if open.surveiller}
				<div class="flex flex-col gap-2.5" style="animation: fade-in 200ms both">
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
			{/if}
		</section>
	{/if}

	<!-- Coach de cyclage -->
	{#if coaches.length}
		<section class="mb-8">
			{@render foldHeader('cyclage', 'Cyclage', coaches.length)}
			{#if open.cyclage}
				<div class="flex flex-col gap-2.5" style="animation: fade-in 200ms both">
					{#each coaches as { aquarium, health: h } (aquarium.id)}
						{@const at = stageIndex[h.coach?.stage ?? 'aucune_mesure']}
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
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	<!-- Consommables -->
	{#if consumablesDue.length}
		<section class="mb-8">
			{@render foldHeader('remplacer', 'À remplacer', consumablesDue.length)}
			{#if open.remplacer}
				<ul class="group ios-list" style="animation: fade-in 200ms both">
					{#each consumablesDue as { c, life } (c.id)}
						<Row href="/aquariums/{c.aquariumId}/inventaire" icon="box" iconColor="var(--brown)" title={c.name} subtitle={tankOf(c.aquariumId)?.name}>
							{#snippet trailing()}
								<span class="subhead font-semibold {life.status === 'en_retard' ? 'text-red' : 'text-orange'}">
									{life.daysLeft! < 0 ? `+${-life.daysLeft!} j` : `${life.daysLeft} j`}
								</span>
							{/snippet}
						</Row>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
{/if}

<PostponeSheet bind:task={postponing} />

<style>
	.ios-tasks > :global(li + li .row-body),
	.attention > li + li .row-body,
	.ios-list > :global(li + li .row-body) {
		box-shadow: inset 0 0.5px 0 var(--sep);
	}
	.attention {
		padding-bottom: 4px;
	}
	.attention > li:first-child .row-body {
		box-shadow: inset 0 0.5px 0 var(--sep);
	}
</style>

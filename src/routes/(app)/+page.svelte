<script lang="ts">
	import { untrack } from 'svelte';
	import { flip } from 'svelte/animate';
	import { slide } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { clock } from '$lib/client/clock.svelte';
	import { collectTankAlerts } from '$lib/domain/drift';
	import { collectForecasts } from '$lib/domain/forecast';
	import { addDays, dayInParis } from '$lib/domain/dates';
	import { consumableLife } from '$lib/domain/consumables';
	import { activeTanks, isProject, stageOf, tankHealth } from '$lib/tank';
	import { activityRings, tankStability, testsDue } from '$lib/domain/stability';
	import { dueTasks } from '$lib/domain/tasks';
	import { weeklyReport } from '$lib/domain/weekly';
	import { listResource } from '$lib/client/api';
	import { SHORT_WATER, TANK_ICON, TANK_TONE, daysSinceWaterChange, fmt, lateBy, relativeDay, tankAge } from '$lib/ui';
	import { contextualAdvice, dailyPicks } from '$lib/domain/advice';
	import { anniversaryOf, doneIds, milestones, newlyDone, nextMilestone, rankPicks, type JourneyFacts, type Milestone } from '$lib/domain/profile';
	import { dayClosed, shouldCelebrate, type RingsSnapshot } from '$lib/domain/celebration';
	import { anniversary, dayClosed as dayClosedPhrase, milestone as milestonePhrase, nothingToday, welcome } from '$lib/voice';
	import { haptic } from '$lib/motion/haptic';
	import { reducedMotion } from '$lib/motion/reduced';
	import { ALL_GUIDES, resolveRelated } from '$lib/content';
	import Scene from '$lib/relief/Scene.svelte';
	import EmptyState from '$lib/art/EmptyState.svelte';
	import Tile from '$lib/relief/Tile.svelte';
	import Carousel from '$lib/relief/Carousel.svelte';
	import TankCard from '$lib/relief/TankCard.svelte';
	import { tankFacts } from '$lib/relief/facts';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Sheet from '$lib/ios/Sheet.svelte';
	import ActivityRings from '$lib/ios/ActivityRings.svelte';
	import Spark from '$lib/ios/Spark.svelte';
	import SearchButton from '$lib/ios/SearchButton.svelte';
	import TaskItem from '$lib/ios/TaskItem.svelte';
	import PostponeSheet from '$lib/ios/PostponeSheet.svelte';
	import { contextMenu } from '$lib/ios/contextMenu';
	import type { Aquarium, Task } from '$lib/types';

	const view = $derived(store.view);
	// Jour et heure vivants : l'appli reprise le lendemain n'est pas rechargée, ils suivent l'horloge.
	const today = $derived(clock.today);
	const aquariums = $derived(view?.aquariums ?? []);
	const tankOf = (id: number) => aquariums.find((a) => a.id === id);
	const health = $derived(view ? aquariums.map((a) => ({ aquarium: a, health: tankHealth(view, a) })) : []);
	// Les bacs en projet n'ont ni mesures, ni alertes, ni tâches : ils sont écartés de tous les calculs.
	const active = $derived(view ? activeTanks(view) : []);
	const activeIds = $derived(new Set(active.map((a) => a.id)));
	const projects = $derived(aquariums.filter(isProject));

	// Bandeau de semaine façon Calendrier : aujourd'hui (avec les retards) puis 6 jours.
	const week = $derived(
		Array.from({ length: 7 }, (_, i) => {
			const day = addDays(today, i);
			const tasks = (view?.tasks ?? []).filter(
				(t) => t.active && activeIds.has(t.aquariumId) && (i === 0 ? t.nextDue <= day : t.nextDue === day)
			);
			const date = new Date(`${day}T12:00:00`);
			return {
				day,
				tasks,
				letter: date.toLocaleDateString('fr-FR', { weekday: 'narrow' }),
				num: date.getDate()
			};
		})
	);
	let selectedDay = $state(untrack(() => today));
	// Le jour change pendant que l'appli est ouverte : la sélection suit « aujourd'hui » au lieu de rester sur hier.
	let knownToday = untrack(() => today);
	$effect(() => {
		if (today === knownToday) return;
		if (untrack(() => selectedDay) === knownToday) selectedDay = today;
		knownToday = today;
	});
	/** Vrai dès que l'utilisateur a changé de jour dans le ruban : seul ce changement joue un fondu. */
	let switched = $state(false);
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

	const alerts = $derived(
		view
			? collectTankAlerts({
					...view,
					parameters: view.parameters.filter((p) => activeIds.has(p.aquariumId)),
					measurements: view.measurements.filter((m) => activeIds.has(m.aquariumId))
				})
			: []
	);
	/** Valeurs encore dans la plage mais en route vers une limite ; celles déjà en alerte sont écartées. */
	const forecasts = $derived(
		view
			? collectForecasts({
					...view,
					parameters: view.parameters.filter((p) => activeIds.has(p.aquariumId)),
					measurements: view.measurements.filter((m) => activeIds.has(m.aquariumId))
				}).filter((f) => !alerts.some((a) => a.parameterId === f.parameterId))
			: []
	);
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

	// --- Anneaux du jour --------------------------------------------------------------------
	const rings = $derived(view ? activityRings(view, clock.now) : null);
	/** Tâches cochées en sursis (délai d'annulation) : déjà comptées comme faites. */
	const checkingDue = $derived(week[0].tasks.filter((t) => ui.checking[t.id]).length);
	const tasksRing = $derived.by(() => {
		if (!rings) return { done: 0, total: 0, ratio: 1 };
		const done = rings.tasks.done + checkingDue;
		const total = rings.tasks.total;
		return { done, total, ratio: total > 0 ? Math.min(1, done / total) : 1 };
	});
	const stabilityRatio = $derived(rings?.stability.score != null ? rings.stability.score / 100 : null);

	// --- Journée bouclée : un halo, une fois par jour, seulement à la fermeture --------------------------
	// L'état d'avant est gardé le temps de la session (on revient de « Mesures » avec l'anneau des tests fermé) ;
	// le jour déjà fêté l'est sur l'appareil. Jamais de halo pour un total à 0 ni pour un changement venu d'ailleurs.
	const BASELINE_KEY = 'rings:baseline';
	const CELEBRATED_KEY = 'rings:celebrated';
	const readJson = <T,>(storage: Storage, key: string): T | null => {
		try {
			return JSON.parse(storage.getItem(key) ?? 'null') as T | null;
		} catch {
			return null;
		}
	};
	let ringsGlow = $state(0);
	$effect(() => {
		if (!rings || !active.length) return;
		const snapshot: RingsSnapshot = {
			day: today,
			tasks: { done: tasksRing.done, total: tasksRing.total },
			tests: { done: rings.tests.done, total: rings.tests.total }
		};
		untrack(() => {
			const before = readJson<RingsSnapshot>(sessionStorage, BASELINE_KEY);
			const celebratedDay = readJson<string>(localStorage, CELEBRATED_KEY);
			const celebrate = shouldCelebrate({ before, now: snapshot, celebratedDay, lastActionAt: ui.lastAction, nowMs: Date.now() });
			try {
				sessionStorage.setItem(BASELINE_KEY, JSON.stringify(snapshot));
				if (celebrate) localStorage.setItem(CELEBRATED_KEY, JSON.stringify(today));
			} catch {
				// Stockage indisponible : pas de halo une seconde fois, au pire une fois de plus.
			}
			if (!celebrate) return;
			ringsGlow = Date.now();
			setTimeout(() => haptic('confirm'), 140);
		});
	});

	let detailOpen = $state(false);
	const testDetails = $derived(
		view
			? active
					.map((a) => {
						const parameters = view.parameters.filter((p) => p.aquariumId === a.id);
						const measurements = view.measurements.filter((m) => m.aquariumId === a.id);
						const t = testsDue(parameters, measurements, stageOf(a), clock.now);
						return {
							aquarium: a,
							due: t.due.map((p) => {
								const last = measurements.filter((m) => m.parameterId === p.id).pop();
								return { p, since: last ? relativeDay(dayInParis(last.measuredAt), today) : null };
							})
						};
					})
					.filter((x) => x.due.length)
			: []
	);
	const stabilityDetails = $derived(
		view
			? active.map((a) => ({
					aquarium: a,
					s: tankStability(
						view.parameters.filter((p) => p.aquariumId === a.id),
						view.measurements.filter((m) => m.aquariumId === a.id),
						Date.now()
					)
				}))
			: []
	);
	const remainingTasks = $derived(
		view ? dueTasks(view.tasks.filter((t) => activeIds.has(t.aquariumId)), clock.now).filter((t) => !ui.checking[t.id]) : []
	);

	// --- Bacs en projet : avancement de la liste -----------------------------------------------
	let projectProgress = $state<Record<number, { done: number; total: number }>>({});
	const requested = new Set<number>();
	$effect(() => {
		for (const a of projects) {
			if (requested.has(a.id)) continue;
			requested.add(a.id);
			listResource<{ done: boolean }>('project_items', a.id)
				.then((items) => (projectProgress = { ...projectProgress, [a.id]: { done: items.filter((i) => i.done).length, total: items.length } }))
				.catch(() => requested.delete(a.id));
		}
	});

	// --- Bilan de la semaine : mis en avant le dimanche et le lundi ----------------------------
	const report = $derived(view ? weeklyReport(view) : null);
	const weekday = $derived(new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Europe/Paris' }).format(new Date(clock.now)));
	const bilanProminent = $derived(weekday === 'Sun' || weekday === 'Mon');
	const nextTask = $derived(
		[...remainingTasks].sort((x, y) => x.nextDue.localeCompare(y.nextDue))[0] ?? null
	);
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
		for (const f of forecasts) {
			list.push({
				key: `f${f.parameterId}`,
				icon: 'chart',
				color: 'var(--orange)',
				text: f.message,
				detail: tankOf(f.aquariumId)?.name,
				href: `/aquariums/${f.aquariumId}/parametre/${f.parameterId}`
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

	// Détails ouverts en feuille depuis les tuiles.
	type Panel = 'surveiller' | 'cyclage' | 'remplacer';
	let panel = $state<Panel | null>(null);

	let postponing = $state<Task | null>(null);

	const kicker = $derived(new Date(clock.now).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }));

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

	/** Jours depuis le dernier changement d'eau, par bac actif. */
	const waterAges = $derived(
		active.flatMap((tank) => {
			const days = daysSinceWaterChange(tank, view?.tasks ?? [], view?.completions ?? [], today);
			return days == null ? [] : [{ tank, days }];
		})
	);

	// --- Ambiance de l'accueil ---------------------------------------------------------------------
	const hour = $derived(clock.hour);
	const hello = $derived(welcome({ hour, name: ui.profile.name, away: clock.away }));
	const mood = $derived<'ok' | 'warn' | 'bad'>(
		attention.some((a) => a.color === 'var(--red)') ? 'bad' : attention.length ? 'warn' : 'ok'
	);
	const headline = $derived.by(() => {
		if (!active.length) return projects.length ? 'Tes projets avancent.' : '';
		if (attention.length) return attention.length === 1 ? 'Une chose à regarder.' : `${attention.length} choses à regarder.`;
		const n = remainingTasks.length;
		if (n === 0 && rings && tasksRing.total > 0 && dayClosed({ tasks: tasksRing, tests: rings.tests })) return dayClosedPhrase(hour, today);
		return n ? `Tout est calme. ${n} tâche${n > 1 ? 's' : ''} t’attend${n > 1 ? 'ent' : ''}.` : 'Tout est calme, rien d’urgent.';
	});

	// Prochaine tâche à venir : quand rien n'est dû aujourd'hui, on dit ce qui suit plutôt que de laisser un vide.
	const upcoming = $derived.by(() => {
		const next = (view?.tasks ?? [])
			.filter((t) => t.active && activeIds.has(t.aquariumId) && t.nextDue > today)
			.sort((a, b) => a.nextDue.localeCompare(b.nextDue))[0];
		return next ? { title: next.title, when: relativeDay(next.nextDue, today) } : null;
	});

	// Anniversaire d'un bac (30 jours, 100 jours, un an…) : une ligne discrète dans la scène, jamais quand quelque chose est à traiter.
	const birthday = $derived.by(() => {
		if (mood === 'bad') return null;
		for (const a of active) {
			const hit = anniversaryOf(tankAge(a, today));
			if (hit) return anniversary(a.name, hit.label);
		}
		return null;
	});

	const tankFactsOf = (a: Aquarium) => (view ? tankFacts(view, a) : { big: null, stats: [] });

	// --- « Pour toi » : conseils d'après l'état des bacs, puis découvertes du jour ------------------
	const advice = $derived.by(() => {
		const waterDays = waterAges.map((w) => w.days);
		const stale = health.some(({ aquarium, health: h }) => !isProject(aquarium) && h.lastMeasuredAt != null && Date.now() - new Date(h.lastMeasuredAt).getTime() > 10 * 86_400_000);
		const contextual = contextualAdvice({
			cycling: coaches.map((c) => c.aquarium.name),
			waterDays: waterDays.length ? Math.max(...waterDays) : null,
			staleTests: stale,
			nitrates: alerts.some((a) => paramOf(a.parameterId)?.key === 'no3'),
			hasFish: true
		}).flatMap((c) => {
			const hit = resolveRelated(c.ref);
			return hit ? [{ ...hit, why: c.why }] : [];
		});
		const used = new Set(contextual.map((c) => c.guide.slug));
		const picks = dailyPicks(
			rankPicks(ALL_GUIDES.filter((g) => g.theme.slug !== 'lexique' && !used.has(g.guide.slug)), ui.profile),
			today,
			4
		).map((hit) => ({ ...hit, why: null as string | null }));
		return [...contextual, ...picks].slice(0, 6);
	});

	// --- Ton parcours : jalons adaptés au niveau choisi dans Mon profil ------------------------------
	const journeyFacts = $derived<JourneyFacts>({
		tanks: aquariums.length,
		measurements: view?.measurements.length ?? 0,
		waterChanges: (view?.events ?? []).filter((e) => e.kind === 'changement_eau').length,
		arrivals: (view?.events ?? []).filter((e) => e.kind === 'habitant_ajout').length,
		daysTracked: Math.max(0, ...active.map((a) => tankAge(a) ?? 0)),
		stability: rings?.stability.score ?? null,
		covers: aquariums.filter((a) => a.coverPhotoId != null).length
	});
	const path = $derived(milestones(ui.profile.level, journeyFacts));
	const pathDone = $derived(path.filter((m) => m.done).length);
	const pathNext = $derived(nextMilestone(path));

	// Jalon atteint : une petite bannière, une fois par jalon. La première fois, l'état actuel sert de point
	// de départ sans rien annoncer ; la liste des faits ne fait que grandir (rien ne se « perd »).
	let announce = $state<Milestone | null>(null);
	$effect(() => {
		if (!view) return;
		const list = path;
		const key = `milestones:${ui.profile.level ?? 'base'}`;
		untrack(() => {
			const previous = readJson<string[]>(localStorage, key);
			const fresh = newlyDone(previous, list);
			try {
				localStorage.setItem(key, JSON.stringify([...new Set([...(previous ?? []), ...doneIds(list)])]));
			} catch {
				// Stockage indisponible : le jalon sera annoncé à la prochaine ouverture.
			}
			if (fresh.length) announce = fresh[0];
		});
	});
	// La bannière attend que la précédente (verdict d'une saisie, tâche cochée) ait fini : une seule à la fois.
	$effect(() => {
		if (!announce || ui.toast) return;
		const m = announce;
		const timer = setTimeout(() => {
			if (ui.toast) return;
			announce = null;
			ui.notify({ message: milestonePhrase(m.label), kind: 'ok', icon: 'check' });
		}, 900);
		return () => clearTimeout(timer);
	});

	const stageIndex = { demarrage: 0, pic_nitrites: 1, finalisation: 2, pret: 3, aucune_mesure: -1 } as const;
	const stages = ['Ammoniac', 'Nitrites', 'Nitrates'];
</script>

<svelte:head><title>Aujourd'hui · Biotope</title></svelte:head>

<NavBar title="Aujourd’hui" large={false}>
	{#snippet trailing()}<SearchButton />{/snippet}
</NavBar>

{#if view && aquariums.length === 0}
	<EmptyState art="bac" title="Aucun bac pour l’instant" text="Ajoute ton premier aquarium : je prépare les paramètres à suivre et leurs plages." class="mt-10">
		{#snippet actions()}<a href="/aquariums/nouveau" class="btn-filled">Ajouter un bac</a>{/snippet}
	</EmptyState>
{:else}
	<!-- Scène : accueil, ambiance du moment, anneaux du jour -->
	<Scene hour={clock.hourFraction} class="rise mb-6 mt-1">
		<div class="px-5 pb-6 pt-5">
			<div class="flex items-start justify-between gap-3">
				<p class="footnote font-semibold uppercase tracking-wide text-white/80">{kicker}</p>
				{#if active.length}
					<span class="caption1 flex shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 font-semibold backdrop-blur-md">
						<span class="h-2 w-2 rounded-full" style="background: {mood === 'bad' ? 'var(--red)' : mood === 'warn' ? 'var(--yellow)' : 'var(--green)'}"></span>
						{mood === 'bad' ? 'À traiter' : mood === 'warn' ? 'À surveiller' : 'Tout va bien'}
					</span>
				{/if}
			</div>
			<h1 class="large-title mt-2 drop-shadow-sm">{hello}</h1>
			{#if headline}<p class="body mt-1 text-white/90">{headline}</p>{/if}
			{#if birthday}<p class="subhead mt-2 w-fit max-w-full rounded-full bg-white/20 px-3 py-1 font-semibold backdrop-blur-md">{birthday}</p>{/if}

			{#if rings && active.length}
				<button type="button" class="pressable mt-5 flex w-full items-center gap-4 text-left" onclick={() => (detailOpen = true)} aria-label="Voir le détail des anneaux du jour">
					<span class="grid shrink-0 place-items-center rounded-full bg-white/20 p-2.5 backdrop-blur-md">
						<ActivityRings
							size={92}
							stroke={11}
							glowAt={ringsGlow}
							rings={[
								{ ratio: tasksRing.ratio, color: 'var(--red)' },
								{ ratio: rings.tests.ratio, color: 'var(--green)' },
								{ ratio: stabilityRatio, color: 'var(--cyan)' }
							]}
							label="Tâches {tasksRing.done} sur {tasksRing.total}, tests {rings.tests.done} sur {rings.tests.total}, stabilité {rings.stability.score ?? 'inconnue'}"
						/>
					</span>
					<dl class="grid min-w-0 flex-1 grid-cols-3 gap-2">
						<div>
							<dt class="caption2 font-semibold uppercase text-white/75">Tâches</dt>
							<dd class="rounded-num title2 leading-7">{tasksRing.done}<span class="footnote font-semibold text-white/70">/{tasksRing.total}</span></dd>
						</div>
						<div>
							<dt class="caption2 font-semibold uppercase text-white/75">Tests</dt>
							<dd class="rounded-num title2 leading-7">{rings.tests.done}<span class="footnote font-semibold text-white/70">/{rings.tests.total}</span></dd>
						</div>
						<div>
							<dt class="caption2 font-semibold uppercase text-white/75">Stabilité</dt>
							<dd class="rounded-num title2 leading-7">
								{#if rings.stability.score != null}{rings.stability.score}<span class="footnote font-semibold text-white/70">%</span>{:else}–{/if}
							</dd>
						</div>
					</dl>
				</button>
			{/if}
		</div>
	</Scene>

	<!-- Prochaine action : la tâche la plus urgente, à cocher d'un geste -->
	{#if nextTask}
		{@const d = taskDetail(nextTask)}
		<section class="raised rise mb-6 flex items-center gap-3 py-3 pl-4 pr-3" aria-label="Prochaine action">
			<span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-tint/12 text-tint" style="--cut: var(--bg2)"><Icon name="calendar" size={22} filled weight={1.8} /></span>
			<a href="/aquariums/{nextTask.aquariumId}/taches" class="min-w-0 flex-1">
				<p class="caption1 font-semibold uppercase tracking-wide text-label2">À faire maintenant</p>
				<p class="headline truncate">{nextTask.title}</p>
				<p class="footnote truncate {d.late ? 'text-red' : 'text-label2'}">{tankOf(nextTask.aquariumId)?.name} · {d.text}</p>
			</a>
			<button type="button" class="btn-tinted shrink-0 !px-4" onclick={() => ui.check(nextTask.id, nextTask.title)}>Fait</button>
		</section>
	{/if}

	<!-- Ce qui demande de l'attention, seulement s'il y en a -->
	{#if attention.length}
		<section class="raised rise relative mb-6 overflow-hidden">
			<!-- Barre d'état à gauche : posée à l'intérieur du rayon, un border-left se terminerait en croissant aux angles. -->
			<span class="pointer-events-none absolute inset-y-4 left-0 w-1 rounded-r-full" style="background: {mood === 'bad' ? 'var(--red)' : 'var(--orange)'}" aria-hidden="true"></span>
			<p class="headline px-4 pb-1 pt-3.5">{attention.length === 1 ? 'À regarder' : `À regarder (${attention.length})`}</p>
			<ul class="attention">
				{#each attention.slice(0, 4) as a (a.key)}
					<li>
						<a href={a.href} class="tappable flex items-center gap-3 pl-4">
							<span class="w-[26px] shrink-0 text-center" style="color: {a.color}; --cut: var(--bg2)"><Icon name={a.icon} size={19} filled weight={1.8} /></span>
							<div class="row-body flex min-h-11 min-w-0 flex-1 items-center gap-2 py-2 pr-4">
								<div class="min-w-0 flex-1">
									<p class="subhead">{a.text}</p>
									{#if a.detail}<p class="footnote text-label2">{a.detail}</p>{/if}
								</div>
								<span class="shrink-0 text-label3"><Icon name="next" size={15} weight={2.4} /></span>
							</div>
						</a>
					</li>
				{/each}
			</ul>
			{#if attention.length > 4}
				<button type="button" class="tappable footnote w-full px-4 py-2.5 text-left font-semibold text-tint" onclick={() => (panel = 'surveiller')}>Tout voir</button>
			{/if}
		</section>
	{/if}

	<!-- À faire : ruban de la semaine, progression, tâches -->
	<section class="reveal mb-8" id="a-faire">
		<div class="mb-2.5 flex items-baseline justify-between px-1">
			<h2 class="title3 font-bold">À faire</h2>
			{#if rings && tasksRing.total > 0}<span class="subhead text-label2">{tasksRing.done} sur {tasksRing.total} aujourd’hui</span>{/if}
		</div>
		{#if rings && tasksRing.total > 0}
			<div class="mb-3 h-2 overflow-hidden rounded-full bg-fill px-0" aria-hidden="true">
				<div class="h-full rounded-full transition-[width] duration-700" style="width: {Math.round(tasksRing.ratio * 100)}%; background: linear-gradient(90deg, var(--orange), var(--red))"></div>
			</div>
		{/if}
		<div class="raised mb-3 grid grid-cols-7 px-1.5 py-2.5" role="tablist" aria-label="Jours de la semaine">
			{#each week as d, i (d.day)}
				{@const on = d.day === selectedDay}
				<button role="tab" aria-selected={on} onclick={() => ((selectedDay = d.day), (switched = true))} class="flex flex-col items-center gap-1">
					<span class="caption2 font-semibold uppercase text-label2">{d.letter}</span>
					<span
						class="rounded-num grid h-9 w-9 place-items-center rounded-full text-[19px] transition-all duration-300 {on ? (i === 0 ? 'bg-red text-white shadow-[0_6px_14px_-4px_var(--red)]' : 'bg-label text-bg2') : i === 0 ? 'font-semibold text-red' : ''}"
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

		<!-- Le contenu se renouvelle d'un fondu quand on change de jour ; une tâche qui part se replie et les suivantes montent. -->
		{#key selectedDay}
			<div style={switched ? 'animation: fade-in var(--dur-s) var(--ease-out) backwards' : undefined}>
				{#if sortedTasks.length === 0}
					<div class="raised flex items-center gap-3 px-4 py-4">
						<span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-green/15 text-green"><Icon name="check" size={22} weight={2.8} /></span>
						<p class="subhead text-label2">{selectedDay === today ? nothingToday(upcoming) : 'Rien de prévu ce jour-là.'}</p>
					</div>
				{:else}
					<ul class="raised ios-tasks overflow-hidden">
						{#each sortedTasks as task (task.id)}
							{@const d = taskDetail(task)}
							{@const tank = tankOf(task.aquariumId)}
							<div role="presentation" animate:flip={{ duration: reducedMotion() ? 0 : 220 }} out:slide|local={{ duration: reducedMotion() ? 0 : 220 }}>
								<TaskItem
									{task}
									detail={d.text}
									late={d.late}
									tankName={tank?.name}
									tankColor={tank ? TANK_TONE[tank.waterType] : undefined}
									onpostpone={(t) => (postponing = t)}
								/>
							</div>
						{/each}
					</ul>
					<p class="footnote mt-2 px-4 text-label2">Glisse une tâche vers la droite pour la cocher, vers la gauche pour la reporter.</p>
				{/if}
			</div>
		{/key}

		{#if selectedDay === today && doneToday.length}
			<p class="footnote mt-2 px-4 text-label2">
				Fait aujourd’hui :
				{#each doneToday as d, i (d.c.doneAt + d.task.id)}{i ? ', ' : ''}{d.task.title}{#if d.pending}<span class="text-label3"> (en attente d’envoi)</span>{/if}{/each}.
			</p>
		{/if}
	</section>

	<!-- Ton parcours : prochain jalon, adapté au niveau -->
	<section class="raised reveal mb-8 p-4" aria-label="Ton parcours">
		<div class="mb-3 flex items-baseline justify-between">
			<h2 class="title3 font-bold">Ton parcours</h2>
			<span class="subhead rounded-num text-label2">{pathDone} sur {path.length}</span>
		</div>
		<ol class="mb-3 grid gap-1.5" style="grid-template-columns: repeat({path.length}, minmax(0, 1fr))" aria-hidden="true">
			{#each path as m (m.id)}
				<li class="h-1.5 rounded-full transition-colors duration-500 {m.done ? 'bg-tint' : m === pathNext ? 'bg-tint/40' : 'bg-fill'}"></li>
			{/each}
		</ol>
		{#if pathNext}
			<a href={pathNext.href} class="tappable -mx-1 flex items-center gap-3 rounded-xl px-1 py-1">
				<span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-tint/12 text-tint"><Icon name="check" size={20} weight={2.4} /></span>
				<span class="min-w-0 flex-1">
					<span class="caption1 block font-semibold uppercase tracking-wide text-label2">Prochain jalon</span>
					<span class="headline block truncate">{pathNext.label}</span>
					<span class="footnote block truncate text-label2">{pathNext.hint}</span>
				</span>
				<span class="shrink-0 text-label3"><Icon name="next" size={16} weight={2.4} /></span>
			</a>
		{:else}
			<p class="subhead flex items-center gap-2 text-label2"><span class="text-green"><Icon name="check" size={18} weight={2.8} /></span>Parcours accompli{ui.profile.name ? `, ${ui.profile.name}` : ''}. Chaque jalon est derrière toi.</p>
		{/if}
		{#if !ui.profile.level}
			<a href="/reglages/profil" class="footnote mt-3 block font-semibold text-tint">Dis-moi ton niveau pour un parcours à ta mesure</a>
		{/if}
	</section>

	<!-- Tes bacs : cartes en hauteur -->
	<Carousel header="Tes bacs" more={{ href: '/aquariums', label: 'Tous' }}>
		{#each health as { aquarium, health: h } (aquarium.id)}
			{@const tone = TANK_TONE[aquarium.waterType]}
			{#if isProject(aquarium)}
				{@const pr = projectProgress[aquarium.id]}
				<TankCard
					href="/aquariums/{aquarium.id}/projet"
					name={aquarium.name}
					subtitle="{SHORT_WATER[aquarium.waterType]}{aquarium.volumeL ? ` · ${fmt(aquarium.volumeL, 0)} L` : ''}"
					tone="var(--gray)"
					icon="outils"
					coverPhotoId={aquarium.coverPhotoId}
					stats={pr && pr.total > 0 ? [{ label: 'Étapes', value: `${pr.done}/${pr.total}` }] : []}
					status={{ text: 'En projet', level: 'cycle', icon: 'outils' }}
					menu={tankMenu(aquarium)}
				>
					{#snippet footer()}
						{#if pr && pr.total > 0}
							<div class="h-1.5 overflow-hidden rounded-full bg-fill">
								<div class="h-full rounded-full bg-tint transition-[width] duration-700" style="width: {Math.round((pr.done / pr.total) * 100)}%"></div>
							</div>
						{:else}
							<p class="footnote text-label2">Prépare ta liste : matériel, budget, espèces, mise en eau.</p>
						{/if}
					{/snippet}
				</TankCard>
			{:else}
				{@const age = tankAge(aquarium)}
				{@const cycling = stageOf(aquarium) === 'cyclage' || h.level === 'cycle'}
				{@const facts = tankFactsOf(aquarium)}
				<TankCard
					href="/aquariums/{aquarium.id}"
					name={aquarium.name}
					subtitle="{SHORT_WATER[aquarium.waterType]}{aquarium.volumeL ? ` · ${fmt(aquarium.volumeL, 0)} L` : ''}"
					{tone}
					icon={TANK_ICON[aquarium.waterType]}
					coverPhotoId={aquarium.coverPhotoId}
					big={facts.big}
					stats={facts.stats}
					status={{
						text: cycling ? (age != null ? `Cyclage · jour ${age}` : 'En cyclage') : h.label,
						level: cycling ? 'cycle' : h.level,
						icon: h.level === 'ok' && !cycling ? 'check' : cycling ? 'cycle' : 'alert'
					}}
					feedFor={aquarium.id}
					menu={tankMenu(aquarium)}
				/>
			{/if}
		{/each}
		<a href="/aquariums/nouveau" class="pressable raised grid w-28 shrink-0 snap-start place-items-center text-center text-tint">
			<span class="flex flex-col items-center gap-2">
				<span class="grid h-12 w-12 place-items-center rounded-full bg-tint/12"><Icon name="plus" size={26} weight={2.2} /></span>
				<span class="subhead font-semibold">Ajouter</span>
			</span>
		</a>
	</Carousel>

	<!-- En un coup d'œil : tuiles de tailles variées, chacune ouvre son détail -->
	{#if active.length}
		<section class="mb-8 grid grid-cols-2 gap-3" aria-label="En un coup d’œil">
			<Tile tone={alerts.length ? 'var(--orange)' : 'var(--green)'} variant="soft" mark={alerts.length ? 'alert' : 'check'} onclick={alerts.length ? () => (panel = 'surveiller') : undefined} class="reveal min-h-[8.5rem]">
				<p class="caption1 font-semibold uppercase tracking-wide text-label2">À surveiller</p>
				<p class="rounded-num mt-1 text-[44px] font-bold leading-none">{alerts.length}</p>
				<p class="footnote mt-1.5 line-clamp-2 text-label2">{alerts.length ? alerts[0].message : 'Aucune dérive en cours'}</p>
			</Tile>

			{#if coaches.length}
				{@const c = coaches[0]}
				{@const at = stageIndex[c.health.coach?.stage ?? 'aucune_mesure']}
				<Tile tone="var(--indigo)" variant="solid" mark="cycle" onclick={() => (panel = 'cyclage')} class="reveal min-h-[8.5rem]">
					<p class="caption1 font-semibold uppercase tracking-wide text-white/80">Cyclage</p>
					<p class="headline mt-1 line-clamp-2">{c.health.coach?.title.replace('Cyclage : ', '').replace(/^./, (x) => x.toUpperCase())}</p>
					<div class="mt-3 grid grid-cols-3 gap-1">
						{#each stages as s, i (s)}
							<span class="h-1.5 rounded-full {i < at ? 'bg-white' : i === at ? 'bg-white/55' : 'bg-white/25'}"></span>
						{/each}
					</div>
					<p class="footnote mt-1.5 text-white/80">{c.aquarium.name}</p>
				</Tile>
			{:else}
				{@const oldest = waterAges.length ? waterAges.reduce((m, x) => (x.days > m.days ? x : m)) : null}
				<Tile tone="var(--cyan)" variant="soft" mark="drop" href={oldest ? `/aquariums/${oldest.tank.id}/taches` : undefined} class="reveal min-h-[8.5rem]">
					<p class="caption1 font-semibold uppercase tracking-wide text-label2">Dernier changement d’eau</p>
					{#if oldest}
						<p class="rounded-num mt-1 text-[44px] font-bold leading-none">{oldest.days}<span class="title3 font-semibold text-label2"> j</span></p>
						<p class="footnote mt-1.5 truncate text-label2">{oldest.tank.name}</p>
					{:else}
						<p class="subhead mt-2 text-label2">Pas encore enregistré.</p>
					{/if}
				</Tile>
			{/if}

			{#if consumablesDue.length}
				<Tile tone="var(--brown)" variant="soft" mark="box" onclick={() => (panel = 'remplacer')} class="reveal min-h-[7rem]">
					<p class="caption1 font-semibold uppercase tracking-wide text-label2">À remplacer</p>
					<p class="rounded-num mt-1 text-[36px] font-bold leading-none">{consumablesDue.length}</p>
					<p class="footnote mt-1 truncate text-label2">{consumablesDue[0].c.name}</p>
				</Tile>
			{:else if rings}
				<Tile tone="var(--green)" variant="soft" mark="drop" onclick={() => (detailOpen = true)} class="reveal min-h-[7rem]">
					<p class="caption1 font-semibold uppercase tracking-wide text-label2">Tests</p>
					<p class="rounded-num mt-1 text-[36px] font-bold leading-none">{rings.tests.done}<span class="title3 font-semibold text-label2">/{rings.tests.total}</span></p>
					<p class="footnote mt-1 text-label2">à jour</p>
				</Tile>
			{/if}

			{#if rings}
				<Tile tone="var(--cyan)" variant="soft" mark="chart" onclick={() => (detailOpen = true)} class="reveal min-h-[7rem]">
					<p class="caption1 font-semibold uppercase tracking-wide text-label2">Stabilité</p>
					<p class="rounded-num mt-1 text-[36px] font-bold leading-none">
						{#if rings.stability.score != null}{rings.stability.score}<span class="title3 font-semibold text-label2">%</span>{:else}–{/if}
					</p>
					<p class="footnote mt-1 text-label2">sur 30 jours</p>
				</Tile>
			{/if}

			{#if report}
				<Tile tone="var(--indigo)" variant="solid" mark="chart" href="/bilan" class="reveal col-span-2">
					<div class="flex items-center gap-3">
						<div class="min-w-0 flex-1">
							<p class="headline flex items-center gap-2">
								Bilan de la semaine
								{#if bilanProminent}<span class="caption1 rounded-full bg-white/25 px-2 py-0.5 font-semibold">Prêt</span>{/if}
							</p>
							<p class="subhead mt-0.5 line-clamp-2 text-white/85">{report.summary}</p>
						</div>
						<span class="shrink-0 text-white/70"><Icon name="next" size={18} weight={2.4} /></span>
					</div>
				</Tile>
			{/if}
		</section>
	{/if}

	<!-- Pour toi : conseils selon l'état des bacs, puis découvertes du jour -->
	{#if advice.length}
		<Carousel header="Pour toi" more={{ href: '/encyclopedie', label: 'Encyclopédie' }}>
			{#each advice as a, i (a.theme.slug + a.guide.slug)}
				{#if a.why}
					<Tile href="/encyclopedie/{a.theme.slug}/{a.guide.slug}" tone={a.theme.color} variant="solid" mark={a.theme.icon} class="flex min-h-[10rem] w-[78%] max-w-72 shrink-0 snap-start flex-col justify-end">
						<p class="caption1 font-semibold uppercase tracking-wide text-white/80">Conseil</p>
						<p class="headline mt-1">{a.guide.title}</p>
						<p class="subhead mt-1 text-white/85">{a.why}</p>
					</Tile>
				{:else}
					<Tile href="/encyclopedie/{a.theme.slug}/{a.guide.slug}" tone={a.theme.color} variant="soft" mark={a.theme.icon} class="flex min-h-[10rem] w-44 shrink-0 snap-start flex-col justify-between {i % 2 ? 'mt-4' : ''}">
						<span class="grid h-9 w-9 place-items-center rounded-[12px] text-white" style="background: {a.theme.color}; --cut: {a.theme.color}"><Icon name={a.theme.icon} size={20} filled weight={1.8} /></span>
						<div>
							<p class="caption1 font-semibold uppercase tracking-wide text-label2">{a.theme.title}</p>
							<p class="subhead mt-0.5 line-clamp-3 font-semibold">{a.guide.title}</p>
						</div>
					</Tile>
				{/if}
			{/each}
		</Carousel>
	{/if}
{/if}

<!-- Détail des anneaux du jour -->
<Sheet open={detailOpen} title="Aujourd’hui" cancelLabel="Fermer" onclose={() => (detailOpen = false)}>
	{#if rings}
		<div class="mb-6 flex items-center gap-4 px-1">
			<ActivityRings
				size={84}
				stroke={10}
				rings={[
					{ ratio: tasksRing.ratio, color: 'var(--red)' },
					{ ratio: rings.tests.ratio, color: 'var(--green)' },
					{ ratio: stabilityRatio, color: 'var(--cyan)' }
				]}
			/>
			<p class="subhead text-label2">
				Les anneaux se ferment quand les tâches du jour sont faites, que les tests sont à jour et que tes valeurs restent stables sur 30 jours.
			</p>
		</div>
	{/if}

	{#if testDetails.length === 0}
		<Section header="Tests à faire" variant="title">
			<Row icon="check" iconColor="var(--green)" title="Tous les tests sont à jour" />
		</Section>
	{:else}
		<h2 class="title3 mb-2 px-1 font-bold">Tests à faire</h2>
		{#each testDetails as { aquarium, due }, i (aquarium.id)}
			<Section
				header={aquarium.name}
				footer={i === testDetails.length - 1 ? 'Un test est à faire quand la dernière mesure est plus ancienne que sa cadence : 7 jours, 2 jours pour l’ammoniac et les nitrites d’un bac en cyclage.' : undefined}
				class={i < testDetails.length - 1 ? '!mb-4' : ''}
			>
				{#each due as { p, since } (p.id)}
					<Row
						href="/mesurer?bac={aquarium.id}"
						icon="drop"
						iconColor={TANK_TONE[aquarium.waterType]}
						title={p.name}
						subtitle={since ? `Mesuré ${since}` : 'Jamais mesuré'}
						value="Mesurer"
					/>
				{/each}
			</Section>
		{/each}
	{/if}

	<Section header="Tâches restantes" variant="title">
		{#if remainingTasks.length === 0}
			<Row icon="check" iconColor="var(--green)" title="Tout est fait pour aujourd’hui" />
		{:else}
			{#each remainingTasks as t (t.id)}
				{@const tank = tankOf(t.aquariumId)}
				<Row
					href="/aquariums/{t.aquariumId}/taches"
					icon="calendar"
					iconColor={lateBy(t, today) > 0 ? 'var(--red)' : 'var(--orange)'}
					title={t.title}
					subtitle="{tank?.name ?? ''}{lateBy(t, today) > 0 ? ` · en retard de ${lateBy(t, today)} j` : ''}"
				/>
			{/each}
		{/if}
	</Section>

	<Section header="Stabilité sur 30 jours" variant="title" footer="La stabilité compare la variation de chaque valeur à la largeur de sa plage acceptable. Il faut au moins 3 mesures par paramètre.">
		{#each stabilityDetails as { aquarium, s } (aquarium.id)}
			<Row
				icon={TANK_ICON[aquarium.waterType]}
				iconColor={TANK_TONE[aquarium.waterType]}
				title={aquarium.name}
				subtitle={s.score == null ? 'Pas assez de mesures' : undefined}
				value={s.score == null ? undefined : `${s.score} %`}
			/>
			{#each [...s.parameters].sort((a, b) => a.score - b.score).slice(0, 3) as ps (ps.parameterId)}
				{@const param = paramOf(ps.parameterId)}
				<Row
					href="/aquariums/{aquarium.id}/parametre/{ps.parameterId}"
					title={param?.name ?? 'Paramètre'}
					subtitle={ps.reason}
					value="{ps.score} %"
				/>
			{/each}
		{/each}
	</Section>
</Sheet>

<!-- Détails ouverts depuis les tuiles -->
<Sheet open={panel === 'surveiller'} title="À surveiller" cancelLabel="Fermer" onclose={() => (panel = null)}>
	<div class="flex flex-col gap-2.5">
		{#each alerts as alert (alert.parameterId)}
			{@const p = paramOf(alert.parameterId)}
			{@const tank = tankOf(alert.aquariumId)}
			{@const bad = alert.level === 'hors_plage'}
			<a href="/aquariums/{alert.aquariumId}/parametre/{alert.parameterId}" class="pressable raised block p-4">
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
		{:else}
			<p class="subhead px-1 text-label2">Aucune dérive en cours.</p>
		{/each}
	</div>
</Sheet>

<Sheet open={panel === 'cyclage'} title="Cyclage" cancelLabel="Fermer" onclose={() => (panel = null)}>
	<div class="flex flex-col gap-2.5">
		{#each coaches as { aquarium, health: h } (aquarium.id)}
			{@const at = stageIndex[h.coach?.stage ?? 'aucune_mesure']}
			<a href="/aquariums/{aquarium.id}" class="pressable raised block p-4">
				<div class="mb-3 flex items-center gap-1.5 text-indigo">
					<Icon name="cycle" size={17} weight={2} />
					<span class="subhead flex-1 font-semibold">{aquarium.name}</span>
					<span class="text-label3"><Icon name="next" size={15} weight={2.4} /></span>
				</div>
				<div class="mb-3 grid grid-cols-3 gap-1.5">
					{#each stages as s, i (s)}
						<div>
							<div class="mb-1 h-1.5 rounded-full {i < at ? 'bg-indigo' : i === at ? 'bg-indigo/40' : 'bg-fill'}"></div>
							<p class="caption1 font-semibold {i <= at ? 'text-label' : 'text-label2'}">{s}</p>
						</div>
					{/each}
				</div>
				<p class="headline">{h.coach?.title.replace('Cyclage : ', '').replace(/^./, (c) => c.toUpperCase())}</p>
				<p class="subhead mt-0.5 text-label2">{h.coach?.advice}</p>
			</a>
		{/each}
		<a href="/encyclopedie/demarrer/cycle-azote" class="subhead px-1 font-semibold text-tint">Comprendre le cycle de l’azote</a>
	</div>
</Sheet>

<Sheet open={panel === 'remplacer'} title="À remplacer" cancelLabel="Fermer" onclose={() => (panel = null)}>
	<ul class="raised ios-list overflow-hidden">
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
</Sheet>

<PostponeSheet bind:task={postponing} />

<style>
	.ios-tasks > :global(div + div .row-body),
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

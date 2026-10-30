<script lang="ts">
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { api } from '$lib/client/api';
	import { activeTanks } from '$lib/tank';
	import { weeklyReport } from '$lib/domain/weekly';
	import { fmt } from '$lib/ui';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Segmented from '$lib/ios/Segmented.svelte';
	import ActivityRings from '$lib/ios/ActivityRings.svelte';

	// Bilan de la semaine : 7 jours se terminant aujourd'hui, tous les bacs en eau ou un seul.
	// Ouvert aussi par la notification du dimanche.
	const view = $derived(store.view);
	const active = $derived(view ? activeTanks(view) : []);

	let selected = $state('all');
	const options = $derived([{ value: 'all', label: 'Tous' }, ...active.map((a) => ({ value: String(a.id), label: a.name }))]);
	// Un bac supprimé ou passé en projet ne doit pas laisser une sélection fantôme.
	$effect(() => {
		if (selected !== 'all' && !active.some((a) => String(a.id) === selected)) selected = 'all';
	});

	const scoped = $derived.by(() => {
		if (!view) return null;
		if (selected === 'all') return view;
		const id = Number(selected);
		const taskIds = new Set(view.tasks.filter((t) => t.aquariumId === id).map((t) => t.id));
		return {
			...view,
			aquariums: view.aquariums.filter((a) => a.id === id),
			parameters: view.parameters.filter((p) => p.aquariumId === id),
			measurements: view.measurements.filter((m) => m.aquariumId === id),
			tasks: view.tasks.filter((t) => t.aquariumId === id),
			completions: (view.completions ?? []).filter((c) => taskIds.has(c.taskId)),
			events: (view.events ?? []).filter((e) => e.aquariumId === id),
			feedings: view.feedings?.filter((f) => f.aquariumId === id)
		};
	});
	const report = $derived(scoped ? weeklyReport(scoped) : null);
	const several = $derived(selected === 'all' && active.length > 1);

	const day = (iso: string) => new Date(`${iso}T12:00:00`);
	const periodText = $derived.by(() => {
		if (!report) return '';
		const from = day(report.period.from);
		const to = day(report.period.to);
		const month = (d: Date, short = false) => d.toLocaleDateString('fr-FR', { month: short ? 'short' : 'long' });
		return from.getMonth() === to.getMonth()
			? `${from.getDate()} → ${to.getDate()} ${month(to)}`
			: `${from.getDate()} ${month(from, true)} → ${to.getDate()} ${month(to, true)}`;
	});

	/** Icône d'un point marquant, d'après son libellé (les points sont des phrases produites par weeklyReport). */
	function highlightIcon(text: string): IconName {
		if (text.startsWith('Arrivée')) return 'fish';
		if (text.startsWith('Départ')) return 'alert';
		if (text.includes('d’eau')) return 'drop';
		return 'chart';
	}

	// --- Photo du mois ---------------------------------------------------------------------
	interface Photo {
		id: number;
		aquariumId: number;
		takenOn: string;
		caption: string | null;
	}
	let photo = $state<{ id: number; takenOn: string | null; caption: string | null; tank: string; monthly: boolean } | null>(null);
	let photoLoaded = $state(false);
	let request = 0;

	$effect(() => {
		const ids = selected === 'all' ? active.map((a) => a.id) : [Number(selected)];
		const tanks = view?.aquariums ?? [];
		const covers = ids.map((id) => ({ id, cover: tanks.find((a) => a.id === id)?.coverPhotoId ?? null }));
		const mine = ++request;
		photoLoaded = false;
		const monthStart = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }).slice(0, 8) + '01';
		Promise.all(ids.map((id) => api<Photo[]>('GET', `/api/photos?aquariumId=${id}`).catch(() => [] as Photo[])))
			.then((lists) => {
				if (mine !== request) return;
				const all = lists.flat().sort((a, b) => (a.takenOn < b.takenOn ? 1 : a.takenOn > b.takenOn ? -1 : b.id - a.id));
				const newest = all[0];
				const name = (aquariumId: number) => tanks.find((a) => a.id === aquariumId)?.name ?? '';
				if (newest) {
					photo = { id: newest.id, takenOn: newest.takenOn, caption: newest.caption, tank: name(newest.aquariumId), monthly: newest.takenOn >= monthStart };
				} else {
					const c = covers.find((x) => x.cover != null);
					photo = c ? { id: c.cover as number, takenOn: null, caption: null, tank: name(c.id), monthly: false } : null;
				}
				photoLoaded = true;
			})
			.catch(() => {
				if (mine === request) photoLoaded = true;
			});
	});
	const journalTarget = $derived(selected === 'all' ? active[0]?.id : Number(selected));

	// --- Partage ---------------------------------------------------------------------------
	function shareText(): string {
		if (!report) return '';
		const lines = [`Bilan de la semaine (${periodText})`, ''];
		lines.push(report.tasks.due ? `Tâches : ${report.tasks.done} sur ${report.tasks.due}` : 'Tâches : aucune prévue');
		lines.push(`Mesures : ${report.measurements.count}`);
		lines.push(
			report.outOfRange.length
				? `Hors plage : ${report.outOfRange.map((o) => `${o.parameterName}${several ? ` (${o.aquariumName})` : ''} ${fmt(o.value, o.decimals)}${o.unit ? ` ${o.unit}` : ''}`).join(', ')}`
				: 'Hors plage : aucune valeur'
		);
		if (report.stable.length) lines.push(`Stables : ${report.stable.map((s) => s.parameterName).join(', ')}`);
		if (report.highlights.length) lines.push('', 'Points marquants', ...report.highlights.map((h) => `- ${h}`));
		if (report.feedings) lines.push('', `Repas : ${report.feedings.count}`);
		return lines.join('\n');
	}

	async function share() {
		const text = shareText();
		try {
			if (typeof navigator.share === 'function') {
				await navigator.share({ title: 'Bilan de la semaine', text });
				return;
			}
		} catch (error) {
			// Fermer la feuille de partage n'est pas une erreur.
			if ((error as Error).name === 'AbortError') return;
		}
		try {
			await navigator.clipboard.writeText(text);
			ui.show('Bilan copié', undefined, 'check');
		} catch {
			ui.show('Impossible de copier le bilan.');
		}
	}

	const headline = $derived(report ? report.summary.replace(/^./, (c) => c.toUpperCase()) + '.' : '');
</script>

<svelte:head><title>Bilan · Aquarium</title></svelte:head>

<NavBar title="Bilan" large={false} back={{ href: '/', label: 'Aujourd’hui' }}>
	{#snippet trailing()}
		<button class="btn-plain grid h-11 w-11 place-items-center" onclick={share} aria-label="Partager le bilan" disabled={!report}>
			<Icon name="up" size={22} weight={2} />
		</button>
	{/snippet}
</NavBar>

{#if !report || active.length === 0}
	<div class="mt-16 flex flex-col items-center px-6 text-center">
		<span class="mb-4 grid h-16 w-16 place-items-center rounded-full bg-fill3 text-label2"><Icon name="chart" size={30} /></span>
		<h2 class="title3">Pas encore de bilan</h2>
		<p class="subhead mt-1.5 text-label2">Le bilan apparaît dès qu’un bac est en eau. Les bacs en projet n’y figurent pas.</p>
	</div>
{:else}
	<header class="mb-5 px-1 pt-1">
		<p class="footnote font-semibold uppercase text-label2">{periodText}</p>
		<h1 class="title1 mt-1">{headline}</h1>
	</header>

	{#if active.length > 1}
		<div class="mb-6">
			<Segmented {options} bind:value={selected} label="Bac" />
		</div>
	{/if}

	<!-- Tâches -->
	<Section header="Tâches" variant="title" inset={false}>
		<div class="group flex items-center gap-4 p-4">
			<ActivityRings size={84} stroke={11} rings={[{ ratio: report.tasks.ratio, color: 'var(--red)' }]} label="Tâches faites : {report.tasks.done} sur {report.tasks.due}" />
			<div class="min-w-0 flex-1">
				{#if report.tasks.due}
					<p class="rounded-num"><span class="text-[34px] font-semibold leading-9">{report.tasks.done}</span><span class="title3 text-label2">&nbsp;sur {report.tasks.due}</span></p>
					<p class="subhead text-label2">tâches faites cette semaine</p>
				{:else}
					<p class="headline">Aucune tâche prévue</p>
					<p class="subhead text-label2">Ajoute des tâches récurrentes dans l’onglet Tâches d’un bac.</p>
				{/if}
			</div>
		</div>
	</Section>

	<!-- Mesures -->
	<Section header="Mesures" variant="title" footer={report.measurements.count === 0 ? 'Aucune mesure cette semaine : pense à tester tes paramètres.' : undefined}>
		<Row icon="drop" iconColor="var(--blue)" title="Mesures saisies" value={String(report.measurements.count)} />
		{#each report.measurements.perTank as t (t.aquariumId)}
			{#if several}<Row href="/aquariums/{t.aquariumId}" title={t.name} value={String(t.count)} />{/if}
		{/each}
	</Section>

	<!-- Hors plage -->
	<Section header="Hors plage" variant="title">
		{#if report.outOfRange.length === 0}
			<Row icon="check" iconColor="var(--green)" title="Rien hors plage" subtitle="Toutes les dernières valeurs sont dans leur plage." />
		{:else}
			{#each report.outOfRange as o (o.parameterId)}
				<Row href="/aquariums/{o.aquariumId}/parametre/{o.parameterId}" icon="alert" iconColor="var(--red)" title={o.parameterName} subtitle={several ? o.aquariumName : undefined}>
					{#snippet trailing()}
						<span class="rounded-num body font-semibold text-red">{fmt(o.value, o.decimals)}{o.unit ? ` ${o.unit}` : ''}</span>
					{/snippet}
				</Row>
			{/each}
		{/if}
	</Section>

	<!-- Stables -->
	<Section header="Stables" variant="title" inset={false} footer="Une valeur est stable quand elle a peu varié sur 30 jours par rapport à sa plage.">
		<div class="group flex flex-wrap gap-2 p-4">
			{#if report.stable.length === 0}
				<p class="subhead text-label2">Pas encore assez de mesures pour juger la stabilité.</p>
			{:else}
				{#each report.stable as s (s.parameterId)}
					<a
						href="/aquariums/{s.aquariumId}/parametre/{s.parameterId}"
						class="footnote flex items-center gap-1.5 rounded-full bg-green/15 px-3 py-1.5 font-semibold text-green"
					>
						<Icon name="check" size={14} weight={3} />{s.parameterName}{several ? ` · ${s.aquariumName}` : ''}
					</a>
				{/each}
			{/if}
		</div>
	</Section>

	<!-- Points marquants -->
	<Section header="Points marquants" variant="title">
		{#if report.highlights.length === 0}
			<Row icon="flat" iconColor="var(--gray)" title="Semaine calme" subtitle="Rien de particulier à signaler." />
		{:else}
			{#each report.highlights as h (h)}
				<Row icon={highlightIcon(h)} iconColor={highlightIcon(h) === 'drop' ? 'var(--cyan)' : highlightIcon(h) === 'fish' ? 'var(--green)' : highlightIcon(h) === 'alert' ? 'var(--orange)' : 'var(--indigo)'}>
					<p class="body">{h}</p>
				</Row>
			{/each}
		{/if}
	</Section>

	<!-- Journal : changements d'eau, repas -->
	<Section header="Dans le bac" variant="title">
		<Row icon="drop" iconColor="var(--cyan)" title="Changements d’eau" value={report.waterChanges ? String(report.waterChanges) : 'Aucun'} />
		{#if report.feedings}
			<Row icon="fish" iconColor="var(--orange)" title="Repas" value={report.feedings.count ? String(report.feedings.count) : 'Aucun'} subtitle={several && report.feedings.perTank.length ? report.feedings.perTank.map((t) => `${t.name} : ${t.count}`).join(' · ') : undefined} />
		{/if}
	</Section>

	<!-- Photo du mois -->
	<Section header="Photo du mois" variant="title" inset={false}>
		{#if photo}
			<figure class="group relative overflow-hidden">
				<img src="/api/photos/{photo.id}" alt="Photo de {photo.tank}" class="aspect-[4/3] w-full object-cover" loading="lazy" />
				<figcaption class="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-white backdrop-blur-md">
					<span class="footnote min-w-0 flex-1 truncate font-semibold">{photo.caption ?? photo.tank}</span>
					{#if photo.takenOn}<span class="caption1 shrink-0 opacity-80">{new Date(`${photo.takenOn}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>{/if}
				</figcaption>
			</figure>
			{#if !photo.monthly && photo.takenOn}<p class="footnote mt-2 px-4 text-label2">Pas de photo ce mois-ci : voici la dernière.</p>{/if}
		{:else if photoLoaded}
			<div class="group flex flex-col items-center gap-2 px-6 py-8 text-center">
				<span class="grid h-12 w-12 place-items-center rounded-full bg-fill3 text-label2"><Icon name="camera" size={24} /></span>
				<p class="headline">Aucune photo</p>
				<p class="subhead text-label2">Une photo par mois permet de voir pousser les plantes et grandir les poissons.</p>
				{#if journalTarget != null}<a href="/aquariums/{journalTarget}/journal" class="btn-tinted mt-1">Ouvrir le journal</a>{/if}
			</div>
		{:else}
			<div class="group aspect-[4/3] animate-pulse bg-fill3"></div>
		{/if}
	</Section>

	<button class="btn-filled mb-4 w-full" onclick={share}><Icon name="up" size={20} weight={2.2} />Partager le bilan</button>
{/if}

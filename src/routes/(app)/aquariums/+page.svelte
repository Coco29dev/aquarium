<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { store } from '$lib/client/store.svelte';
	import { listResource } from '$lib/client/api';
	import { isProject, stageOf, tankHealth } from '$lib/tank';
	import { SHORT_WATER, TANK_ICON, TANK_TONE, fmt, tankAge } from '$lib/ui';
	import Icon from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import TankCard from '$lib/relief/TankCard.svelte';
	import Tile from '$lib/relief/Tile.svelte';
	import { tankFacts } from '$lib/relief/facts';
	import { contextMenu } from '$lib/ios/contextMenu';
	import type { Aquarium, ProjectItem } from '$lib/types';

	const view = $derived(store.view);
	const aquariums = $derived(view?.aquariums ?? []);
	const cards = $derived(view ? aquariums.map((a) => ({ aquarium: a, health: tankHealth(view, a) })) : []);
	const live = $derived(cards.filter((c) => !isProject(c.aquarium)));
	const projects = $derived(cards.filter((c) => isProject(c.aquarium)));
	const totalL = $derived(aquariums.filter((a) => !isProject(a)).reduce((sum, a) => sum + (a.volumeL ?? 0), 0));

	// Résumé des projets (éléments et total estimé) : chargé à la demande, connexion requise.
	let items = $state<Record<number, ProjectItem[]>>({});
	onMount(() => {
		for (const { aquarium } of projects) {
			listResource<ProjectItem>('project_items', aquarium.id)
				.then((list) => (items[aquarium.id] = list))
				.catch(() => {});
		}
	});
	const projectSummary = (id: number) => {
		const list = items[id];
		if (!list) return '';
		const equipment = list.filter((i) => i.kind === 'equipement');
		const total = equipment.reduce((sum, i) => sum + (i.amount ?? 0), 0);
		const wishes = list.filter((i) => i.kind === 'espece').length;
		const parts = [`${equipment.length} équipement${equipment.length > 1 ? 's' : ''}`];
		if (total > 0) parts.push(`${total.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`);
		if (wishes) parts.push(`${wishes} espèce${wishes > 1 ? 's' : ''}`);
		return parts.join(' · ');
	};

	const lastOf = (id: number) => {
		const list = (view?.measurements ?? []).filter((m) => m.parameterId === id);
		return list.length ? list[list.length - 1] : null;
	};
	/** Trois repères par bac : température, pH, nitrates (ceux qui existent). */
	const featured = (aquariumId: number) =>
		['temp', 'ph', 'no3']
			.map((k) => view?.parameters.find((p) => p.aquariumId === aquariumId && p.key === k))
			.filter((p): p is NonNullable<typeof p> => Boolean(p));

	// Appui long sur une carte : raccourcis vers les écrans du bac.
	const tankMenu = (a: Aquarium) => ({
		items: isProject(a)
			? [
					{ label: 'Ouvrir le projet', icon: 'outils' as const, onselect: () => goto(`/aquariums/${a.id}/projet`) },
					{ label: 'Simulateur de peuplement', icon: 'fish' as const, onselect: () => goto(`/aquariums/${a.id}/peuplement`) },
					{ label: 'Réglages', icon: 'gear' as const, onselect: () => goto(`/aquariums/${a.id}/reglages`) }
				]
			: [
					{ label: 'Ouvrir', icon: 'bacs' as const, onselect: () => goto(`/aquariums/${a.id}`) },
					{ label: 'Saisir des mesures', icon: 'drop' as const, onselect: () => goto(`/mesurer?bac=${a.id}`) },
					{ label: 'Tâches', icon: 'calendar' as const, onselect: () => goto(`/aquariums/${a.id}/taches`) },
					{ label: 'Journal', icon: 'note' as const, onselect: () => goto(`/aquariums/${a.id}/journal`) },
					{ label: 'Réglages', icon: 'gear' as const, onselect: () => goto(`/aquariums/${a.id}/reglages`) }
				]
	});
	const shortName = (key: string | null, name: string) =>
		key === 'temp' ? 'Temp.' : key === 'no3' ? 'Nitrates' : key === 'ph' ? 'pH' : name;

	function badge(a: Aquarium): { text: string; color: string } {
		const stage = stageOf(a);
		if (stage === 'projet') return { text: 'En projet', color: 'var(--orange)' };
		if (stage === 'cyclage') {
			const age = tankAge(a);
			return { text: age != null ? `En cyclage · jour ${age}` : 'En cyclage', color: 'var(--indigo)' };
		}
		return { text: 'Actif', color: 'var(--green)' };
	}
</script>

<svelte:head><title>Bacs · Biotope</title></svelte:head>

<NavBar title="Bacs" kicker={aquariums.length ? `${aquariums.length} bac${aquariums.length > 1 ? 's' : ''}${totalL ? ` · ${fmt(totalL, 0)} L` : ''}` : undefined}>
	{#snippet trailing()}
		<a href="/aquariums/nouveau" class="glass pressable grid h-9 w-9 place-items-center rounded-full text-tint" aria-label="Ajouter un bac">
			<Icon name="plus" size={20} weight={2.4} />
		</a>
	{/snippet}
</NavBar>

{#if aquariums.length === 0}
	<div class="mt-16 flex flex-col items-center px-6 text-center">
		<img src="/apple-touch-icon-180x180.png" alt="" class="mb-5 h-24 w-24 rounded-[22%] shadow-[0_10px_30px_rgb(6_50_63/0.35),0_1px_3px_rgb(0_0_0/0.12)]" style="animation: pop-in 520ms cubic-bezier(0.3, 0.8, 0.3, 1.15) both" />
		<h2 class="title2">Aucun bac</h2>
		<p class="subhead mt-1.5 text-label2">Ton bac est déjà en eau, en cyclage, ou encore à l’état de projet : je m’adapte à chaque cas.</p>
		<a href="/aquariums/nouveau" class="btn-filled mt-6">Ajouter un bac</a>
	</div>
{:else}
	{#if live.length}
		<h2 class="title3 mb-2.5 mt-2 px-1 font-bold">En eau</h2>
	{/if}
	<div class="mb-6 grid grid-cols-2 gap-3">
		{#each live as { aquarium, health: h }, i (aquarium.id)}
			{@const tone = TANK_TONE[aquarium.waterType]}
			{@const b = badge(aquarium)}
			{@const facts = view ? tankFacts(view, aquarium) : { big: null, stats: [] }}
			{#if i === 0}
				<div class="col-span-2 rise">
					<TankCard
						wide
						href="/aquariums/{aquarium.id}"
						name={aquarium.name}
						subtitle="{SHORT_WATER[aquarium.waterType]}{aquarium.volumeL ? ` · ${fmt(aquarium.volumeL, 0)} L` : ''}{stageOf(aquarium) === 'actif' && tankAge(aquarium) != null ? ` · jour ${tankAge(aquarium)}` : ''}"
						{tone}
						icon={TANK_ICON[aquarium.waterType]}
						coverPhotoId={aquarium.coverPhotoId}
						big={facts.big}
						stats={facts.stats}
						status={{ text: h.level === 'cycle' ? b.text : h.label, level: h.level, icon: h.level === 'ok' ? 'check' : h.level === 'cycle' ? 'cycle' : 'alert' }}
						feedFor={aquarium.id}
						menu={tankMenu(aquarium)}
					/>
				</div>
			{:else}
				<div class="reveal" use:contextMenu={tankMenu(aquarium)}>
					<Tile href="/aquariums/{aquarium.id}" {tone} variant="solid" mark={TANK_ICON[aquarium.waterType]} class="flex min-h-[11.5rem] flex-col">
						<div class="flex items-start gap-2">
							<div class="min-w-0 flex-1">
								<p class="headline truncate">{aquarium.name}</p>
								<p class="caption1 truncate text-white/80">{SHORT_WATER[aquarium.waterType]}{aquarium.volumeL ? ` · ${fmt(aquarium.volumeL, 0)} L` : ''}</p>
							</div>
						</div>
						<div class="mt-auto pt-5">
							{#if facts.big}
								<p class="rounded-num leading-none">
									<span class="text-[40px] font-bold tracking-tight">{facts.big.value}</span>
									<span class="subhead font-semibold text-white/80">{facts.big.unit}</span>
								</p>
							{/if}
							<p class="footnote mt-1.5 flex items-center gap-1.5 font-semibold">
								<Icon name={h.level === 'ok' ? 'check' : h.level === 'cycle' ? 'cycle' : 'alert'} size={14} weight={2.6} />
								<span class="truncate">{h.level === 'cycle' ? b.text : h.label}</span>
							</p>
							{#if h.due.length}<p class="caption1 mt-0.5 text-white/80">{h.due.length} à faire</p>{/if}
						</div>
					</Tile>
				</div>
			{/if}
		{/each}
	</div>

	{#if projects.length}
		<Section header="Projets" variant="title" inset={false}>
			<div class="flex flex-col gap-3">
				{#each projects as { aquarium } (aquarium.id)}
					{@const tone = TANK_TONE[aquarium.waterType]}
					<a
						href="/aquariums/{aquarium.id}/projet"
						class="pressable raised block border-[1.5px] border-dashed border-label3 p-4"
						use:contextMenu={tankMenu(aquarium)}
					>
						<div class="flex items-center gap-2" style="color: {tone}">
							<Icon name="outils" size={20} weight={1.9} />
							<span class="headline min-w-0 flex-1 truncate text-label">{aquarium.name}</span>
							<span class="footnote shrink-0 rounded-full bg-orange/15 px-2 py-0.5 font-semibold text-orange">En projet</span>
							<span class="text-label3"><Icon name="next" size={16} weight={2.4} /></span>
						</div>
						<p class="footnote mt-0.5 text-label2">{SHORT_WATER[aquarium.waterType]}{aquarium.volumeL ? ` · ${fmt(aquarium.volumeL, 0)} L visés` : ''}</p>
						<p class="subhead mt-3 text-label2">{projectSummary(aquarium.id) || 'Matériel, budget et espèces à préparer.'}</p>
					</a>
				{/each}
			</div>
		</Section>
	{/if}

	<a href="/aquariums/nouveau" class="pressable flex items-center gap-3 rounded-[22px] border-[1.5px] border-dashed border-label3 px-4 py-3.5 text-tint">
		<span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-tint/12"><Icon name="plus" size={22} weight={2.4} /></span>
		<span class="min-w-0 flex-1">
			<span class="headline block">Ajouter un bac</span>
			<span class="footnote block text-label2">En eau, en cyclage ou en projet</span>
		</span>
	</a>
{/if}

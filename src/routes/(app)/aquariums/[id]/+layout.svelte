<script lang="ts">
	import { untrack } from 'svelte';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { goBack } from '$lib/client/nav';
	import { stageOf } from '$lib/tank';
	import { SHORT_WATER, fmt, tankAge } from '$lib/ui';
	import Icon from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import TankTabs, { type TankTab } from '$lib/ios/TankTabs.svelte';
	import { tankHeader } from '$lib/ios/tankHeader.svelte';
	import Overview from '$lib/tank/Overview.svelte';
	import Tasks from '$lib/tank/Tasks.svelte';
	import Living from '$lib/tank/Living.svelte';
	import Journal from '$lib/tank/Journal.svelte';

	let { children } = $props();

	/**
	 * Bandeau commun aux quatre onglets du bac (Suivi · Tâches · Vivants · Journal) : photo de
	 * couverture, titre et contrôle segmenté restent en place, seul le contenu change dessous.
	 * Les sous-écrans (réglages, projet, paramètre…) gardent leur propre barre.
	 */
	const id = $derived(Number(page.params.id));
	const PATHS: Record<TankTab, string> = { suivi: '', taches: '/taches', vivants: '/inventaire', journal: '/journal' };
	const TITLES: Record<TankTab, string> = { suivi: 'Suivi', taches: 'Tâches', vivants: 'Vivants', journal: 'Journal' };
	const tabOfPath = (pathname: string): TankTab | null => {
		const sub = pathname.replace(/\/$/, '').slice(`/aquariums/${id}`.length);
		return (Object.keys(PATHS) as TankTab[]).find((t) => PATHS[t] === sub) ?? null;
	};

	// Un seul écran : changer d'onglet ne navigue pas, il remplace le contenu sous le bandeau.
	// L'adresse suit (replaceState) pour que le lien, l'actualisation et les notifications retombent au bon endroit.
	let tab = $state<TankTab | null>(tabOfPath(page.url.pathname));
	/** Onglets déjà ouverts : gardés en vie (masqués) pour un retour instantané, sans recharger. */
	let opened = $state<TankTab[]>([]);
	$effect(() => {
		// Navigation classique vers un onglet (lien, bouton retour, notification) : on s'aligne sur l'adresse.
		const next = tabOfPath(page.url.pathname);
		// untrack : seul un changement d'adresse réaligne l'onglet (pas le choix qu'on vient de faire).
		if (next !== untrack(() => tab)) tab = next;
	});
	$effect(() => {
		if (tab && !opened.includes(tab)) opened = [...opened, tab];
	});
	function select(next: TankTab) {
		tab = next;
		replaceState(`/aquariums/${id}${PATHS[next]}`, page.state);
		if (scrollY > 0) window.scrollTo({ top: 0 });
	}
	const aquarium = $derived(store.view?.aquariums.find((a) => a.id === id));
	// Un bac en projet n'a pas de suivi : l'écran de projet prend le relais.
	const shown = $derived(Boolean(aquarium && tab && stageOf(aquarium) !== 'projet'));

	const cover = $derived(aquarium?.coverPhotoId ?? null);
	let scrollY = $state(0);
	let heroH = $state(0);
	$effect(() => {
		const update = () => (scrollY = window.scrollY);
		update();
		addEventListener('scroll', update, { passive: true });
		return () => removeEventListener('scroll', update);
	});
	const past = $derived(heroH > 0 && scrollY > heroH - 100);

	// Un bac en projet n'a pas de suivi : l'écran de projet prend le relais.
	$effect(() => {
		if (aquarium && tab && stageOf(aquarium) === 'projet') void goto(`/aquariums/${id}/projet`, { replaceState: true });
	});

	const kicker = $derived(
		aquarium
			? [SHORT_WATER[aquarium.waterType], aquarium.volumeL ? `${fmt(aquarium.volumeL, 0)} L` : null, tankAge(aquarium) != null ? `jour ${tankAge(aquarium)}` : null]
					.filter(Boolean)
					.join(' · ')
			: undefined
	);
	const back = (e: MouseEvent) => {
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
		e.preventDefault();
		goBack('/aquariums');
	};
</script>

{#if shown && aquarium && tab}
	{#if cover != null}
		<!-- Barre posée sur la photo : boutons de verre, puis verre et titre compact une fois la photo passée. -->
		<div
			class="bar-glass waterline fixed inset-x-0 top-0 z-20 mx-auto max-w-md"
			data-scrolled={past ? '' : undefined}
			style="padding-top: env(safe-area-inset-top)"
		>
			<div class="grid h-11 grid-cols-[1fr_auto_1fr] items-center px-3">
				<a
					href="/aquariums"
					data-nav="pop"
					onclick={back}
					class="pressable grid h-11 w-11 place-items-center justify-self-start rounded-full {past ? 'text-tint' : 'glass text-label'}"
					aria-label="Retour"
				>
					<Icon name="back" size={22} weight={2.4} />
				</a>
				<p class="headline max-w-[56vw] truncate transition-opacity duration-200 {past ? 'opacity-100' : 'opacity-0'}">{aquarium.name}</p>
				<div class="flex items-center gap-2 justify-self-end">
					<a href="/assistant?bac={id}" class="pressable grid h-11 w-11 place-items-center rounded-full {past ? 'text-tint' : 'glass text-label'}" aria-label="Assistant">
						<Icon name="chat" size={21} />
					</a>
					<a href="/aquariums/{id}/reglages" class="pressable grid h-11 w-11 place-items-center rounded-full {past ? 'text-tint' : 'glass text-label'}" aria-label="Réglages du bac">
						<Icon name="ellipsis" size={22} />
					</a>
				</div>
			</div>
		</div>
		<div class="relative -mx-4 overflow-hidden bg-black" style="height: 42dvh; min-height: 260px" bind:clientHeight={heroH}>
			<img
				src="/api/photos/{cover}"
				alt=""
				class="absolute inset-0 h-full w-full object-cover"
				style="transform: translateY({Math.max(0, scrollY) * 0.4}px) scale({1 + Math.max(0, -scrollY) / 400}); transform-origin: top"
				draggable="false"
			/>
			<div class="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/65"></div>
			<div class="absolute inset-x-4 bottom-4 text-white">
				{#if kicker}<p class="footnote font-semibold uppercase text-white/80">{kicker}</p>{/if}
				<h1 class="large-title break-words drop-shadow-[0_1px_8px_rgb(0_0_0/0.35)]">{aquarium.name}</h1>
			</div>
		</div>
		<div class="mt-3"><TankTabs {aquarium} {tab} onselect={select} /></div>
	{:else}
		<NavBar title={aquarium.name} back={{ href: '/aquariums', label: 'Bacs' }} {kicker}>
			{#snippet trailing()}
				<div class="flex items-center gap-2 pr-2">
					<a href="/assistant?bac={id}" class="glass pressable grid h-11 w-11 place-items-center rounded-full text-tint" aria-label="Assistant">
						<Icon name="chat" size={21} />
					</a>
					<a href="/aquariums/{id}/reglages" class="glass pressable grid h-11 w-11 place-items-center rounded-full text-tint" aria-label="Réglages du bac">
						<Icon name="ellipsis" size={22} />
					</a>
				</div>
			{/snippet}
			<TankTabs {aquarium} {tab} onselect={select} />
		</NavBar>
	{/if}

	{#if tankHeader.actions}
		<div class="mt-3 flex items-center justify-end gap-2">{@render tankHeader.actions()}</div>
	{/if}
{/if}

<svelte:head><title>{tab ? `${TITLES[tab]} · ${aquarium?.name ?? 'Bac'} · Biotope` : 'Bac · Biotope'}</title></svelte:head>

{#if tab}
	{#key id}
	{#each opened as t (t)}
		<div class="tank-panel" hidden={t !== tab}>
			{#if t === 'suivi'}<Overview />{:else if t === 'taches'}<Tasks active={tab === 'taches'} />{:else if t === 'vivants'}<Living />{:else}<Journal active={tab === 'journal'} />{/if}
		</div>
	{/each}
	{/key}
{:else}
	{@render children()}
{/if}

<style>
	.tank-panel:not([hidden]) {
		/* « backwards » seulement : une animation qui reste active crée un contexte d'empilement et
		   passerait les feuilles (Sheet) de l'onglet sous la barre de navigation. */
		animation: fade-in 180ms ease-out backwards;
	}
	@media (prefers-reduced-motion: reduce) {
		.tank-panel:not([hidden]) {
			animation: none;
		}
	}
</style>

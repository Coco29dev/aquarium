<script lang="ts">
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { registerServiceWorker } from '$lib/push-client';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import Banner from '$lib/ios/Banner.svelte';
	import AlertHost from '$lib/ios/AlertHost.svelte';

	let { children } = $props();

	onMount(() => {
		// Safari sait dessiner un vrai interrupteur iOS (avec retour haptique) : on le laisse faire.
		if ('switch' in HTMLInputElement.prototype) document.documentElement.classList.add('native-switch');
		// Le service worker rend l'appli disponible hors ligne et reçoit les push.
		if ('serviceWorker' in navigator) void registerServiceWorker().catch(() => {});
		void store.init();
		// Une tâche cochée juste avant de quitter l'appli est envoyée sans attendre.
		const flush = () => ui.flush();
		addEventListener('pagehide', flush);
		return () => removeEventListener('pagehide', flush);
	});

	const ROOTS = ['/', '/aquariums', '/outils', '/reglages'];
	/** Écrans présentés en feuille plein écran : pas de barre d'onglets, entrée par le bas. */
	const isModal = (path: string) => path.startsWith('/mesurer') || path === '/aquariums/nouveau';
	const depth = (path: string) => path.split('/').filter(Boolean).length;

	/** Sens de l'animation, façon UINavigationController : empile, dépile, change d'onglet, modale. */
	function direction(from: string, to: string, popstate: boolean, delta: number): string {
		if (isModal(to)) return 'modal';
		if (isModal(from)) return 'dismiss';
		if (ROOTS.includes(from) && ROOTS.includes(to)) return 'tab';
		if (popstate) return delta > 0 ? 'push' : 'pop';
		if (depth(to) > depth(from)) return 'push';
		if (depth(to) < depth(from)) return 'pop';
		return 'tab';
	}

	let lastBack = false;
	onMount(() => {
		// Un lien « retour » (data-nav="pop") force l'animation de dépilement.
		const onClick = (e: MouseEvent) => {
			lastBack = Boolean((e.target as Element | null)?.closest?.('[data-nav="pop"]'));
		};
		addEventListener('click', onClick, true);
		return () => removeEventListener('click', onClick, true);
	});

	onNavigate((navigation) => {
		if (!document.startViewTransition || !navigation.from || !navigation.to) return;
		const from = navigation.from.url.pathname;
		const to = navigation.to.url.pathname;
		if (from === to) return;
		let kind = direction(from, to, navigation.type === 'popstate', navigation.delta ?? -1);
		if (lastBack && kind !== 'dismiss') kind = 'pop';
		lastBack = false;
		document.documentElement.dataset.nav = kind;
		return new Promise((resolve) => {
			const transition = document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
				if (kind !== 'modal' && kind !== 'dismiss') window.scrollTo(0, 0);
			});
			transition.finished.finally(() => delete document.documentElement.dataset.nav);
		});
	});

	const tabs: { href: string; label: string; icon: IconName }[] = [
		{ href: '/', label: "Aujourd'hui", icon: 'today' },
		{ href: '/aquariums', label: 'Bacs', icon: 'bacs' },
		{ href: '/outils', label: 'Atelier', icon: 'outils' },
		{ href: '/reglages', label: 'Réglages', icon: 'gear' }
	];

	function active(href: string): boolean {
		const path = page.url.pathname;
		if (href === '/') return path === '/';
		if (href === '/outils') return ['/outils', '/especes', '/depenses'].some((p) => path.startsWith(p));
		return path.startsWith(href);
	}
	const modal = $derived(isModal(page.url.pathname));
</script>

<div class="mx-auto flex min-h-dvh max-w-md flex-col">
	<main class="flex-1 px-4 {modal ? 'pb-10' : 'pb-32'}">
		{#if store.view}
			{@render children()}
		{:else}
			<div class="grid min-h-[70dvh] place-items-center text-center">
				{#if store.loaded && !store.syncing}
					<p class="subhead max-w-64 text-label2">Aucune donnée en mémoire et pas de connexion. Ouvre l'appli une première fois en ligne.</p>
				{:else}
					<span class="h-7 w-7 animate-spin rounded-full border-[3px] border-fill border-t-label2" aria-label="Chargement"></span>
				{/if}
			</div>
		{/if}
	</main>

	{#if !modal}
		<!-- Barre d'onglets iOS 26 : capsule de verre flottante, bouton d'action rond à part. -->
		<nav
			class="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-end justify-center gap-3 px-4"
			style="padding-bottom: max(10px, calc(env(safe-area-inset-bottom) - 6px))"
			aria-label="Navigation principale"
		>
			<ul class="glass pointer-events-auto flex flex-1 items-center rounded-full p-1" style="--cut: var(--bg2); view-transition-name: tabbar">
				{#each tabs as tab (tab.href)}
					{@const on = active(tab.href)}
					<li class="flex-1">
						<a
							href={tab.href}
							aria-current={on ? 'page' : undefined}
							class="flex h-[54px] flex-col items-center justify-center gap-0.5 rounded-full transition-colors duration-200 {on ? 'bg-fill3 text-tint' : 'text-label'}"
						>
							<Icon name={tab.icon} size={25} filled={on} weight={1.7} />
							<span class="text-[10px] font-semibold leading-none tracking-normal">{tab.label}</span>
						</a>
					</li>
				{/each}
			</ul>
			<a
				href="/mesurer"
				class="glass pressable pointer-events-auto grid h-[62px] w-[62px] shrink-0 place-items-center rounded-full text-tint"
				style="view-transition-name: tabaction"
				aria-label="Saisir des mesures"
			>
				<Icon name="plus" size={28} weight={2.4} />
			</a>
		</nav>
	{/if}

	{#if store.pending.length || store.error}
		<p
			class="caption1 pointer-events-none fixed left-1/2 z-30 -translate-x-1/2 rounded-full px-3 py-1 font-semibold {store.error ? 'bg-red text-white' : 'glass text-label2'}"
			style="bottom: calc(max(10px, env(safe-area-inset-bottom) - 6px) + 72px)"
			role="status"
		>
			{store.error || `${store.pending.length} saisie${store.pending.length > 1 ? 's' : ''} en attente d'envoi`}
		</p>
	{/if}

	<Banner />
	<AlertHost />
</div>

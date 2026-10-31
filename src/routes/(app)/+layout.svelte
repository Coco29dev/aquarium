<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate, goto, onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { registerServiceWorker } from '$lib/push-client';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import Banner from '$lib/ios/Banner.svelte';
	import AlertHost from '$lib/ios/AlertHost.svelte';
	import ContextMenuHost from '$lib/ios/ContextMenuHost.svelte';
	import Spinner from '$lib/ios/Spinner.svelte';
	import { contextMenuState } from '$lib/ios/contextMenuState.svelte';
	import { dueTasks } from '$lib/domain/tasks';

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

	const ROOTS = ['/', '/aquariums', '/encyclopedie', '/outils', '/reglages'];
	/** Écrans présentés en feuille plein écran : pas de barre d'onglets, entrée par le bas. */
	const isModal = (path: string) =>
		path.startsWith('/mesurer') || path === '/aquariums/nouveau' || path.startsWith('/bienvenue') || path.startsWith('/assistant');
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
		// Retour par glissement du bord : l'écran est déjà parti, pas de seconde animation.
		if (skipTransition) {
			skipTransition = false;
			return;
		}
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
		{ href: '/encyclopedie', label: 'Encyclo', icon: 'book' },
		{ href: '/outils', label: 'Atelier', icon: 'outils' },
		{ href: '/reglages', label: 'Réglages', icon: 'gear' }
	];

	function active(href: string): boolean {
		const path = page.url.pathname;
		if (href === '/') return path === '/';
		if (href === '/outils') return ['/outils', '/depenses'].some((p) => path.startsWith(p));
		return path.startsWith(href);
	}
	const modal = $derived(isModal(page.url.pathname));
	const root = $derived(ROOTS.includes(page.url.pathname));

	// --- Pastille de l'icône : tâches du jour encore à faire ---------------------------------
	$effect(() => {
		const view = store.view;
		if (!view) return;
		const count = dueTasks(view.tasks).filter((t) => !ui.checking[t.id]).length;
		const nav = navigator as Navigator & {
			setAppBadge?: (n: number) => Promise<void>;
			clearAppBadge?: () => Promise<void>;
		};
		try {
			const done = count ? nav.setAppBadge?.(count) : nav.clearAppBadge?.();
			done?.catch(() => {});
		} catch {
			// Pastille non prise en charge (navigateur, appli non installée).
		}
	});

	// --- Hors ligne ---------------------------------------------------------------------
	let online = $state(true);
	onMount(() => {
		online = navigator.onLine;
		const update = () => (online = navigator.onLine);
		addEventListener('online', update);
		addEventListener('offline', update);
		return () => {
			removeEventListener('online', update);
			removeEventListener('offline', update);
		};
	});

	// --- Premier lancement : accueil guidé ---------------------------------------------------
	$effect(() => {
		const view = store.view;
		if (!view || view.aquariums.length) return;
		const path = page.url.pathname;
		if (path.startsWith('/bienvenue') || path === '/aquariums/nouveau') return;
		let onboarded = true;
		try {
			onboarded = localStorage.getItem('onboarded') === '1';
		} catch {
			// Sans stockage, on ne réaffiche pas l'accueil à chaque ouverture.
		}
		if (!onboarded) void goto('/bienvenue', { replaceState: true });
	});

	// --- Gestes : tirer pour synchroniser, glisser du bord gauche pour revenir ---------------
	const PULL_THRESHOLD = 70;
	let pull = $state(0);
	let pulling = $state(false);
	let refreshing = $state(false);
	let edge = $state(0);
	let edging = $state(false);
	let skipTransition = false;

	/** iOS dans Safari (non installé) a déjà son propre geste de retour : on ne le double pas. */
	function nativeBackGesture(): boolean {
		const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
		const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
		return ios && !standalone;
	}

	const blocked = () => Boolean(contextMenuState.open || ui.alert || document.body.style.overflow === 'hidden');

	onMount(() => {
		let startX = 0;
		let startY = 0;
		let lastX = 0;
		let lastT = 0;
		let speed = 0;
		let mode: 'pull' | 'edge' | null = null;

		function start(e: TouchEvent) {
			if (e.touches.length !== 1 || refreshing || blocked()) return;
			const t = e.touches[0];
			startX = lastX = t.clientX;
			startY = t.clientY;
			lastT = performance.now();
			speed = 0;
			const path = location.pathname;
			mode = null;
			if (!ROOTS.includes(path) && !isModal(path) && t.clientX <= 24 && history.length > 1 && !nativeBackGesture()) {
				mode = 'edge';
				edging = true;
			} else if (ROOTS.includes(path) && window.scrollY <= 0) {
				mode = 'pull';
			}
		}

		function move(e: TouchEvent) {
			if (!mode) return;
			const t = e.touches[0];
			const now = performance.now();
			speed = (t.clientX - lastX) / Math.max(1, now - lastT);
			lastX = t.clientX;
			lastT = now;
			if (mode === 'edge') {
				edge = Math.max(0, t.clientX - startX);
				if (edge > 4) e.preventDefault();
				return;
			}
			const dy = t.clientY - startY;
			if (window.scrollY > 0 || dy <= 0) {
				if (!pulling) mode = dy < 0 ? null : mode;
				pull = 0;
				return;
			}
			if (Math.abs(t.clientX - startX) > dy && !pulling) {
				mode = null;
				return;
			}
			pulling = true;
			// Résistance croissante, comme UIScrollView.
			pull = Math.min(150, dy * 0.55 - (dy * dy) / 6000);
			e.preventDefault();
		}

		async function end() {
			if (mode === 'edge') {
				mode = null;
				const width = innerWidth;
				if (edge > width * 0.35 || (speed > 0.5 && edge > 30)) {
					edge = width;
					edging = false;
					setTimeout(() => {
						skipTransition = true;
						history.back();
					}, 230);
				} else {
					edging = false;
					edge = 0;
				}
				return;
			}
			if (mode !== 'pull') return;
			mode = null;
			pulling = false;
			if (pull >= PULL_THRESHOLD) {
				refreshing = true;
				pull = 56;
				try {
					await store.sync();
				} finally {
					// Laisse voir la fin de la rotation un instant, comme iOS.
					setTimeout(() => {
						refreshing = false;
						pull = 0;
					}, 350);
				}
			} else {
				pull = 0;
			}
		}

		addEventListener('touchstart', start, { passive: true });
		addEventListener('touchmove', move, { passive: false });
		addEventListener('touchend', end);
		addEventListener('touchcancel', end);
		return () => {
			removeEventListener('touchstart', start);
			removeEventListener('touchmove', move);
			removeEventListener('touchend', end);
			removeEventListener('touchcancel', end);
		};
	});

	// Nouvel écran affiché : remet en place celui qu'on avait fait glisser.
	afterNavigate(() => {
		edging = true;
		edge = 0;
		requestAnimationFrame(() => (edging = false));
	});

	const mainStyle = $derived.by(() => {
		if (edge) {
			return `transform: translateX(${edge}px); box-shadow: -10px 0 30px rgb(0 0 0 / 0.18); transition: ${edging ? 'none' : 'transform 260ms cubic-bezier(0.25, 0.9, 0.3, 1)'}`;
		}
		if (pull) return `transform: translateY(${pull}px); transition: ${pulling ? 'none' : 'transform 380ms cubic-bezier(0.25, 0.9, 0.3, 1)'}`;
		return `transition: transform 380ms cubic-bezier(0.25, 0.9, 0.3, 1)`;
	});
</script>

<div class="mx-auto flex min-h-dvh max-w-md flex-col">
	{#if root && (pull > 0 || refreshing)}
		<div
			class="pointer-events-none fixed inset-x-0 z-10 flex justify-center"
			style="top: calc(env(safe-area-inset-top) + {Math.max(0, pull / 2 - 13)}px); opacity: {refreshing ? 1 : Math.min(1, pull / 40)}"
			aria-hidden={!refreshing}
			role="status"
			aria-label="Synchronisation"
		>
			<Spinner progress={Math.min(1, pull / PULL_THRESHOLD)} spinning={refreshing} />
		</div>
	{/if}

	<main class="relative flex-1 bg-bg px-4 {modal ? 'pb-10' : 'pb-32'}" style={mainStyle}>
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

	{#if !online || store.pending.length || store.error}
		<p
			class="caption1 pointer-events-none fixed left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 font-semibold {online && store.error ? 'bg-red text-white' : 'glass text-label2'}"
			style="bottom: calc(max(10px, env(safe-area-inset-bottom) - 6px) + {modal ? 12 : 72}px)"
			role="status"
		>
			{#if !online}
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
					<path d="M2.5 9a14 14 0 0 1 4.6-2.8M10.5 5.6A14 14 0 0 1 21.5 9M5.5 12.4a9.5 9.5 0 0 1 3-1.8M14.6 10.5a9.5 9.5 0 0 1 3.9 1.9M8.8 15.6a4.8 4.8 0 0 1 6.4 0" />
					<circle cx="12" cy="19" r="1.1" fill="currentColor" stroke="none" />
					<path d="M3.5 3.5l17 17" />
				</svg>
				Hors ligne{store.pending.length ? ` · ${store.pending.length} en attente` : ''}
			{:else if store.error}
				{store.error}
			{:else}
				<Spinner size={14} spinning />
				{store.pending.length} saisie{store.pending.length > 1 ? 's' : ''} en cours d'envoi
			{/if}
		</p>
	{/if}

	<Banner />
	<ContextMenuHost />
	<AlertHost />
</div>

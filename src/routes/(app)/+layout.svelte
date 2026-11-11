<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { afterNavigate, goto, onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { recordScreen } from '$lib/client/nav';
	import { ui } from '$lib/client/ui.svelte';
	import { tour } from '$lib/client/tour.svelte';
	import { shouldAutoStartTour } from '$lib/domain/onboarding';
	import { registerServiceWorker } from '$lib/push-client';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import Banner from '$lib/ios/Banner.svelte';
	import AlertHost from '$lib/ios/AlertHost.svelte';
	import ContextMenuHost from '$lib/ios/ContextMenuHost.svelte';
	import Tour from '$lib/ios/Tour.svelte';
	import Spinner from '$lib/ios/Spinner.svelte';
	import Skeleton from '$lib/ios/Skeleton.svelte';
	import EmptyState from '$lib/art/EmptyState.svelte';
	import { contextMenuState } from '$lib/ios/contextMenuState.svelte';
	import { dueTasks } from '$lib/domain/tasks';
	import { beginTransition } from '$lib/motion/vt';
	import { reducedMotion } from '$lib/motion/reduced';
	import { haptic } from '$lib/motion/haptic';
	import { hideBoot } from '$lib/motion/boot';
	import { presence } from '$lib/motion/presence.svelte';

	let { children } = $props();

	onMount(() => {
		// Safari sait dessiner un vrai interrupteur iOS (avec retour haptique) : on le laisse faire.
		if ('switch' in HTMLInputElement.prototype) document.documentElement.classList.add('native-switch');
		// Le service worker rend l'appli disponible hors ligne et reçoit les push.
		if ('serviceWorker' in navigator) void registerServiceWorker().catch(() => {});
		void store.init();
		void ui.loadProfile();
		void tour.load();
		// Une tâche cochée juste avant de quitter l'appli est envoyée sans attendre.
		const flush = () => ui.flush();
		addEventListener('pagehide', flush);
		return () => removeEventListener('pagehide', flush);
	});

	const ROOTS = ['/', '/aquariums', '/encyclopedie', '/reglages'];
	/** Écrans présentés en feuille plein écran : pas de barre d'onglets, entrée par le bas. */
	const isModal = (path: string) =>
		path.startsWith('/mesurer') || path === '/aquariums/nouveau' || path.startsWith('/bienvenue') || path.startsWith('/assistant');
	const depth = (path: string) => path.split('/').filter(Boolean).length;

	const tabs: { href: string; label: string; icon: IconName; tour: string }[] = [
		{ href: '/', label: 'Aujourd’hui', icon: 'today', tour: 'aujourdhui' },
		{ href: '/aquariums', label: 'Bacs', icon: 'bacs', tour: 'bacs' },
		{ href: '/encyclopedie', label: 'Savoir', icon: 'book', tour: 'savoir' },
		{ href: '/reglages', label: 'Plus', icon: 'gear', tour: 'plus' }
	];

	/** L'onglet d'un chemin : les écrans de « Plus » (calculateurs, dépenses) en font partie. */
	function isActive(href: string, path: string): boolean {
		if (href === '/') return path === '/';
		if (href === '/reglages') return ['/reglages', '/outils', '/depenses'].some((p) => path.startsWith(p));
		return path.startsWith(href);
	}
	const tabIndex = (path: string) => tabs.findIndex((t) => isActive(t.href, path));

	/** Sens de l'animation, façon UINavigationController : empile, dépile, change d'onglet, modale. */
	function direction(from: string, to: string, popstate: boolean, delta: number): string {
		if (isModal(to)) return 'modal';
		if (isModal(from)) return 'dismiss';
		if (ROOTS.includes(from) && ROOTS.includes(to)) return 'tab';
		// Les écrans de « Plus » (calculateurs, dépenses, bilan) sont au même niveau d'URL que les onglets.
		if (ROOTS.includes(from)) return 'push';
		if (ROOTS.includes(to)) return 'pop';
		if (popstate) return delta > 0 ? 'push' : 'pop';
		if (depth(to) > depth(from)) return 'push';
		if (depth(to) < depth(from)) return 'pop';
		return 'tab';
	}

	let lastBack = false;
	/** Retour par glissement du bord : l'écran est déjà parti, pas de seconde animation. */
	let skipTransition = false;
	onMount(() => {
		// Un lien « retour » (data-nav="pop") force l'animation de dépilement.
		const onClick = (e: MouseEvent) => {
			lastBack = Boolean((e.target as Element | null)?.closest?.('[data-nav="pop"]'));
		};
		addEventListener('click', onClick, true);
		return () => removeEventListener('click', onClick, true);
	});

	onNavigate((navigation) => {
		if (skipTransition) {
			skipTransition = false;
			return;
		}
		// Pas de transition animée sans l'API, ni avec « Réduire les animations » : SvelteKit change d'écran directement.
		if (!document.startViewTransition || reducedMotion() || !navigation.from || !navigation.to) return;
		const from = navigation.from.url.pathname;
		const to = navigation.to.url.pathname;
		if (from === to) return;
		let kind = direction(from, to, navigation.type === 'popstate', navigation.delta ?? -1);
		if (lastBack && kind !== 'dismiss') kind = 'pop';
		lastBack = false;
		// Changement d'onglet : la page dérive dans le sens du déplacement (1 vers la droite, -1 vers la gauche).
		const vars: Record<string, string> = kind === 'tab' ? { '--dir': String(Math.sign(tabIndex(to) - tabIndex(from)) || 1) } : {};
		return new Promise<void>((resolve) => {
			beginTransition(
				kind,
				async () => {
					resolve();
					try {
						await navigation.complete;
					} catch {
						// Navigation abandonnée (nouvel appui plus rapide) : la transition suivante prend le relais.
						return;
					}
					if (kind !== 'modal' && kind !== 'dismiss') window.scrollTo(0, 0);
				},
				vars
			);
		});
	});

	const activeIndex = $derived(tabIndex(page.url.pathname));
	// Sur un écran qui n'est dans aucun onglet, la pilule reste (invisible) où elle était : pas de glissement parasite.
	let rememberedTab = 0;
	const pillIndex = $derived.by(() => {
		if (activeIndex >= 0) rememberedTab = activeIndex;
		return rememberedTab;
	});
	const modal = $derived(isModal(page.url.pathname));

	/** Bulle de l'assistant : ouvre le chat du bac affiché, sinon du dernier bac utilisé. */
	const bubbleHref = $derived.by(() => {
		const onTank = /^\/aquariums\/(\d+)/.exec(page.url.pathname);
		return onTank ? `/assistant?bac=${onTank[1]}` : '/assistant';
	});
	/**
	 * La bulle n'apparaît que là où elle n'est pas déjà proposée : l'en-tête d'un bac (onglets Suivi,
	 * Tâches, Vivants, Journal) et l'écran « Plus » ont leur propre accès à l'assistant, et elle y
	 * recouvrirait des valeurs et des boutons. Idem pour tous les sous-écrans de réglages : leurs
	 * interrupteurs et chevrons sont alignés à droite, juste là où se pose la bulle.
	 */
	const showBubble = $derived(
		!/^\/aquariums\/\d+(\/(taches|inventaire|journal))?\/?$/.test(page.url.pathname) && !page.url.pathname.startsWith('/reglages')
	);
	// Pendant le défilement, la bulle se range sur le bord pour ne rien masquer ; elle revient dès que le doigt se repose.
	let scrolling = $state(false);
	onMount(() => {
		let timer: ReturnType<typeof setTimeout>;
		const onScroll = () => {
			scrolling = true;
			clearTimeout(timer);
			timer = setTimeout(() => (scrolling = false), 600);
		};
		addEventListener('scroll', onScroll, { passive: true });
		return () => {
			removeEventListener('scroll', onScroll);
			clearTimeout(timer);
		};
	});
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

	// Pastille d'état : hors ligne (avec le nombre de saisies gardées), envoi en cours, erreur, puis « Tout est envoyé »
	// pendant 2 s quand la file se vide en ligne (pas de bannière à chaque bascule du réseau).
	type Pill = { kind: 'offline' | 'error' | 'sending' | 'sent'; text: string };
	let sentFlash = $state(false);
	let previousPending = 0;
	let flashTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const count = store.pending.length;
		if (previousPending > 0 && count === 0 && untrack(() => online)) {
			sentFlash = true;
			clearTimeout(flashTimer);
			flashTimer = setTimeout(() => (sentFlash = false), 2000);
		}
		previousPending = count;
	});
	onMount(() => () => clearTimeout(flashTimer));
	const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
	const pill = $derived.by<Pill | null>(() => {
		const count = store.pending.length;
		if (!online) {
			return { kind: 'offline', text: `Hors ligne${count ? ` · ${plural(count, 'saisie gardée', 'saisies gardées')}` : ''}` };
		}
		if (store.error) return { kind: 'error', text: store.error };
		if (count) return { kind: 'sending', text: `${plural(count, 'saisie', 'saisies')} en cours d’envoi` };
		if (sentFlash) return { kind: 'sent', text: 'Tout est envoyé' };
		return null;
	});
	// La pastille garde son dernier texte le temps de sa sortie.
	let lastPill = $state<Pill | null>(null);
	$effect(() => {
		if (pill) lastPill = pill;
	});
	const pillView = presence(() => pill !== null, 200);
	const shownPill = $derived(pill ?? lastPill);

	// Le voile de démarrage (app.html) s'efface dès que les données locales sont lues.
	$effect(() => {
		if (store.loaded) hideBoot();
	});

	// Attente des données : rien pendant 150 ms (le cache local répond presque toujours avant), puis le squelette
	// de l'écran (le rond d'attente sur une feuille plein écran, où l'on ne dessine pas un fond d'écran).
	let lateLoading = $state(false);
	onMount(() => {
		const timer = setTimeout(() => (lateLoading = true), 150);
		return () => clearTimeout(timer);
	});

	// --- Premier lancement : accueil guidé, puis visite guidée -------------------------------
	// L'état (accueil vu, visite faite) suit le compte : il vient du serveur, la copie locale sert hors ligne.
	$effect(() => {
		const view = store.view;
		if (!view || !tour.loaded) return;
		tour.resolve(view.aquariums.length);
		const path = page.url.pathname;
		if (!tour.state.welcomeDone) {
			if (!view.aquariums.length && !path.startsWith('/bienvenue') && path !== '/aquariums/nouveau') void goto('/bienvenue', { replaceState: true });
			return;
		}
		if (tour.active || !shouldAutoStartTour(tour.state, path)) return;
		// Laisse l'écran d'arrivée se dessiner avant de poser la carte par-dessus.
		const timer = setTimeout(() => {
			if (!tour.active && shouldAutoStartTour(tour.state, location.pathname)) tour.start();
		}, 700);
		return () => clearTimeout(timer);
	});

	// --- Gestes : tirer pour synchroniser, glisser du bord gauche pour revenir ---------------
	const PULL_THRESHOLD = 70;
	let pull = $state(0);
	let pulling = $state(false);
	let refreshing = $state(false);
	let edge = $state(0);
	let edging = $state(false);
	/** Arme ou désarme l'écoute du tirer-pour-synchroniser (voir plus bas) ; posée par onMount. */
	let syncPull: () => void = () => {};

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
		let armed = false;
		let crossed = false;
		let backTimer: ReturnType<typeof setTimeout> | undefined;

		function start(e: TouchEvent) {
			mode = null;
			if (e.touches.length !== 1 || refreshing || backTimer || blocked()) return;
			const t = e.touches[0];
			startX = lastX = t.clientX;
			startY = t.clientY;
			lastT = performance.now();
			speed = 0;
			crossed = false;
			const path = location.pathname;
			if (!ROOTS.includes(path) && !isModal(path) && t.clientX <= 24 && history.length > 1 && !nativeBackGesture()) mode = 'edge';
			else if (ROOTS.includes(path) && window.scrollY <= 0) mode = 'pull';
		}

		// Retour par le bord : écoute passive, elle n'a pas à empêcher le défilement (la page ne défile pas de côté).
		function edgeMove(e: TouchEvent) {
			if (mode !== 'edge') return;
			const t = e.touches[0];
			const now = performance.now();
			speed = (t.clientX - lastX) / Math.max(1, now - lastT);
			lastX = t.clientX;
			lastT = now;
			const dx = t.clientX - startX;
			if (!edging) {
				const dy = t.clientY - startY;
				if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
				// Geste surtout vertical, ou vers la gauche : c'est un défilement, pas un retour.
				if (Math.abs(dy) > Math.abs(dx) || dx < 0) {
					mode = null;
					return;
				}
				edging = true;
			}
			edge = Math.max(0, dx);
		}

		// Tirer pour synchroniser : seule écoute non passive (il faut retenir la page), et seulement tant qu'un
		// geste est possible, c'est-à-dire en haut d'un onglet. Hors de là, le défilement n'attend plus le JavaScript.
		function pullMove(e: TouchEvent) {
			if (mode !== 'pull') return;
			const t = e.touches[0];
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
			// Un « tic » au franchissement du seuil : relâcher maintenant synchronise.
			const over = pull >= PULL_THRESHOLD;
			if (over && !crossed) haptic('tick');
			crossed = over;
			if (e.cancelable) e.preventDefault();
		}

		/** touchcancel (le système reprend la main : centre de contrôle, appel…) : on abandonne, sans rien valider. */
		async function end(e: TouchEvent) {
			const cancelled = e.type === 'touchcancel';
			if (mode === 'edge') {
				mode = null;
				const width = innerWidth;
				if (!cancelled && edging && (edge > width * 0.35 || (speed > 0.5 && edge > 30))) {
					edge = width;
					edging = false;
					backTimer = setTimeout(() => {
						backTimer = undefined;
						skipTransition = true;
						history.back();
						// Si rien n'a navigué, la prochaine navigation garde son animation.
						setTimeout(() => (skipTransition = false), 800);
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
			if (!cancelled && pull >= PULL_THRESHOLD) {
				refreshing = true;
				pull = 56;
				syncPull();
				try {
					await store.sync();
				} finally {
					// Laisse voir la fin de la rotation un instant, comme iOS.
					setTimeout(() => {
						refreshing = false;
						pull = 0;
						syncPull();
					}, 350);
				}
			} else {
				pull = 0;
			}
		}

		syncPull = () => {
			const want = ROOTS.includes(location.pathname) && window.scrollY <= 0 && !refreshing;
			if (want === armed) return;
			armed = want;
			if (want) addEventListener('touchmove', pullMove, { passive: false });
			else removeEventListener('touchmove', pullMove);
		};
		const onScroll = () => syncPull();

		addEventListener('touchstart', start, { passive: true });
		addEventListener('touchmove', edgeMove, { passive: true });
		addEventListener('touchend', end, { passive: true });
		addEventListener('touchcancel', end, { passive: true });
		addEventListener('scroll', onScroll, { passive: true });
		syncPull();
		return () => {
			removeEventListener('touchstart', start);
			removeEventListener('touchmove', edgeMove);
			removeEventListener('touchmove', pullMove);
			removeEventListener('touchend', end);
			removeEventListener('touchcancel', end);
			removeEventListener('scroll', onScroll);
			clearTimeout(backTimer);
			syncPull = () => {};
		};
	});

	// Nouvel écran affiché : remet en place celui qu'on avait fait glisser.
	afterNavigate(() => {
		recordScreen(location.pathname + location.search);
		edging = true;
		edge = 0;
		requestAnimationFrame(() => (edging = false));
		syncPull();
	});

	const mainStyle = $derived.by(() => {
		if (edge) {
			return `transform: translateX(${edge}px); box-shadow: -10px 0 30px rgb(var(--shadow-ink) / 0.18); transition: ${edging ? 'none' : 'transform 260ms var(--ease-out)'}`;
		}
		if (pull) return `transform: translateY(${pull}px); transition: ${pulling ? 'none' : 'transform 380ms var(--ease-out)'}`;
		return `transition: transform 380ms var(--ease-out)`;
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
		{:else if store.loaded && !store.syncing}
			<!-- Ni cache local ni connexion : on le dit, avec un nouvel essai (la synchronisation reprend d'elle-même au retour du réseau). -->
			<div class="grid min-h-[70dvh] place-items-center">
				<EmptyState art="hors-ligne" title="Rien à afficher pour l’instant" text="Ton carnet n’est pas encore enregistré sur cet iPhone, et la connexion manque. Reconnecte-toi, puis réessaie.">
					{#snippet actions()}
						<button class="btn-filled" onclick={() => void store.sync()}>Réessayer</button>
					{/snippet}
				</EmptyState>
			</div>
		{:else if lateLoading}
			{#if modal}
				<div class="grid min-h-[70dvh] place-items-center">
					<span class="grid place-items-center" role="status" aria-label="Chargement"><Spinner spinning size={32} /></span>
				</div>
			{:else}
				<Skeleton />
			{/if}
		{/if}
	</main>

	{#if !modal}
		<!-- Barre d'onglets iOS 26 : capsule de verre flottante (la pilule d'accent glisse d'un onglet à l'autre), bouton d'action à part. -->
		<nav
			class="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-end justify-center gap-3 px-4"
			style="padding-bottom: max(10px, calc(env(safe-area-inset-bottom) - 6px))"
			aria-label="Navigation principale"
		>
			<ul
				class="glass pointer-events-auto relative flex flex-1 items-center rounded-full p-1"
				style="--cut: var(--bg2); --i: {pillIndex}; --n: {tabs.length}; view-transition-name: tabbar"
			>
				<span class="tab-pill" data-none={activeIndex < 0 ? '' : undefined} aria-hidden="true"></span>
				{#each tabs as tab (tab.href)}
					{@const on = tab.href === tabs[activeIndex]?.href}
					<li class="relative flex-1">
						<a
							href={tab.href}
							data-tour="tab-{tab.tour}"
							aria-current={on ? 'page' : undefined}
							onclick={() => on || haptic('tick')}
							class="flex h-[54px] flex-col items-center justify-center gap-0.5 rounded-full transition-colors duration-(--dur-s) {on ? 'text-[color-mix(in_srgb,var(--tint)_78%,var(--label))]' : 'text-label'}"
						>
							<!-- Contour et plein superposés : l'icône se remplit en fondu quand l'onglet devient actif. -->
							<span class="relative grid h-[25px] w-[25px] place-items-center">
								<Icon name={tab.icon} size={25} weight={1.7} />
								<span class="absolute inset-0 grid place-items-center" style="opacity: {on ? 1 : 0}; transition: opacity var(--dur-m) var(--ease-out)">
									<Icon name={tab.icon} size={25} filled weight={1.7} />
								</span>
							</span>
							<span class="text-[10px] font-semibold leading-none tracking-normal">{tab.label}</span>
						</a>
					</li>
				{/each}
			</ul>
			{#if showBubble}
				<a
					href={bubbleHref}
					data-tour="assistant"
					class="pressable pointer-events-auto absolute right-4 grid h-[52px] w-[52px] place-items-center rounded-full text-white transition-[translate,opacity,transform] duration-300 {scrolling ? 'translate-x-[62%] opacity-60' : ''}"
					style="bottom: calc(max(10px, calc(env(safe-area-inset-bottom) - 6px)) + 62px + 14px); background: var(--indigo); box-shadow: var(--elev-3); view-transition-name: assistant"
					aria-label="Ouvrir l’assistant"
				>
					<Icon name="chat" size={26} filled weight={1.8} />
				</a>
			{/if}
			<!-- Bouton « + » : capsule corail, encre lagon profond (5,0:1 en clair, 5,8:1 en sombre sur le corail). -->
			<a
				href="/mesurer"
				data-tour="mesurer"
				class="pressable pointer-events-auto grid h-[62px] w-[62px] shrink-0 place-items-center rounded-full"
				style="background: var(--coral); color: var(--lagoon-deep); box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.4), var(--elev-3); view-transition-name: tabaction"
				aria-label="Saisir des mesures"
			>
				<Icon name="plus" size={28} weight={2.6} />
			</a>
		</nav>
	{/if}

	{#if pillView.rendered && shownPill}
		<p
			class="caption1 pointer-events-none fixed left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 font-semibold {shownPill.kind === 'error' ? 'bg-red text-white' : 'glass text-label2'}"
			style="bottom: calc(max(10px, env(safe-area-inset-bottom) - 6px) + {modal ? 12 : 72}px); animation: {pillView.leaving ? 'pop-out var(--dur-s) var(--ease-in) both' : 'pop-in var(--dur-m) var(--ease-pop) both'}"
			onanimationend={pillView.end}
			role="status"
		>
			{#if shownPill.kind === 'offline'}
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
					<path d="M2.5 9a14 14 0 0 1 4.6-2.8M10.5 5.6A14 14 0 0 1 21.5 9M5.5 12.4a9.5 9.5 0 0 1 3-1.8M14.6 10.5a9.5 9.5 0 0 1 3.9 1.9M8.8 15.6a4.8 4.8 0 0 1 6.4 0" />
					<circle cx="12" cy="19" r="1.1" fill="currentColor" stroke="none" />
					<path d="M3.5 3.5l17 17" />
				</svg>
			{:else if shownPill.kind === 'sending'}
				<Spinner size={14} spinning />
			{:else if shownPill.kind === 'sent'}
				<span class="text-green"><Icon name="check" size={14} weight={3} /></span>
			{/if}
			{shownPill.text}
		</p>
	{/if}

	<Banner />
	<ContextMenuHost />
	<AlertHost />
	{#if tour.active}<Tour />{/if}
</div>

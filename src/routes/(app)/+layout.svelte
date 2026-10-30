<script lang="ts">
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { registerServiceWorker } from '$lib/push-client';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import Toast from '$lib/components/Toast.svelte';

	let { children } = $props();

	onMount(() => {
		// Le service worker rend l'appli disponible hors ligne et reçoit les push.
		if ('serviceWorker' in navigator) void registerServiceWorker().catch(() => {});
		void store.init();
		// Une tâche cochée juste avant de quitter l'appli est envoyée sans attendre.
		const flush = () => ui.flush();
		addEventListener('pagehide', flush);
		return () => removeEventListener('pagehide', flush);
	});

	// Transition douce entre écrans quand le navigateur sait faire (iOS 18 et plus).
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	const tabs: { href: string; label: string; icon: IconName }[] = [
		{ href: '/', label: "Aujourd'hui", icon: 'today' },
		{ href: '/aquariums', label: 'Bacs', icon: 'bacs' },
		{ href: '/outils', label: 'Atelier', icon: 'outils' },
		{ href: '/reglages', label: 'Réglages', icon: 'reglages' }
	];

	function active(href: string): boolean {
		const path = page.url.pathname;
		if (href === '/') return path === '/';
		if (href === '/outils') return ['/outils', '/especes', '/depenses'].some((p) => path.startsWith(p));
		return path.startsWith(href);
	}
	const measuring = $derived(page.url.pathname.startsWith('/mesurer'));
</script>

<div class="mx-auto flex min-h-dvh max-w-md flex-col">
	{#if store.pending.length}
		<p class="num mx-5 mt-3 flex items-center gap-2 rounded-lg border-2 border-edge bg-sun px-3 py-1.5 text-xs text-[#16202e]" role="status">
			<Icon name="sync" size={14} />
			{store.pending.length} saisie{store.pending.length > 1 ? 's' : ''} en attente d'envoi
		</p>
	{:else if store.error}
		<p class="mx-5 mt-3 rounded-lg border-2 border-bad bg-bad-soft px-3 py-1.5 text-xs font-bold text-bad" role="alert">{store.error}</p>
	{/if}

	<main class="flex-1 px-5 pb-36 pt-6">
		{#if store.view}
			{@render children()}
		{:else if store.loaded && store.syncing}
			<p class="hand text-lg text-muted">Je relève les compteurs…</p>
		{:else if store.loaded}
			<p class="hand text-lg text-muted">
				Rien en mémoire et pas de connexion. Ouvre l'appli une première fois en ligne.
			</p>
		{/if}
	</main>

	<Toast />

	<nav
		class="fixed inset-x-0 bottom-0 z-30 px-3"
		style="padding-bottom: max(0.75rem, env(safe-area-inset-bottom)); view-transition-name: tabbar"
		aria-label="Navigation principale"
	>
		<ul class="relative mx-auto flex max-w-md items-end rounded-2xl border-2 border-edge bg-surface px-1 pb-1.5 pt-2 shadow-[4px_4px_0_var(--shadow)]">
			{#each tabs.slice(0, 2) as tab (tab.href)}
				{@render tabItem(tab)}
			{/each}
			<li class="flex flex-1 justify-center">
				<a
					href="/mesurer"
					aria-current={measuring ? 'page' : undefined}
					class="press -mt-8 flex flex-col items-center gap-1 text-[11px] font-bold {measuring ? 'text-ink' : 'text-muted'}"
				>
					<span class="grid h-14 w-14 place-items-center rounded-full border-2 border-edge bg-sun text-[#16202e] shadow-[3px_3px_0_var(--shadow)]">
						<Icon name="drop" size={26} />
					</span>
					Mesurer
				</a>
			</li>
			{#each tabs.slice(2) as tab (tab.href)}
				{@render tabItem(tab)}
			{/each}
		</ul>
	</nav>
</div>

{#snippet tabItem(tab: { href: string; label: string; icon: IconName })}
	{@const on = active(tab.href)}
	<li class="flex-1">
		<a
			href={tab.href}
			aria-current={on ? 'page' : undefined}
			class="flex flex-col items-center gap-0.5 text-[11px] font-bold {on ? 'text-ink' : 'text-muted'}"
		>
			<span class="grid h-8 w-12 place-items-center rounded-lg {on ? 'bg-ink text-on-ink' : ''}">
				<Icon name={tab.icon} size={22} />
			</span>
			{tab.label}
		</a>
	</li>
{/snippet}

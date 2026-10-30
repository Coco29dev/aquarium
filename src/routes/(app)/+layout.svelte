<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { registerServiceWorker } from '$lib/push-client';
	import Icon from '$lib/components/Icon.svelte';

	let { children } = $props();

	onMount(() => {
		// Le service worker rend l'appli disponible hors ligne et reçoit les push.
		if ('serviceWorker' in navigator) void registerServiceWorker().catch(() => {});
		void store.init();
	});

	const tabs: { href: string; label: string; icon: "today" | "bacs" | "outils" | "reglages" }[] = [
		{ href: '/', label: "Aujourd'hui", icon: 'today' },
		{ href: '/aquariums', label: 'Aquariums', icon: 'bacs' },
		{ href: '/outils', label: 'Outils', icon: 'outils' },
		{ href: '/reglages', label: 'Réglages', icon: 'reglages' }
	];

	function active(href: string): boolean {
		const path = page.url.pathname;
		return href === '/' ? path === '/' : path.startsWith(href);
	}
</script>

<div class="mx-auto flex min-h-dvh max-w-md flex-col">
	{#if store.pending.length}
		<p class="bg-warn-soft px-4 py-2 text-center text-xs text-warn" role="status">
			{store.pending.length} saisie{store.pending.length > 1 ? 's' : ''} en attente d'envoi
		</p>
	{:else if store.error}
		<p class="bg-bad-soft px-4 py-2 text-center text-xs text-bad" role="alert">{store.error}</p>
	{/if}

	<div class="flex-1 px-5 pb-28 pt-6">
		{#if store.view}
			{@render children()}
		{:else if store.loaded && store.syncing}
			<p class="text-sm text-muted">Chargement…</p>
		{:else if store.loaded}
			<p class="text-sm text-muted">
				Aucune donnée en cache et pas de connexion. Ouvre l'appli une première fois en ligne.
			</p>
		{/if}
	</div>

	<nav
		class="fixed inset-x-0 bottom-0 border-t-[2.5px] border-edge bg-surface"
		style="padding-bottom: env(safe-area-inset-bottom)"
		aria-label="Navigation principale"
	>
		<ul class="mx-auto flex max-w-md px-1 pt-2 pb-1">
			{#each tabs as tab (tab.href)}
				<li class="flex-1">
					<a
						href={tab.href}
						aria-current={active(tab.href) ? 'page' : undefined}
						class="flex flex-col items-center gap-0.5 text-[11px] font-bold {active(tab.href) ? 'text-ink' : 'text-muted'}"
					>
						<span class="rounded-full px-4 py-1 {active(tab.href) ? 'bg-primary text-on-primary' : ''}">
							<Icon name={tab.icon} />
						</span>
						{tab.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</div>

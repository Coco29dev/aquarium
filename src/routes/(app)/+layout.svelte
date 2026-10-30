<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { registerServiceWorker } from '$lib/push-client';

	let { children } = $props();

	onMount(() => {
		// Le service worker rend l'appli disponible hors ligne et reçoit les push.
		if ('serviceWorker' in navigator) void registerServiceWorker().catch(() => {});
		void store.init();
	});

	const tabs = [
		{ href: '/', label: "Aujourd'hui" },
		{ href: '/aquariums', label: 'Aquariums' },
		{ href: '/outils', label: 'Outils' },
		{ href: '/reglages', label: 'Réglages' }
	];

	function active(href: string): boolean {
		const path = page.url.pathname;
		return href === '/' ? path === '/' : path.startsWith(href);
	}
</script>

<div class="mx-auto flex min-h-dvh max-w-md flex-col">
	{#if store.pending.length}
		<p class="bg-amber-950 px-4 py-2 text-center text-xs text-amber-200" role="status">
			{store.pending.length} saisie{store.pending.length > 1 ? 's' : ''} en attente d'envoi
		</p>
	{:else if store.error}
		<p class="bg-red-950 px-4 py-2 text-center text-xs text-red-200" role="alert">{store.error}</p>
	{/if}

	<div class="flex-1 px-5 pb-28 pt-6">
		{#if store.view}
			{@render children()}
		{:else if store.loaded && store.syncing}
			<p class="text-sm text-slate-400">Chargement…</p>
		{:else if store.loaded}
			<p class="text-sm text-slate-400">
				Aucune donnée en cache et pas de connexion. Ouvre l'appli une première fois en ligne.
			</p>
		{/if}
	</div>

	<nav
		class="fixed inset-x-0 bottom-0 border-t border-cyan-950 bg-slate-950/95 backdrop-blur"
		style="padding-bottom: env(safe-area-inset-bottom)"
	>
		<ul class="mx-auto flex max-w-md">
			{#each tabs as tab (tab.href)}
				<li class="flex-1">
					<a
						href={tab.href}
						class="block py-4 text-center text-sm {active(tab.href) ? 'font-semibold text-cyan-300' : 'text-slate-400'}"
					>
						{tab.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</div>

<script lang="ts">
	import { onMount } from 'svelte';
	import { store } from '$lib/client/store.svelte';
	import {
		enableReminders,
		isStandalone,
		pushSupported,
		sendTest,
		syncSubscription,
		type SyncState
	} from '$lib/push-client';

	let installed = $state(false);
	let supported = $state(true);
	let permission = $state<NotificationPermission | 'indisponible'>('indisponible');
	let subscription = $state<SyncState | 'vérification…'>('vérification…');
	let message = $state('');
	let busy = $state(false);

	const permissionLabels = {
		granted: 'accordée',
		denied: 'refusée',
		default: 'pas encore demandée',
		indisponible: 'indisponible'
	} as const;

	async function refresh() {
		permission = 'Notification' in window ? Notification.permission : 'indisponible';
		try {
			const state = await syncSubscription();
			subscription = state;
			if (state === 'recréé') message = 'Abonnement recréé automatiquement.';
		} catch (error) {
			subscription = 'inactif';
			message = (error as Error).message;
		}
	}

	onMount(() => {
		installed = isStandalone();
		supported = pushSupported();
		if (supported) void refresh();
	});

	async function run(action: () => Promise<void>) {
		busy = true;
		message = '';
		try {
			await action();
		} catch (error) {
			message = (error as Error).message;
		} finally {
			busy = false;
		}
	}

	const enable = () =>
		run(async () => {
			subscription = await enableReminders();
			permission = Notification.permission;
			message = subscription === 'inactif' ? 'Permission non accordée.' : 'Rappels activés.';
		});

	const test = () =>
		run(async () => {
			const { sent, total } = await sendTest();
			message =
				total === 0
					? 'Aucun abonnement enregistré sur le serveur.'
					: `Notification envoyée (${sent}/${total}). Verrouillez l'écran pour vérifier.`;
			await refresh();
		});
</script>

<svelte:head>
	<title>Réglages · Aquarium</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<h1 class="text-2xl font-semibold">Réglages</h1>

	<h2 class="-mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">Rappels</h2>

	<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
		<dt class="text-slate-400">Installée</dt>
		<dd>{installed ? 'oui (plein écran)' : 'non (ouverte dans le navigateur)'}</dd>
		<dt class="text-slate-400">Permission</dt>
		<dd>{permissionLabels[permission]}</dd>
		<dt class="text-slate-400">Abonnement</dt>
		<dd>{subscription}</dd>
	</dl>

	{#if !supported}
		<p class="rounded-lg bg-amber-950 p-4 text-sm text-amber-200">
			Les notifications push ne sont pas disponibles ici.
		</p>
	{:else if !installed}
		<p class="rounded-lg bg-amber-950 p-4 text-sm text-amber-200">
			Sur iPhone, ajoute d'abord l'appli à l'écran d'accueil (Partager → Sur l'écran d'accueil), puis
			ouvre-la depuis l'icône pour activer les rappels.
		</p>
	{:else}
		<div class="flex flex-col gap-3">
			<button
				onclick={enable}
				disabled={busy || permission === 'granted' || permission === 'denied'}
				class="rounded-lg bg-cyan-700 px-4 py-3 font-medium active:bg-cyan-800 disabled:opacity-40"
			>
				Activer les rappels
			</button>
			<button
				onclick={test}
				disabled={busy || permission !== 'granted'}
				class="rounded-lg border border-cyan-700 px-4 py-3 font-medium active:bg-cyan-950 disabled:opacity-40"
			>
				Envoyer un test
			</button>
		</div>
		{#if permission === 'denied'}
			<p class="text-sm text-slate-400">
				Permission refusée : réactive-la dans Réglages → Notifications → Aquarium.
			</p>
		{/if}
	{/if}

	{#if message}
		<p class="text-sm" role="status">{message}</p>
	{/if}

	<h2 class="-mb-3 mt-4 text-sm font-medium uppercase tracking-wide text-slate-400">Sauvegarde</h2>
	<ul class="flex flex-col gap-2 text-sm">
		<li><a href="/api/export?format=json" download class="text-cyan-300 underline">Tout exporter (JSON)</a></li>
		<li><a href="/api/export?format=csv&table=measurements" download class="text-cyan-300 underline">Mesures (CSV)</a></li>
		<li><a href="/api/export?format=csv&table=completions" download class="text-cyan-300 underline">Tâches réalisées (CSV)</a></li>
		<li><a href="/api/export?format=csv&table=expenses" download class="text-cyan-300 underline">Dépenses (CSV)</a></li>
	</ul>

	<p class="text-xs text-slate-500">
		{store.pending.length} saisie(s) en attente · dernière synchronisation :
		{store.lastSync ? new Date(store.lastSync).toLocaleString('fr-FR') : 'jamais'}
	</p>

	<form method="POST" action="/logout">
		<button class="text-sm text-slate-400 underline">Se déconnecter</button>
	</form>
</div>

<script lang="ts">
	import { onMount } from 'svelte';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import {
		enableReminders,
		isStandalone,
		pushSupported,
		sendTest,
		syncSubscription,
		type SyncState
	} from '$lib/push-client';
	import Icon from '$lib/components/Icon.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';

	let installed = $state(false);
	let supported = $state(true);
	let permission = $state<NotificationPermission | 'indisponible'>('indisponible');
	let subscription = $state<SyncState | 'vérification…'>('vérification…');
	let message = $state('');
	let busy = $state(false);

	type Tone = 'ok' | 'warn' | 'bad' | 'muted';
	const permissionInfo: Record<NotificationPermission | 'indisponible', [string, Tone]> = {
		granted: ['accordée', 'ok'],
		denied: ['refusée', 'bad'],
		default: ['pas encore demandée', 'warn'],
		indisponible: ['indisponible', 'muted']
	};
	const subscriptionInfo: Record<SyncState | 'vérification…', [string, Tone]> = {
		actif: ['actif', 'ok'],
		'recréé': ['recréé à l’instant', 'ok'],
		inactif: ['inactif', 'warn'],
		'vérification…': ['vérification…', 'muted']
	};
	const dot: Record<Tone, string> = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', muted: 'bg-surface2' };

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
					: `Notification envoyée (${sent}/${total}). Verrouille l'écran pour vérifier.`;
			await refresh();
		});

	async function syncNow() {
		await store.sync();
		ui.show(store.error ? 'Synchronisation impossible' : 'Données à jour');
	}

	const lastSync = $derived(
		store.lastSync
			? new Date(store.lastSync).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
			: 'jamais'
	);

	const exports = [
		{ href: '/api/export?format=json', label: 'Tout exporter', hint: 'JSON, sauvegarde complète' },
		{ href: '/api/export?format=csv&table=measurements', label: 'Mesures', hint: 'CSV, pour un tableur' },
		{ href: '/api/export?format=csv&table=completions', label: 'Tâches réalisées', hint: 'CSV' },
		{ href: '/api/export?format=csv&table=expenses', label: 'Dépenses', hint: 'CSV' }
	];
</script>

{#snippet status(label: string, value: string, tone: Tone)}
	<div class="flex items-center justify-between gap-3 py-2.5">
		<dt class="text-sm text-muted">{label}</dt>
		<dd class="flex items-center gap-2 text-sm font-bold">
			<span class="h-2.5 w-2.5 rounded-full border border-edge {dot[tone]}"></span>{value}
		</dd>
	</div>
{/snippet}

<svelte:head><title>Réglages · Bulle</title></svelte:head>

<div class="rise">
	<PageHeader title="Réglages" kicker="L’appli" />
</div>

<div class="flex flex-col gap-6">
	<!-- Rappels -->
	<section class="card rise overflow-hidden" style="animation-delay: 40ms">
		<div class="flex items-center gap-3 border-b-2 border-edge bg-sun px-4 py-3 text-[#16202e]">
			<Icon name="bell" size={24} />
			<h2 class="display text-xl">Rappels</h2>
		</div>
		<div class="flex flex-col gap-4 p-4">
			<dl class="divide-y-2 divide-line">
				{@render status('Installée sur l’écran d’accueil', installed ? 'oui' : 'non', installed ? 'ok' : 'warn')}
				{@render status('Permission', permissionInfo[permission][0], permissionInfo[permission][1])}
				{@render status('Abonnement', subscriptionInfo[subscription][0], subscriptionInfo[subscription][1])}
			</dl>

			{#if !supported}
				<p class="rounded-lg border-2 border-warn bg-warn-soft p-3 text-sm font-bold text-warn">
					Les notifications ne sont pas disponibles dans ce navigateur.
				</p>
			{:else if !installed}
				<div class="rounded-lg border-2 border-edge bg-surface2 p-3 text-sm">
					<p class="mb-2 font-bold">Sur iPhone, les rappels demandent l’appli installée :</p>
					<ol class="flex flex-col gap-1.5">
						<li class="flex gap-2"><span class="num">1.</span>Dans Safari, touche Partager.</li>
						<li class="flex gap-2"><span class="num">2.</span>Choisis « Sur l’écran d’accueil ».</li>
						<li class="flex gap-2"><span class="num">3.</span>Ouvre Bulle depuis l’icône, puis reviens ici.</li>
					</ol>
				</div>
			{:else}
				<div class="grid grid-cols-2 gap-3">
					<button onclick={enable} disabled={busy || permission === 'granted' || permission === 'denied'} class="btn px-3">
						Activer
					</button>
					<button onclick={test} disabled={busy || permission !== 'granted'} class="btn-ghost px-3">Envoyer un test</button>
				</div>
				{#if permission === 'denied'}
					<p class="text-sm text-muted">Permission refusée : réactive-la dans Réglages → Notifications → Bulle.</p>
				{/if}
			{/if}
			{#if message}
				<p class="break-words text-sm font-bold" role="status">{message}</p>
			{/if}
		</div>
	</section>

	<!-- Synchronisation -->
	<section class="card rise p-4" style="animation-delay: 80ms">
		<div class="mb-3 flex items-center gap-3">
			<Icon name="sync" size={24} />
			<h2 class="display text-xl">Synchronisation</h2>
		</div>
		<dl class="mb-4 divide-y-2 divide-line">
			{@render status('Saisies en attente', String(store.pending.length), store.pending.length ? 'warn' : 'ok')}
			{@render status('Dernière synchro', lastSync, store.error ? 'bad' : 'ok')}
		</dl>
		{#if store.error}<p class="mb-3 text-sm font-bold text-bad">{store.error}</p>{/if}
		<button class="btn-ghost w-full" onclick={syncNow} disabled={store.syncing}>
			<span class={store.syncing ? 'animate-spin' : ''}><Icon name="sync" size={18} /></span>
			{store.syncing ? 'Synchronisation…' : 'Synchroniser maintenant'}
		</button>
	</section>

	<!-- Sauvegarde -->
	<section class="rise" style="animation-delay: 120ms">
		<h2 class="tape mb-3">Sauvegarde et export</h2>
		<ul class="card divide-y-2 divide-line">
			{#each exports as e (e.href)}
				<li>
					<a href={e.href} download class="flex items-center gap-3 px-4 py-3 active:bg-surface2">
						<span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg border-2 border-edge bg-surface2">
							<Icon name="download" size={18} />
						</span>
						<span class="min-w-0 flex-1">
							<span class="block font-bold">{e.label}</span>
							<span class="block text-xs text-muted">{e.hint}</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
		<p class="hand mt-2 text-base text-muted">Le serveur garde tout ; l’export, c’est ta copie à toi.</p>
	</section>

	<!-- À propos -->
	<section class="card-flat rise flex items-center gap-4 p-4" style="animation-delay: 160ms">
		<Logo size={56} />
		<div class="min-w-0 flex-1">
			<p class="display text-2xl">bulle</p>
			<p class="num text-xs text-muted">version 0.0.1</p>
			<p class="hand text-base text-muted">Un carnet pour tes bacs.</p>
		</div>
	</section>

	<form method="POST" action="/logout">
		<button class="btn-ghost w-full text-bad">Se déconnecter</button>
	</form>
</div>

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
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Switch from '$lib/ios/Switch.svelte';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';

	let installed = $state(false);
	let supported = $state(true);
	let permission = $state<NotificationPermission | 'indisponible'>('indisponible');
	let subscription = $state<SyncState | 'vérification'>('vérification');
	let busy = $state(false);
	let syncing = $state(false);

	const active = $derived(permission === 'granted' && (subscription === 'actif' || subscription === 'recréé'));

	async function refresh() {
		permission = 'Notification' in window ? Notification.permission : 'indisponible';
		try {
			const state = await syncSubscription();
			subscription = state;
			if (state === 'recréé') ui.show('Abonnement aux rappels recréé');
		} catch (error) {
			subscription = 'inactif';
			ui.show((error as Error).message);
		}
	}

	onMount(() => {
		installed = isStandalone();
		supported = pushSupported();
		if (supported) void refresh();
	});

	async function run(action: () => Promise<void>) {
		busy = true;
		try {
			await action();
		} catch (error) {
			ui.show((error as Error).message);
		} finally {
			busy = false;
		}
	}

	async function toggleReminders(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		if (!input.checked) return;
		await run(async () => {
			subscription = await enableReminders();
			permission = Notification.permission;
			ui.show(subscription === 'inactif' ? 'Notifications non autorisées' : 'Rappels activés', undefined, subscription === 'inactif' ? undefined : 'check');
		});
		input.checked = active;
	}

	const test = () =>
		run(async () => {
			const { sent, total } = await sendTest();
			ui.show(total === 0 ? 'Aucun appareil abonné' : `Notification envoyée (${sent}/${total})`, undefined, total ? 'check' : undefined);
			await refresh();
		});

	async function syncNow() {
		syncing = true;
		await store.sync();
		syncing = false;
		ui.show(store.error ? 'Synchronisation impossible' : 'Données à jour', undefined, store.error ? undefined : 'check');
	}

	const time = (iso: string | null) =>
		iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null;
	const lastSync = $derived(
		store.lastSync
			? new Date(store.lastSync).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
			: 'Jamais'
	);
	const exports: { href: string; title: string; format: string; icon: IconName; color: string }[] = [
		{ href: '/api/export?format=json', title: 'Tout exporter', format: 'JSON', icon: 'box', color: 'var(--green)' },
		{ href: '/api/export?format=csv&table=measurements', title: 'Mesures', format: 'CSV', icon: 'drop', color: 'var(--teal)' },
		{ href: '/api/export?format=csv&table=completions', title: 'Tâches réalisées', format: 'CSV', icon: 'today', color: 'var(--indigo)' },
		{ href: '/api/export?format=csv&table=expenses', title: 'Dépenses', format: 'CSV', icon: 'euro', color: 'var(--brown)' }
	];
	const tankCount = $derived(store.view?.aquariums.length ?? 0);
	const remindersFooter = $derived(
		!supported
			? 'Les notifications ne sont pas disponibles sur cet appareil.'
			: !installed
				? 'Sur iPhone, les rappels demandent l’appli sur l’écran d’accueil : dans Safari, touche Partager, puis « Sur l’écran d’accueil », et ouvre Aquarium depuis son icône.'
				: permission === 'denied'
					? 'Notifications refusées : réactive-les dans Réglages > Notifications > Aquarium.'
					: active
						? 'Pour couper les rappels, désactive les notifications d’Aquarium dans les Réglages de l’iPhone.'
						: 'Un rappel chaque jour entre 8 h et 21 h quand une tâche est due.'
	);
</script>

<svelte:head><title>Réglages · Aquarium</title></svelte:head>

<NavBar title="Réglages" />

<!-- Carte de l'appli, façon identifiant Apple -->
<Section class="mt-2">
	<li class="flex items-center gap-4 px-4 py-3">
		<img src="/apple-touch-icon-180x180.png" alt="" class="h-[60px] w-[60px] rounded-[22%] shadow-[0_1px_3px_rgb(0_0_0/0.15)]" />
		<div class="min-w-0 flex-1">
			<p class="title3 font-semibold">Aquarium</p>
			<p class="subhead text-label2">
				{tankCount} bac{tankCount > 1 ? 's' : ''}{store.lastSync ? ` · synchronisé à ${time(store.lastSync)}` : ''}
			</p>
		</div>
	</li>
</Section>

<Section header="Notifications" footer={remindersFooter}>
	<Row icon="bell" iconColor="var(--red)" title="Rappels">
		{#snippet trailing()}
			<Switch checked={active} disabled={busy || !supported || !installed || permission === 'denied' || active} onchange={toggleReminders} label="Activer les rappels" />
		{/snippet}
	</Row>
	<Row icon="today" iconColor="var(--orange)" title="Envoyer une notification de test" onclick={test} disabled={busy || !active} />
	{#if installed && supported}
		<Row title="Autorisation" value={permission === 'granted' ? 'Accordée' : permission === 'denied' ? 'Refusée' : permission === 'default' ? 'Pas demandée' : 'Indisponible'} />
	{/if}
</Section>

<Section header="Synchronisation" footer="L’appli marche hors ligne : tes saisies partent dès que le réseau revient.">
	<Row icon="sync" iconColor="var(--blue)" title="Saisies en attente" value={String(store.pending.length)} />
	<Row title="Dernière synchronisation" value={lastSync} />
	<Row title={syncing ? 'Synchronisation…' : 'Synchroniser maintenant'} action onclick={syncNow} disabled={syncing} />
</Section>

<Section header="Données" footer="Le serveur garde tout ; l’export est ta copie personnelle.">
	{#each exports as x (x.href)}
		<li>
			<a href={x.href} download data-sveltekit-reload class="tappable flex items-center gap-3 pl-4">
				<span class="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px] text-white" style="background: {x.color}; --cut: {x.color}">
					<Icon name={x.icon} size={19} filled weight={2} />
				</span>
				<span class="row-body flex min-h-11 min-w-0 flex-1 items-center gap-3 py-2.5 pr-4">
					<span class="body min-w-0 flex-1 truncate">{x.title}</span>
					<span class="body text-label2">{x.format}</span>
					<span class="text-tint"><Icon name="download" size={20} weight={2} /></span>
				</span>
			</a>
		</li>
	{/each}
</Section>

<Section header="À propos">
	<Row title="Version" value="0.0.1" />
	<Row title="Espèces" value="FishBase, SeaLifeBase" />
</Section>

<form method="POST" action="/logout" class="mb-8">
	<ul class="group">
		<li>
			<button class="tappable body flex min-h-11 w-full items-center justify-center text-red">Se déconnecter</button>
		</li>
	</ul>
</form>

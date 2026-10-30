<script lang="ts">
	import { onMount } from 'svelte';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { isStandalone, pushSupported } from '$lib/push-client';
	import { daysBetween, dayInParis } from '$lib/domain/dates';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Spinner from '$lib/ios/Spinner.svelte';
	import type { BackupStatus } from '$lib/types';

	let notifications = $state('');
	let backup = $state<BackupStatus | null>(null);
	let online = $state(true);
	let syncing = $state(false);

	onMount(() => {
		const enabled = pushSupported() && isStandalone() && 'Notification' in window && Notification.permission === 'granted';
		notifications = enabled ? 'Activées' : 'Désactivées';
		online = navigator.onLine;
		const update = () => (online = navigator.onLine);
		addEventListener('online', update);
		addEventListener('offline', update);
		store.fetchBackup().then((b) => (backup = b)).catch(() => {});
		return () => {
			removeEventListener('online', update);
			removeEventListener('offline', update);
		};
	});

	async function syncNow() {
		syncing = true;
		await store.sync();
		syncing = false;
		ui.show(store.error ? 'Synchronisation impossible' : 'Données à jour', undefined, store.error ? undefined : 'check');
	}

	let loggingOut = false;

	/** Efface les données locales avant de quitter ; prévient s'il reste des saisies non envoyées. */
	async function logout(event: SubmitEvent) {
		if (loggingOut) return;
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		if (store.pending.length) {
			const ok = await ui.confirm({
				title: 'Saisies non envoyées',
				message: `${store.pending.length} saisie(s) n'ont pas encore atteint le serveur et seront perdues.`,
				confirmLabel: 'Se déconnecter',
				destructive: true
			});
			if (!ok) return;
		}
		await store.clearLocalData();
		loggingOut = true;
		form.requestSubmit();
	}

	const time = (iso: string | null) =>
		iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null;
	const lastSync = $derived(
		store.lastSync
			? new Date(store.lastSync).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
			: 'Jamais'
	);
	const backupValue = $derived.by(() => {
		if (!backup) return '';
		if (!backup.lastBackupAt) return 'Jamais';
		const days = daysBetween(dayInParis(backup.lastBackupAt), dayInParis());
		return days <= 0 ? 'Aujourd’hui' : days === 1 ? 'Hier' : `Il y a ${days} j`;
	});
	const themeLabel = $derived({ auto: 'Automatique', light: 'Clair', dark: 'Sombre' }[ui.theme]);
	const tankCount = $derived(store.view?.aquariums.length ?? 0);
	const pending = $derived(store.pending.length);
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

<Section>
	<Row href="/reglages/notifications" icon="bell" iconColor="var(--red)" title="Notifications" value={notifications} />
	<Row href="/reglages/affichage" title="Affichage" value={themeLabel}>
		{#snippet leading()}
			<span class="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px] bg-blue text-[13px] font-bold tracking-tight text-white" aria-hidden="true">AA</span>
		{/snippet}
	</Row>
	<Row href="/reglages/sauvegarde" icon="sync" iconColor="var(--green)" title="Sauvegarde" value={backupValue} />
	<Row href="/reglages/raccourcis" title="Raccourcis Siri">
		{#snippet leading()}
			<span class="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px] bg-purple text-white" aria-hidden="true">
				<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round">
					<path d="M12 3.5l8 4.5-8 4.5L4 8z" fill="currentColor" fill-opacity="0.4" />
					<path d="M4 12l8 4.5 8-4.5M4 16l8 4.5 8-4.5" stroke-linecap="round" />
				</svg>
			</span>
		{/snippet}
	</Row>
</Section>

<Section
	header="Synchronisation"
	footer={online
		? 'L’appli marche hors ligne : tes saisies partent dès que le réseau revient.'
		: 'Pas de réseau : tes saisies restent sur l’iPhone et partiront à la prochaine connexion.'}
>
	<Row title="État">
		{#snippet trailing()}
			<span class="body flex items-center gap-2 text-label2">
				<span class="h-2.5 w-2.5 rounded-full {online ? 'bg-green' : 'bg-orange'}" aria-hidden="true"></span>
				{online ? 'En ligne' : 'Hors ligne'}
			</span>
		{/snippet}
	</Row>
	<Row title="Saisies en attente">
		{#snippet trailing()}
			<span class="body {pending ? 'font-semibold text-orange' : 'text-label2'}">{pending ? `${pending} à envoyer` : 'Aucune'}</span>
		{/snippet}
	</Row>
	<Row title="Dernière synchronisation" value={lastSync} />
	<li>
		<button class="tappable flex w-full items-center gap-2 pl-4" onclick={syncNow} disabled={syncing || !online}>
			<span class="row-body flex min-h-11 flex-1 items-center gap-2 py-2.5 pr-4">
				<span class="body {syncing || !online ? 'text-label3' : 'text-tint'}">{syncing ? 'Synchronisation…' : 'Synchroniser maintenant'}</span>
				{#if syncing}<Spinner spinning size={18} />{/if}
			</span>
		</button>
	</li>
</Section>

<Section header="À propos">
	<Row title="Version" value="0.0.1" />
	<Row title="Espèces" value="FishBase, SeaLifeBase" />
</Section>

<form method="POST" action="/logout" class="mb-8" onsubmit={logout}>
	<ul class="group">
		<li>
			<button class="tappable body flex min-h-11 w-full items-center justify-center text-red">Se déconnecter</button>
		</li>
	</ul>
</form>

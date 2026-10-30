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
	import Spinner from '$lib/ios/Spinner.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { TANK_ICON, TANK_TONE } from '$lib/ui';
	import type { NotificationSettings } from '$lib/types';

	let installed = $state(false);
	let supported = $state(true);
	let permission = $state<NotificationPermission | 'indisponible'>('indisponible');
	let subscription = $state<SyncState | 'vérification'>('vérification');
	let busy = $state(false);

	let settings = $state<NotificationSettings | null>(null);
	let loadError = $state('');
	let saving = $state(false);

	const active = $derived(permission === 'granted' && (subscription === 'actif' || subscription === 'recréé'));
	const aquariums = $derived(store.view?.aquariums ?? []);
	const quiet = $derived(Boolean(settings?.quietStart && settings?.quietEnd));

	async function refresh() {
		permission = 'Notification' in window ? Notification.permission : 'indisponible';
		try {
			subscription = await syncSubscription();
		} catch {
			subscription = 'inactif';
		}
	}

	async function load() {
		loadError = '';
		try {
			settings = await store.fetchNotificationSettings();
		} catch (error) {
			loadError = (error as Error).message;
		}
	}

	onMount(() => {
		installed = isStandalone();
		supported = pushSupported();
		if (supported) void refresh();
		void load();
	});

	/** Enregistre tout de suite après chaque changement ; en cas d'échec, revient à l'état serveur. */
	async function save(patch: Partial<NotificationSettings>) {
		if (!settings) return;
		const previous = $state.snapshot(settings) as NotificationSettings;
		settings = { ...settings, ...patch };
		saving = true;
		try {
			settings = await store.saveNotificationSettings($state.snapshot(settings) as NotificationSettings);
		} catch (error) {
			settings = previous;
			ui.show((error as Error).message);
		} finally {
			saving = false;
		}
	}

	async function toggleReminders(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		if (!input.checked) return;
		busy = true;
		try {
			subscription = await enableReminders();
			permission = Notification.permission;
			ui.show(subscription === 'inactif' ? 'Notifications non autorisées' : 'Rappels activés', undefined, subscription === 'inactif' ? undefined : 'check');
		} catch (error) {
			ui.show((error as Error).message);
		} finally {
			busy = false;
			input.checked = active;
		}
	}

	async function test() {
		busy = true;
		try {
			const { sent, total } = await sendTest();
			ui.show(total === 0 ? 'Aucun appareil abonné' : `Notification envoyée (${sent}/${total})`, undefined, total ? 'check' : undefined);
			await refresh();
		} catch (error) {
			ui.show((error as Error).message);
		} finally {
			busy = false;
		}
	}

	function toggleQuiet(event: Event) {
		const on = (event.currentTarget as HTMLInputElement).checked;
		void save(on ? { quietStart: '22:00', quietEnd: '07:00' } : { quietStart: null, quietEnd: null });
	}

	function toggleTank(id: number) {
		if (!settings) return;
		const all = aquariums.map((a) => a.id);
		const current = settings.aquariumIds ?? all;
		let next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
		if (next.length === 0) {
			ui.show('Garde au moins un bac');
			return;
		}
		// Tous les bacs cochés : on revient à « tous » pour inclure les bacs ajoutés plus tard.
		void save({ aquariumIds: all.every((x) => next.includes(x)) ? null : next });
	}

	let topic = $state('');
	$effect(() => {
		if (settings) topic = settings.ntfyTopic ?? '';
	});
	function saveTopic() {
		const value = topic.trim();
		if ((settings?.ntfyTopic ?? '') !== value) void save({ ntfyTopic: value || null });
	}

	const remindersFooter = $derived(
		!supported
			? 'Les notifications ne sont pas disponibles sur cet appareil.'
			: !installed
				? 'Sur iPhone, les rappels demandent l’appli sur l’écran d’accueil : dans Safari, touche Partager, puis « Sur l’écran d’accueil », et ouvre Aquarium depuis son icône.'
				: permission === 'denied'
					? 'Notifications refusées : réactive-les dans Réglages > Notifications > Aquarium.'
					: active
						? 'Pour couper les rappels, désactive les notifications d’Aquarium dans les Réglages de l’iPhone.'
						: 'Active les rappels pour recevoir le récapitulatif des tâches du jour.'
	);
</script>

<svelte:head><title>Notifications · Aquarium</title></svelte:head>

<NavBar title="Notifications" back={{ href: '/reglages', label: 'Réglages' }} large={false} />

<Section class="mt-2" footer={remindersFooter}>
	<Row icon="bell" iconColor="var(--red)" title="Rappels">
		{#snippet trailing()}
			<Switch checked={active} disabled={busy || !supported || !installed || permission === 'denied' || active} onchange={toggleReminders} label="Activer les rappels" />
		{/snippet}
	</Row>
	<Row title="Envoyer une notification de test" action onclick={test} disabled={busy || !active} />
</Section>

{#if !settings}
	<div class="grid place-items-center py-12">
		{#if loadError}
			<p class="subhead mb-3 text-center text-label2">{loadError}</p>
			<button class="btn-plain" onclick={load}>Réessayer</button>
		{:else}
			<Spinner spinning />
		{/if}
	</div>
{:else}
	<Section header="Récapitulatif quotidien" footer="Une notification par jour avec les tâches dues, à cette heure-là (heure de Paris).">
		<Row title="Heure">
			{#snippet trailing()}
				<input
					type="time"
					value={settings?.summaryTime}
					onchange={(e) => e.currentTarget.value && save({ summaryTime: e.currentTarget.value })}
					class="body rounded-lg bg-fill3 px-2.5 py-1 text-right"
					aria-label="Heure du récapitulatif"
				/>
			{/snippet}
		</Row>
	</Section>

	<Section header="Heures de silence" footer={quiet ? 'Aucune notification pendant cette plage. Le récapitulatif attend la fin du silence.' : 'Coupe les notifications la nuit, par exemple.'}>
		<Row title="Heures de silence">
			{#snippet trailing()}
				<Switch checked={quiet} onchange={toggleQuiet} label="Heures de silence" />
			{/snippet}
		</Row>
		{#if quiet}
			<Row title="De">
				{#snippet trailing()}
					<input
						type="time"
						value={settings?.quietStart}
						onchange={(e) => e.currentTarget.value && save({ quietStart: e.currentTarget.value })}
						class="body rounded-lg bg-fill3 px-2.5 py-1 text-right"
						aria-label="Début du silence"
					/>
				{/snippet}
			</Row>
			<Row title="À">
				{#snippet trailing()}
					<input
						type="time"
						value={settings?.quietEnd}
						onchange={(e) => e.currentTarget.value && save({ quietEnd: e.currentTarget.value })}
						class="body rounded-lg bg-fill3 px-2.5 py-1 text-right"
						aria-label="Fin du silence"
					/>
				{/snippet}
			</Row>
		{/if}
	</Section>

	<Section
		header="Bilan du dimanche"
		footer={settings.weeklyReport
			? 'Un bilan de ta semaine : tâches faites, valeurs hors plage, points marquants. Il part le dimanche à cette heure-là (heure de Paris).'
			: 'Reçois le dimanche un bilan de ta semaine : tâches faites, valeurs hors plage, points marquants.'}
	>
		<Row title="Bilan du dimanche">
			{#snippet trailing()}
				<Switch checked={settings?.weeklyReport ?? true} onchange={(e) => save({ weeklyReport: e.currentTarget.checked })} label="Bilan du dimanche" />
			{/snippet}
		</Row>
		{#if settings.weeklyReport}
			<Row title="Heure">
				{#snippet trailing()}
					<input
						type="time"
						value={settings?.weeklyTime}
						onchange={(e) => e.currentTarget.value && save({ weeklyTime: e.currentTarget.value })}
						class="body rounded-lg bg-fill3 px-2.5 py-1 text-right"
						aria-label="Heure du bilan du dimanche"
					/>
				{/snippet}
			</Row>
		{/if}
	</Section>

	{#if aquariums.length}
		<Section header="Bacs concernés" footer={settings.aquariumIds == null ? 'Tous les bacs, y compris ceux que tu ajouteras.' : 'Seules les tâches de ces bacs apparaissent dans les rappels.'}>
			{#each aquariums as a (a.id)}
				{@const on = settings.aquariumIds == null || settings.aquariumIds.includes(a.id)}
				<Row icon={TANK_ICON[a.waterType]} iconColor={TANK_TONE[a.waterType]} title={a.name} onclick={() => toggleTank(a.id)}>
					{#snippet trailing()}
						<span class="w-6 text-tint" aria-hidden="true">
							{#if on}<Icon name="check" size={20} weight={2.6} />{/if}
						</span>
					{/snippet}
				</Row>
			{/each}
		</Section>
	{/if}

	<Section
		header="Repli"
		footer="Si les notifications de l’iPhone ne passent plus, le récapitulatif part aussi sur ntfy : installe l’appli ntfy et abonne-toi au même sujet. L’envoi par e-mail n’est pas encore disponible."
	>
		<li class="flex items-center gap-3 pl-4">
			<span class="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px] bg-gray text-white" style="--cut: var(--gray)">
				<Icon name="bell" size={19} filled weight={2} />
			</span>
			<div class="row-body flex min-h-11 min-w-0 flex-1 items-center gap-3 py-1.5 pr-4">
				<label for="ntfy" class="body shrink-0">Sujet ntfy</label>
				<input
					id="ntfy"
					bind:value={topic}
					onblur={saveTopic}
					onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
					placeholder="aucun"
					autocapitalize="off"
					autocomplete="off"
					spellcheck="false"
					class="body min-w-0 flex-1 bg-transparent text-right text-label2 outline-none placeholder:text-label3"
				/>
			</div>
		</li>
	</Section>

	{#if saving}<p class="footnote -mt-4 text-center text-label3">Enregistrement…</p>{/if}
{/if}

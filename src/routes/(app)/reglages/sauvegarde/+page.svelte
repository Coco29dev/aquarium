<script lang="ts">
	import { onMount } from 'svelte';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Spinner from '$lib/ios/Spinner.svelte';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import { daysBetween, dayInParis } from '$lib/domain/dates';
	import type { BackupStatus } from '$lib/types';

	/** « aujourd'hui à 03:10 », « hier », « il y a 5 jours ». */
	function backupAge(iso: string): string {
		const days = daysBetween(dayInParis(iso), dayInParis());
		if (days <= 0) return `aujourd’hui à ${new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}`;
		return days === 1 ? 'hier' : `il y a ${days} jours`;
	}

	let status = $state<BackupStatus | null>(null);
	let loadError = $state('');
	let running = $state(false);

	async function load() {
		loadError = '';
		try {
			status = await store.fetchBackup();
		} catch (error) {
			loadError = (error as Error).message;
		}
	}
	onMount(load);

	async function runNow() {
		running = true;
		try {
			status = await store.runBackup();
			ui.show('Sauvegarde faite', undefined, 'check');
		} catch (error) {
			ui.show((error as Error).message);
		} finally {
			running = false;
		}
	}

	const size = (bytes: number | null) =>
		bytes == null ? '—' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
	const when = (iso: string | null) =>
		iso
			? new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
			: 'Jamais';

	const exports: { href: string; title: string; format: string; icon: IconName; color: string }[] = [
		{ href: '/api/export?format=json', title: 'Tout exporter', format: 'JSON', icon: 'box', color: 'var(--green)' },
		{ href: '/api/export?format=csv&table=measurements', title: 'Mesures', format: 'CSV', icon: 'drop', color: 'var(--teal)' },
		{ href: '/api/export?format=csv&table=completions', title: 'Tâches réalisées', format: 'CSV', icon: 'today', color: 'var(--indigo)' },
		{ href: '/api/export?format=csv&table=expenses', title: 'Dépenses', format: 'CSV', icon: 'euro', color: 'var(--brown)' }
	];
</script>

<svelte:head><title>Sauvegarde · Aquarium</title></svelte:head>

<NavBar title="Sauvegarde" back={{ href: '/reglages', label: 'Réglages' }} large={false} />

<!-- État, façon Sauvegarde iCloud -->
<div class="mb-8 mt-4 flex flex-col items-center text-center">
	<span class="mb-3 grid h-16 w-16 place-items-center rounded-[18px] bg-green text-white" style="--cut: var(--green)">
		<Icon name="sync" size={34} weight={2.2} />
	</span>
	{#if status}
		<p class="title3">{status.lastBackupAt ? `Sauvegardé ${backupAge(status.lastBackupAt)}` : 'Aucune sauvegarde pour l’instant'}</p>
		<p class="subhead mt-1 text-label2">Sauvegarde automatique chaque dimanche</p>
	{:else if loadError}
		<p class="subhead text-label2">{loadError}</p>
		<button class="btn-plain mt-2" onclick={load}>Réessayer</button>
	{:else}
		<Spinner spinning />
	{/if}
</div>

{#if status}
	{#if !status.configured}
		<div class="group mb-8 flex gap-3 p-4">
			<span class="text-orange" style="--cut: var(--bg2)"><Icon name="alert" size={22} filled /></span>
			<p class="subhead text-label2">
				Le stockage permanent n’est pas configuré : la sauvegarde est écrite sur le disque du serveur, qui peut être effacé à chaque mise à jour. Pense à exporter régulièrement.
			</p>
		</div>
	{/if}

	<Section header="Dernière sauvegarde">
		<Row title="Date" value={when(status.lastBackupAt)} />
		<Row title="Taille" value={size(status.bytes)} />
		<Row title="Copies conservées" value="8 dernières" />
	</Section>

	<Section footer="Copie complète de tes bacs, mesures, tâches, vivants, matériel, dépenses et notes.">
		<li>
			<button class="tappable flex w-full items-center justify-center gap-2 px-4 py-2.5" onclick={runNow} disabled={running}>
				{#if running}<Spinner spinning size={20} />{/if}
				<span class="body {running ? 'text-label2' : 'text-tint'}">{running ? 'Sauvegarde en cours…' : 'Sauvegarder maintenant'}</span>
			</button>
		</li>
	</Section>
{/if}

<Section header="Exporter" footer="Le serveur garde tout ; l’export est ta copie personnelle, à ouvrir dans Fichiers ou Numbers.">
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

<Section
	header="Restaurer"
	footer="Remplace les données de l’appli par celles d’une sauvegarde. Tu vois d’abord ce qu’elle contient, et une sauvegarde de sécurité est faite avant."
>
	<Row href="/reglages/sauvegarde/restaurer?source=fichier" icon="download" iconColor="var(--blue)" title="Restaurer depuis un fichier…" />
	<Row href="/reglages/sauvegarde/restaurer?source=serveur" icon="undo" iconColor="var(--orange)" title="Restaurer depuis le serveur…" />
</Section>

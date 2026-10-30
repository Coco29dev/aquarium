<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Spinner from '$lib/ios/Spinner.svelte';
	import { restoreSession } from '$lib/ios/restoreSession.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import type { BackupListItem, RestorePreview } from '$lib/types';

	// Restauration : choisir une source, voir ce qu'elle contient, confirmer, puis remplacer les données.
	// Rien ne change avant la confirmation ; côté serveur tout se passe dans une transaction.

	const MAX_BYTES = 30 * 1024 * 1024;

	/** Libellés des tables de l'export, dans l'ordre d'affichage. */
	const LABELS: Record<string, string> = {
		aquariums: 'Aquariums',
		parameters: 'Paramètres suivis',
		measurements: 'Mesures',
		recurringTasks: 'Tâches récurrentes',
		taskCompletions: 'Tâches faites',
		events: 'Événements',
		feedings: 'Repas',
		inhabitants: 'Habitants',
		equipment: 'Matériel',
		consumables: 'Consommables',
		consumableReplacements: 'Remplacements de consommables',
		expenses: 'Dépenses',
		notes: 'Notes',
		photos: 'Photos (références)',
		projectItems: 'Éléments de projet'
	};

	type Step = 'source' | 'preview' | 'working' | 'done';
	type Source =
		| { kind: 'file'; name: string; size: number; payload: unknown }
		| { kind: 'server'; key: string; label: string };

	let localStep = $state<'source' | 'preview'>('source');
	// La restauration vide le cache local : la page est recréée pendant qu'elle se termine (voir restoreSession).
	const step = $derived<Step>(restoreSession.running ? 'working' : restoreSession.result ? 'done' : localStep);
	let source = $state<Source | null>(null);
	let preview = $state<RestorePreview | null>(null);
	let localError = $state('');
	const error = $derived(localError || restoreSession.error);
	const result = $derived(restoreSession.result);
	let checking = $state(false);
	let online = $state(true);

	let backups = $state<BackupListItem[] | null>(null);
	let backupsError = $state('');
	let fileInput = $state<HTMLInputElement>();

	async function loadBackups() {
		backupsError = '';
		try {
			backups = await store.listBackups();
		} catch (e) {
			backups = null;
			backupsError = message(e);
		}
	}

	onMount(() => {
		online = navigator.onLine;
		const update = () => {
			online = navigator.onLine;
			if (online && !backups) void loadBackups();
		};
		addEventListener('online', update);
		addEventListener('offline', update);
		if (online) void loadBackups();
		// « Restaurer depuis une sauvegarde du serveur » mène directement à la liste.
		if (page.url.searchParams.get('source') === 'serveur') {
			void tick().then(() => document.getElementById('serveur')?.scrollIntoView({ block: 'start' }));
		}
		return () => {
			removeEventListener('online', update);
			removeEventListener('offline', update);
		};
	});

	/** Message lisible : coupure réseau d'un côté, réponse du serveur de l'autre. */
	function message(e: unknown): string {
		if (e instanceof TypeError) return 'Connexion interrompue. Vérifie le réseau et réessaie.';
		return (e as Error).message || 'Erreur inconnue.';
	}

	const mo = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
	const size = (bytes: number | null) =>
		bytes == null ? '' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : mo(bytes);
	const when = (iso: string | null) =>
		iso
			? new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
			: 'Date inconnue';

	async function runPreview(next: Source, load: () => Promise<RestorePreview>) {
		localError = '';
		restoreSession.error = '';
		checking = true;
		try {
			preview = await load();
			source = next;
			localStep = 'preview';
		} catch (e) {
			localError = message(e);
		} finally {
			checking = false;
		}
	}

	async function onFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		localError = '';
		restoreSession.error = '';
		if (file.size > MAX_BYTES) {
			localError = `Ce fichier fait ${mo(file.size)} : c'est au-dessus de la limite de 30 Mo.`;
			return;
		}
		let payload: unknown;
		try {
			payload = JSON.parse(await file.text());
		} catch {
			payload = null;
		}
		if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
			localError = 'Ce fichier n’est pas un export JSON valide. Choisis un fichier créé avec « Tout exporter » dans Sauvegarde.';
			return;
		}
		await runPreview({ kind: 'file', name: file.name, size: file.size, payload }, () => store.previewRestore(payload));
	}

	function pickBackup(b: BackupListItem) {
		const label = `${b.kind === 'hebdo' ? 'Sauvegarde hebdomadaire' : 'Sauvegarde avant restauration'} du ${when(b.at)}`;
		void runPreview({ kind: 'server', key: b.key, label }, () => store.previewRestoreFromBackup(b.key));
	}

	function reset() {
		localStep = 'source';
		source = null;
		preview = null;
		localError = '';
		restoreSession.error = '';
	}

	// Lignes du tableau de comparaison : fichier face à l'état actuel.
	const rows = $derived.by(() => {
		if (!preview) return [];
		const keys = [...new Set([...Object.keys(LABELS), ...Object.keys(preview.counts), ...Object.keys(preview.current)])];
		return keys
			.map((key) => ({
				key,
				label: LABELS[key] ?? key,
				incoming: preview?.counts[key] ?? 0,
				current: preview?.current[key] ?? 0
			}))
			.filter((r) => r.incoming > 0 || r.current > 0);
	});
	const shrinking = $derived(rows.some((r) => r.incoming < r.current));
	const canRestore = $derived(Boolean(preview?.valid) && (preview?.errors.length ?? 0) === 0 && online);

	async function startRestore() {
		if (!source || !canRestore) return;
		const ok = await ui.confirm({
			title: 'Remplacer toutes les données actuelles ?',
			message: 'Une sauvegarde de sécurité est créée avant. Cette action ne peut pas être annulée depuis l’appli.',
			confirmLabel: 'Remplacer',
			destructive: true
		});
		if (!ok) return;
		localError = '';
		restoreSession.error = '';
		restoreSession.result = null;
		restoreSession.running = true;
		try {
			restoreSession.result =
				source.kind === 'file' ? await store.restore(source.payload) : await store.restoreFromBackup(source.key);
		} catch (e) {
			restoreSession.error =
				e instanceof TypeError
					? 'La connexion a été interrompue pendant la restauration. Ouvre Aujourd’hui pour vérifier que tes données sont intactes, puis réessaie.'
					: `La restauration a échoué : ${message(e)} Rien n’a été modifié.`;
		} finally {
			restoreSession.running = false;
		}
	}

	const safetyName = $derived(result?.safetyBackup.split('/').pop()?.replace(/\.json$/, '') ?? '');
	const total = $derived(Object.values(result?.counts ?? {}).reduce((a, b) => a + b, 0));

	function backToToday() {
		restoreSession.result = null;
		// Rechargement complet : l'appli repart de l'état du serveur.
		location.href = '/';
	}
</script>

<svelte:head><title>Restaurer · Aquarium</title></svelte:head>

<NavBar
	title="Restaurer"
	back={step === 'working' || step === 'done' ? undefined : { href: '/reglages/sauvegarde', label: 'Sauvegarde' }}
	large={false}
/>

<input bind:this={fileInput} type="file" accept="application/json,.json" class="hidden" onchange={onFile} />

{#if step === 'source'}
	<div class="mb-6 mt-4 flex flex-col items-center px-4 text-center">
		<span class="mb-3 grid h-16 w-16 place-items-center rounded-[18px] bg-orange text-white" style="--cut: var(--orange)">
			<Icon name="undo" size={34} weight={2.2} />
		</span>
		<p class="title3">Restaurer tes données</p>
		<p class="subhead mt-1 text-label2">
			Remplace tout le contenu de l’appli par celui d’une sauvegarde. Tu vois d’abord ce qu’elle contient : rien ne change avant ta confirmation.
		</p>
	</div>

	{#if !online}
		<p class="group subhead mb-6 flex items-center gap-2 px-4 py-3 text-orange">
			<Icon name="alert" size={18} />Pas de réseau : la restauration demande une connexion.
		</p>
	{/if}

	{#if error}
		<p class="subhead mb-6 flex gap-2 rounded-[18px] bg-red/10 px-4 py-3 text-red" role="alert">
			<span class="mt-0.5 shrink-0"><Icon name="alert" size={18} /></span>{error}
		</p>
	{/if}

	<Section header="Depuis un fichier" footer="Un fichier JSON créé avec « Tout exporter ». Les fichiers des photos ne sont pas dans l’export.">
		<Row
			icon="download"
			iconColor="var(--blue)"
			title="Choisir un fichier JSON…"
			chevron
			disabled={!online || checking}
			onclick={() => fileInput?.click()}
		/>
	</Section>

	<div id="serveur" class="scroll-mt-16"></div>
	<Section header="Depuis une sauvegarde du serveur" footer="Les sauvegardes automatiques du dimanche et celles faites juste avant une restauration.">
		{#if backups === null && !backupsError && online}
			<li class="grid place-items-center py-6"><Spinner spinning /></li>
		{:else if backupsError}
			<li class="px-4 py-3">
				<p class="subhead text-label2">{backupsError}</p>
				<button class="btn-plain subhead mt-1" onclick={loadBackups}>Réessayer</button>
			</li>
		{:else if backups && backups.length === 0}
			<li class="px-4 py-3"><p class="subhead text-label2">Aucune sauvegarde sur le serveur pour l’instant.</p></li>
		{:else if backups}
			{#each backups as b (b.key)}
				<Row
					icon="box"
					iconColor={b.kind === 'hebdo' ? 'var(--green)' : 'var(--orange)'}
					title={when(b.at)}
					subtitle={`${b.kind === 'hebdo' ? 'Hebdomadaire' : 'Avant une restauration'}${b.bytes ? ` · ${size(b.bytes)}` : ''}`}
					chevron
					disabled={checking}
					onclick={() => pickBackup(b)}
				/>
			{/each}
		{:else}
			<li class="px-4 py-3"><p class="subhead text-label2">Connecte-toi au réseau pour voir les sauvegardes du serveur.</p></li>
		{/if}
	</Section>

	{#if checking}
		<div class="flex items-center justify-center gap-2 pb-8">
			<Spinner spinning size={18} /><span class="subhead text-label2">Lecture de la sauvegarde…</span>
		</div>
	{/if}
{:else if step === 'preview' && preview && source}
	<div class="mb-4 mt-4 px-1">
		<p class="footnote font-semibold uppercase text-label2">Source</p>
		<p class="headline mt-0.5 break-words">{source.kind === 'file' ? source.name : source.label}</p>
		<p class="subhead text-label2">
			{source.kind === 'file' ? `${size(source.size)} · ` : ''}{preview.exportedAt ? `exporté le ${when(preview.exportedAt)}` : 'date d’export inconnue'}
		</p>
	</div>

	{#if error}
		<p class="subhead mb-6 flex gap-2 rounded-[18px] bg-red/10 px-4 py-3 text-red" role="alert">
			<span class="mt-0.5 shrink-0"><Icon name="alert" size={18} /></span>{error}
		</p>
	{/if}

	{#if preview.errors.length || !preview.valid}
		<div class="mb-6 rounded-[22px] bg-red/10 px-4 py-3.5" role="alert">
			<p class="headline mb-1 flex items-center gap-2 text-red"><Icon name="alert" size={20} filled />Ce fichier ne peut pas être restauré</p>
			<ul class="subhead flex flex-col gap-1 text-red">
				{#each preview.errors as e (e)}<li>{e}</li>{/each}
				{#if !preview.errors.length}<li>Le fichier n’a pas la structure d’un export de l’appli.</li>{/if}
			</ul>
			<p class="footnote mt-2 text-label2">Tes données actuelles n’ont pas été touchées.</p>
		</div>
	{/if}

	{#if preview.valid && preview.errors.length === 0}
	<Section
		header="Ce que contient la source"
		footer={shrinking ? 'En orange : la source en contient moins que l’appli aujourd’hui. Ces données-là seront remplacées et perdues.' : 'Les nombres de la source, face à ceux de ton appli aujourd’hui.'}
	>
		<li class="flex items-center gap-3 px-4 py-2">
			<span class="footnote min-w-0 flex-1 font-semibold uppercase text-label2">Données</span>
			<span class="footnote w-16 text-right font-semibold uppercase text-label2">Source</span>
			<span class="footnote w-16 text-right font-semibold uppercase text-label2">Actuel</span>
		</li>
		{#each rows as r (r.key)}
			<li class="flex items-center gap-3 px-4 py-2.5 shadow-[inset_0_0.5px_0_var(--sep)]">
				<span class="body min-w-0 flex-1">{r.label}</span>
				<span class="rounded-num body w-16 text-right font-semibold {r.incoming < r.current ? 'text-orange' : ''}">{r.incoming.toLocaleString('fr-FR')}</span>
				<span class="rounded-num body w-16 text-right text-label2">{r.current.toLocaleString('fr-FR')}</span>
			</li>
		{/each}
		{#if rows.length === 0}
			<li class="px-4 py-3"><p class="subhead text-label2">Cette source est vide.</p></li>
		{/if}
	</Section>
	{/if}

	{#if preview.warnings.length}
		<Section header="À savoir">
			{#each preview.warnings as w (w)}
				<li class="flex gap-3 px-4 py-3">
					<span class="mt-0.5 shrink-0 text-orange"><Icon name="info" size={20} /></span>
					<p class="subhead">{w}</p>
				</li>
			{/each}
		</Section>
	{/if}

	<div class="mb-8 flex flex-col gap-3">
		{#if canRestore}
			<button class="btn-filled w-full" style="background: var(--red)" onclick={startRestore}>
				Remplacer les données actuelles
			</button>
			<p class="footnote px-4 text-center text-label2">Une sauvegarde de sécurité de l’état actuel est faite juste avant.</p>
		{/if}
		<button class="btn-plain w-full py-2" onclick={reset}>Choisir une autre source</button>
	</div>
{:else if step === 'working'}
	<div class="grid min-h-[60dvh] place-items-center text-center">
		<div class="flex flex-col items-center px-6">
			<Spinner spinning size={40} />
			<p class="title3 mt-5">Restauration en cours…</p>
			<p class="subhead mt-1.5 max-w-64 text-label2">Une sauvegarde de sécurité est faite, puis les données sont remplacées. Garde l’appli ouverte.</p>
		</div>
	</div>
{:else if step === 'done' && result}
	<div class="mb-8 mt-6 flex flex-col items-center text-center">
		<span class="mb-3 grid h-16 w-16 place-items-center rounded-full bg-green text-white" style="animation: pop-in 320ms both">
			<Icon name="check" size={36} weight={3} />
		</span>
		<p class="title2">Restauration terminée</p>
		<p class="subhead mt-1 text-label2">{total.toLocaleString('fr-FR')} lignes restaurées.</p>
	</div>

	<Section header="Restauré">
		{#each Object.keys(LABELS).filter((k) => (result?.counts[k] ?? 0) > 0) as k (k)}
			<Row title={LABELS[k]} value={(result.counts[k] ?? 0).toLocaleString('fr-FR')} />
		{/each}
	</Section>

	{#if safetyName}
		<Section header="Sauvegarde de sécurité" footer="L’état d’avant la restauration est gardé sur le serveur. Tu peux la restaurer à son tour depuis la liste des sauvegardes.">
			<li class="px-4 py-3"><p class="rounded-num subhead break-all text-label2">{safetyName}</p></li>
		</Section>
	{/if}

	<button class="btn-filled mb-8 w-full" onclick={backToToday}>Retour à Aujourd’hui</button>
{/if}

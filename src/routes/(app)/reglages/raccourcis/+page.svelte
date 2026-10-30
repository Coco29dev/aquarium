<script lang="ts">
	import { onMount } from 'svelte';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { dayInParis } from '$lib/domain/dates';
	import { relativeDay } from '$lib/ui';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Segmented from '$lib/ios/Segmented.svelte';
	import Sheet from '$lib/ios/Sheet.svelte';
	import SwipeRow from '$lib/ios/SwipeRow.svelte';
	import InputRow from '$lib/ios/InputRow.svelte';
	import CopyBlock from '$lib/ios/CopyBlock.svelte';
	import Spinner from '$lib/ios/Spinner.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import type { ShortcutToken } from '$lib/types';

	// Raccourcis Siri et bouton Action : des jetons privés qui n'ouvrent que /api/shortcuts/* (mesure, tâche, repas).

	let origin = $state('');
	let tokens = $state<ShortcutToken[] | null>(null);
	let loadError = $state('');
	/** Jeton qu'on vient de créer : le seul moment où on peut le voir. */
	let created = $state<{ id: number; token: string; label: string } | null>(null);
	let tested = $state<{ ok: boolean; message: string } | null>(null);
	let testing = $state(false);

	let creating = $state(false);
	let labelInput = $state('iPhone');
	let busy = $state(false);

	type RecipeId = 'feed' | 'measure' | 'task';
	let recipeId = $state<RecipeId>('feed');

	interface Field {
		key: string;
		type: 'Texte' | 'Nombre';
		value: string;
		note: string;
	}
	interface Recipe {
		name: string;
		path: string;
		intro: string;
		before?: string;
		fields: Field[];
		reply: string;
	}
	const RECIPES: Record<RecipeId, Recipe> = {
		feed: {
			name: 'Nourri',
			path: '/api/shortcuts/feed',
			intro: 'Note un repas sans ouvrir l’appli. Siri te dit combien de repas ont déjà eu lieu aujourd’hui.',
			fields: [
				{ key: 'aquarium', type: 'Texte', value: 'Salon', note: 'Nom du bac. Tu peux l’omettre s’il n’y en a qu’un.' },
				{ key: 'note', type: 'Texte', value: 'Granulés', note: 'Facultatif.' }
			],
			reply: 'Repas noté pour Salon : 2e aujourd’hui.'
		},
		measure: {
			name: 'Nitrates',
			path: '/api/shortcuts/measure',
			intro: 'Dicte une valeur : elle est enregistrée avec l’heure et Siri te dit si elle sort de la plage.',
			before: 'Ajoute d’abord l’action « Demander une entrée » : type Nombre, question « Nitrates ? ». Sa réponse sera la valeur.',
			fields: [
				{ key: 'aquarium', type: 'Texte', value: 'Salon', note: 'Nom du bac. Tu peux l’omettre s’il n’y en a qu’un.' },
				{ key: 'parameter', type: 'Texte', value: 'Nitrates', note: 'Nom ou abréviation : nitrates, NO3, pH, KH…' },
				{ key: 'value', type: 'Nombre', value: 'Entrée fournie', note: 'La variable de « Demander une entrée ».' }
			],
			reply: 'Nitrates du Salon : 25,5 mg/L, c’est noté.'
		},
		task: {
			name: 'Changement d’eau fait',
			path: '/api/shortcuts/task',
			intro: 'Coche une tâche due. Une tâche de changement d’eau crée aussi son événement dans le journal du bac.',
			fields: [
				{ key: 'aquarium', type: 'Texte', value: 'Salon', note: 'Nom du bac. Tu peux l’omettre s’il n’y en a qu’un.' },
				{ key: 'title', type: 'Texte', value: 'Changement d’eau', note: 'Un morceau du titre de la tâche suffit.' }
			],
			reply: 'Changement d’eau 30 % fait pour Salon. Prochaine échéance : vendredi 6 novembre.'
		}
	};
	const recipe = $derived(RECIPES[recipeId]);
	const jsonBody = $derived(
		JSON.stringify(
			Object.fromEntries(
				recipe.fields.filter((f) => f.key !== 'note').map((f) => [f.key, f.type === 'Nombre' ? 25 : f.value])
			),
			null,
			2
		)
	);
	const bearer = $derived(`Bearer ${created?.token ?? 'COLLE_TON_JETON'}`);

	async function load() {
		loadError = '';
		try {
			tokens = await store.listShortcutTokens();
		} catch (e) {
			tokens = null;
			loadError = (e as Error).message;
		}
	}
	onMount(() => {
		origin = location.origin;
		void load();
	});

	function openCreate() {
		labelInput = 'iPhone';
		creating = true;
	}

	async function create() {
		const label = labelInput.trim();
		if (!label || busy) return;
		busy = true;
		try {
			const { id, token } = await store.createShortcutToken(label);
			created = { id, token, label };
			tested = null;
			creating = false;
			await load();
		} catch (e) {
			ui.show((e as Error).message);
		} finally {
			busy = false;
		}
	}

	async function revoke(t: ShortcutToken) {
		const ok = await ui.confirm({
			title: `Révoquer « ${t.label} » ?`,
			message: 'Les raccourcis qui utilisent ce jeton cesseront de fonctionner. Tu pourras en créer un autre.',
			confirmLabel: 'Révoquer',
			destructive: true
		});
		if (!ok) return;
		try {
			await store.revokeShortcutToken(t.id);
			if (created?.id === t.id) created = null;
			ui.show('Jeton révoqué', undefined, 'check');
			await load();
		} catch (e) {
			ui.show((e as Error).message);
		}
	}

	/** Teste le jeton tout neuf sans la session de l'appli : c'est ce que fera le raccourci. */
	async function testConnection() {
		if (!created) return;
		testing = true;
		tested = null;
		try {
			const response = await fetch('/api/shortcuts/ping', {
				headers: { authorization: `Bearer ${created.token}` },
				credentials: 'omit'
			});
			const data = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
			tested = { ok: response.ok && data?.ok !== false, message: data?.message ?? `Erreur ${response.status}` };
		} catch {
			tested = { ok: false, message: 'Connexion impossible. Vérifie le réseau.' };
		} finally {
			testing = false;
		}
	}

	const createdOn = (iso: string) =>
		new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' });
	const usage = (t: ShortcutToken) =>
		t.lastUsedAt ? `utilisé ${relativeDay(dayInParis(t.lastUsedAt))}` : 'jamais utilisé';
</script>

<svelte:head><title>Raccourcis · Aquarium</title></svelte:head>

<NavBar title="Raccourcis" back={{ href: '/reglages', label: 'Réglages' }} large={false} />

<div class="mb-6 mt-4 flex flex-col items-center px-4 text-center">
	<span class="mb-3 grid h-16 w-16 place-items-center rounded-[18px] bg-purple text-white">
		<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">
			<path d="M12 3.5l8 4.5-8 4.5L4 8z" fill="currentColor" fill-opacity="0.35" />
			<path d="M4 12l8 4.5 8-4.5M4 16l8 4.5 8-4.5" stroke-linecap="round" />
		</svg>
	</span>
	<p class="title3">Siri et bouton Action</p>
	<p class="subhead mt-1 text-label2">
		Note un repas, une mesure ou une tâche faite en une phrase, sans ouvrir l’appli. Chaque raccourci utilise un jeton privé qui ne donne accès qu’à ces actions.
	</p>
</div>

{#if created}
	<Section header="Ton nouveau jeton" footer="Garde-le pour la prochaine étape : colle-le dans ton raccourci. Si tu le perds, révoque-le et crées-en un autre.">
		<CopyBlock label={created.label} value={created.token} copied="Jeton copié" />
		<li class="flex items-start gap-3 px-4 py-3 shadow-[inset_0_0.5px_0_var(--sep)]">
			<span class="mt-0.5 shrink-0 text-orange"><Icon name="alert" size={20} /></span>
			<p class="subhead"><span class="font-semibold">Il ne sera plus affiché.</span> Copie-le maintenant, tu ne pourras pas le revoir.</p>
		</li>
		<li class="shadow-[inset_0_0.5px_0_var(--sep)]">
			<button class="tappable flex w-full items-center justify-center gap-2 px-4 py-2.5" onclick={testConnection} disabled={testing}>
				{#if testing}<Spinner spinning size={18} />{/if}
				<span class="body {testing ? 'text-label2' : 'text-tint'}">{testing ? 'Test en cours…' : 'Tester la connexion'}</span>
			</button>
		</li>
		{#if tested}
			<li class="flex items-start gap-3 px-4 py-3 shadow-[inset_0_0.5px_0_var(--sep)]" role="status">
				<span class="mt-0.5 shrink-0 {tested.ok ? 'text-green' : 'text-red'}"><Icon name={tested.ok ? 'check' : 'alert'} size={20} weight={2.4} /></span>
				<p class="subhead {tested.ok ? '' : 'text-red'}">{tested.ok ? `Connexion réussie. ${tested.message}` : tested.message}</p>
			</li>
		{/if}
		<li class="shadow-[inset_0_0.5px_0_var(--sep)]">
			<button class="tappable flex w-full items-center justify-center px-4 py-2.5" onclick={() => (created = null)}>
				<span class="body text-tint">J’ai copié mon jeton</span>
			</button>
		</li>
	</Section>
{/if}

<Section
	header="Jetons actifs"
	footer={tokens && tokens.length ? 'Glisse un jeton vers la gauche pour le révoquer.' : undefined}
>
	{#if tokens === null && !loadError}
		<li class="grid place-items-center py-6"><Spinner spinning /></li>
	{:else if loadError}
		<li class="px-4 py-3">
			<p class="subhead text-label2">{loadError}</p>
			<button class="btn-plain subhead mt-1" onclick={load}>Réessayer</button>
		</li>
	{:else if tokens && tokens.length === 0}
		<li class="px-4 py-3"><p class="subhead text-label2">Aucun jeton pour l’instant.</p></li>
	{:else if tokens}
		{#each tokens as t (t.id)}
			<SwipeRow trailing={[{ label: 'Révoquer', icon: 'trash', color: 'var(--red)', onaction: () => revoke(t) }]}>
				<Row bare icon="lock" iconColor="var(--purple)" title={t.label} subtitle={`Créé le ${createdOn(t.createdAt)} · ${usage(t)}`} />
			</SwipeRow>
		{/each}
	{/if}
	<Row title="Créer un jeton…" action chevron={false} onclick={openCreate} />
</Section>

<Section header="Recettes" inset={false}>
	<Segmented
		label="Recette"
		bind:value={recipeId}
		options={[
			{ value: 'feed', label: 'Nourri' },
			{ value: 'measure', label: 'Mesure' },
			{ value: 'task', label: 'Tâche faite' }
		]}
	/>
</Section>

{#snippet step(n: number, text: string)}
	<li class="flex items-start gap-3 px-4 py-3 shadow-[inset_0_0.5px_0_var(--sep)]">
	<span class="rounded-num mt-px grid h-6 w-6 shrink-0 place-items-center rounded-full bg-fill2 text-[13px] font-semibold">{n}</span>
	<p class="body min-w-0 flex-1">{@html text}</p>
	</li>
{/snippet}

<Section header="Raccourci « {recipe.name} »" footer={recipe.intro}>
	{@render step(1, 'Ouvre l’appli <b>Raccourcis</b> et touche <b>+</b> pour créer un raccourci.')}
	{#if recipe.before}{@render step(2, recipe.before)}{/if}
	{@render step(recipe.before ? 3 : 2, 'Ajoute l’action <b>Obtenir le contenu de l’URL</b> et colle cette adresse :')}
	<li class="shadow-[inset_0_0.5px_0_var(--sep)]"><CopyBlock label="Adresse" value={`${origin}${recipe.path}`} /></li>
	{@render step(recipe.before ? 4 : 3, 'Touche la flèche pour afficher les options et règle <b>Méthode : POST</b>.')}
	{@render step(recipe.before ? 5 : 4, 'Ajoute un <b>en-tête</b> : nom <b>Authorization</b>, texte :')}
	<li class="shadow-[inset_0_0.5px_0_var(--sep)]">
		<CopyBlock
			label="En-tête Authorization"
			value={bearer}
			hint={created ? undefined : 'Remplace COLLE_TON_JETON par ton jeton. Il n’est plus affiché : crée-en un nouveau si tu l’as perdu.'}
			copied="En-tête copié"
		/>
	</li>
	{@render step(recipe.before ? 6 : 5, 'Règle <b>Corps de la requête : JSON</b>. C’est obligatoire : sans ça, l’appli répond « 403 ». Ajoute un champ par ligne :')}
	{#each recipe.fields as f (f.key)}
		<li class="flex items-baseline gap-3 px-4 py-2 pl-[3.25rem] shadow-[inset_0_0.5px_0_var(--sep)]">
			<span class="rounded-num body font-semibold">{f.key}</span>
			<span class="footnote rounded-full bg-fill2 px-2 py-0.5 text-label2">{f.type}</span>
			<span class="subhead min-w-0 flex-1 text-right text-label2">{f.value}</span>
		</li>
		<li class="px-4 pb-2 pl-[3.25rem]"><p class="footnote text-label2">{f.note}</p></li>
	{/each}
	<li class="shadow-[inset_0_0.5px_0_var(--sep)]">
		<CopyBlock label="Corps de la requête (JSON)" value={jsonBody} hint="Dans Raccourcis, un champ par clé : même nom, même valeur." copied="Corps copié" />
	</li>
	{@render step(recipe.before ? 7 : 6, 'Ajoute <b>Obtenir la valeur du dictionnaire</b> : clé <b>message</b>, dans « Contenu de l’URL ».')}
	{@render step(recipe.before ? 8 : 7, 'Ajoute <b>Énoncer le texte</b> avec cette valeur : Siri répond à voix haute, par exemple « ' + recipe.reply + ' »')}
	{@render step(recipe.before ? 9 : 8, 'Nomme le raccourci <b>« ' + recipe.name + ' »</b>. Pour le lancer : « Dis Siri, ' + recipe.name + ' ».')}
</Section>

<Section
	header="Bouton Action"
	footer="Si ton iPhone a un bouton Action : Réglages de l’iPhone, Bouton Action, Raccourci, puis choisis ton raccourci. Autre option sur tous les modèles : Réglages, Accessibilité, Toucher, Toucher au dos."
>
	<li class="flex items-start gap-3 px-4 py-3">
		<span class="mt-0.5 shrink-0 text-tint"><Icon name="info" size={20} /></span>
		<p class="subhead">Un seul geste, appli fermée : la réponse de Siri te confirme que c’est enregistré. Hors ligne, le raccourci échoue : l’appli reste la solution de secours.</p>
	</li>
</Section>

<Sheet
	open={creating}
	title="Nouveau jeton"
	detent="medium"
	onclose={() => (creating = false)}
	action={{ label: 'Créer', onclick: create, disabled: !labelInput.trim() || busy }}
>
	<Section footer="Donne-lui le nom de l’appareil où tu l’utilises, par exemple « iPhone ». Tu pourras le révoquer à tout moment.">
		<InputRow label="Nom du jeton" wide bind:value={labelInput} placeholder="iPhone" />
	</Section>
</Sheet>

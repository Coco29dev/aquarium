<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { listResource } from '$lib/client/api';
	import { buildHelpText, type HelpEquipment, type HelpInhabitant, type HelpOptions } from '$lib/domain/help';
	import Icon from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Segmented from '$lib/ios/Segmented.svelte';
	import Switch from '$lib/ios/Switch.svelte';

	const id = $derived(Number(page.params.id));
	const view = $derived(store.view);
	const aquarium = $derived(view?.aquariums.find((a) => a.id === id));

	let inhabitants = $state<HelpInhabitant[]>([]);
	let equipment = $state<HelpEquipment[]>([]);
	let loadError = $state('');

	// Réglages gardés le temps de la session : on revient souvent ajuster la question.
	const KEY = $derived(`aide-${id}`);
	let question = $state('');
	let days = $state<14 | 30>(14);
	let include = $state<HelpOptions['include']>({ params: true, stock: true, equipment: true, actions: true, alerts: true });
	let restored = $state(false);

	onMount(async () => {
		try {
			const saved = JSON.parse(sessionStorage.getItem(`aide-${id}`) ?? 'null');
			if (saved) {
				question = String(saved.question ?? '');
				days = saved.days === 30 ? 30 : 14;
				include = { ...include, ...saved.include };
			}
		} catch {
			// Stockage de session indisponible : on garde les valeurs par défaut.
		}
		restored = true;
		try {
			[inhabitants, equipment] = await Promise.all([
				listResource<HelpInhabitant>('inhabitants', id),
				listResource<HelpEquipment>('equipment', id)
			]);
		} catch (e) {
			loadError = `Peuplement et matériel indisponibles hors ligne : ${(e as Error).message}`;
		}
	});

	$effect(() => {
		if (!restored) return;
		const snapshot = JSON.stringify({ question, days, include });
		try {
			sessionStorage.setItem(KEY, snapshot);
		} catch {
			// Sans stockage de session, rien n'est mémorisé : sans conséquence.
		}
	});

	const text = $derived(
		view && aquarium
			? buildHelpText({ view, aquariumId: id, inhabitants, equipment, days, include, question })
			: ''
	);

	let preview = $state<HTMLElement>();
	const canShare = $derived(typeof navigator !== 'undefined' && typeof navigator.share === 'function');

	async function copy() {
		try {
			await navigator.clipboard.writeText(text);
			ui.show('Texte copié', undefined, 'check');
		} catch {
			// Presse-papiers refusé : on sélectionne le texte pour qu'on le copie par le menu iOS.
			if (preview) {
				const range = document.createRange();
				range.selectNodeContents(preview);
				const selection = getSelection();
				selection?.removeAllRanges();
				selection?.addRange(range);
			}
			ui.show('Texte sélectionné : touche Copier');
		}
	}

	async function share() {
		try {
			await navigator.share({ text });
		} catch (e) {
			if ((e as Error).name !== 'AbortError') ui.show('Partage impossible : copie le texte à la place.');
		}
	}

	const switches: { key: keyof HelpOptions['include']; label: string; hint: string }[] = [
		{ key: 'params', label: 'Paramètres', hint: 'Dernières valeurs, plages et tendances' },
		{ key: 'alerts', label: 'Alertes en cours', hint: 'Valeurs hors plage ou en dérive' },
		{ key: 'stock', label: 'Peuplement', hint: 'Espèces, quantités, arrivées récentes' },
		{ key: 'equipment', label: 'Matériel', hint: 'Filtre, éclairage, chauffage…' },
		{ key: 'actions', label: 'Dernières actions', hint: 'Changements d’eau, dosages, réglages' }
	];
</script>

<svelte:head><title>Demander de l'aide · {aquarium?.name ?? 'Bac'}</title></svelte:head>

{#if !aquarium}
	<NavBar title="Bac introuvable" back={{ href: '/aquariums', label: 'Bacs' }} large={false} />
{:else}
	<NavBar title="Demander de l’aide" back={{ href: `/aquariums/${id}`, label: aquarium.name }} large={false} />

	<p class="subhead mb-5 mt-2 px-1 text-label2">
		Un résumé clair de ton bac à coller sur un forum ou un groupe : c’est ce qu’on te demandera en premier. Le nom du bac n’y figure pas.
	</p>

	{#if loadError}<p class="subhead mb-4 rounded-2xl bg-orange/10 px-4 py-3 text-orange" role="status">{loadError}</p>{/if}

	<Section header="Ta question" footer="Décris le problème : ce que tu vois, depuis quand, ce que tu as déjà essayé.">
		<li class="p-1">
			<textarea
				bind:value={question}
				rows="4"
				class="body w-full resize-none bg-transparent p-3 outline-none placeholder:text-label3"
				placeholder="Ex. Des algues vertes sur les vitres depuis 10 jours…"
				aria-label="Ta question"
			></textarea>
		</li>
	</Section>

	<Section header="Période" footer="Les mesures des paramètres concernés sont reprises sur cette durée.">
		<li class="px-4 py-2.5"><Segmented label="Période" options={[{ value: 14, label: '14 jours' }, { value: 30, label: '30 jours' }]} bind:value={days} /></li>
	</Section>

	<Section header="Inclure">
		{#each switches as sw (sw.key)}
			<Row title={sw.label} subtitle={sw.hint}>
				{#snippet trailing()}<Switch bind:checked={include[sw.key]} label={sw.label} />{/snippet}
			</Row>
		{/each}
	</Section>

	<section class="mb-6">
		<h2 class="footnote px-4 pb-1.5 uppercase text-label2">Aperçu</h2>
		<div class="group">
			<pre
				bind:this={preview}
				class="font-mono select-text max-h-[22rem] overflow-auto whitespace-pre-wrap break-words p-4 text-[12.5px] leading-[1.45]"
				style="-webkit-user-select: text; user-select: text">{text}</pre>
		</div>
	</section>

	<div class="mb-8 flex flex-col gap-2.5">
		<button class="btn-filled w-full" onclick={copy} disabled={!text}>
			<Icon name="note" size={20} weight={2} />Copier le texte
		</button>
		{#if canShare}
			<button class="btn-tinted w-full" onclick={share} disabled={!text}>
				<Icon name="up" size={20} weight={2.2} />Partager…
			</button>
		{/if}
	</div>
{/if}

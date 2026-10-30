<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { WATER_TYPE_LABELS } from '$lib/types';
	import { TANK_ICON, TANK_TONE, fmt } from '$lib/ui';
	import Icon from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Sheet from '$lib/ios/Sheet.svelte';
	import FieldRow from '$lib/ios/FieldRow.svelte';
	import Stepper from '$lib/ios/Stepper.svelte';
	import type { Parameter } from '$lib/types';

	const id = $derived(Number(page.params.id));
	const view = $derived(store.view);
	const aquarium = $derived(view?.aquariums.find((a) => a.id === id));
	const parameters = $derived((view?.parameters ?? []).filter((p) => p.aquariumId === id));

	async function run(action: () => Promise<unknown>, done?: string): Promise<boolean> {
		try {
			await action();
			if (done) ui.show(done, undefined, 'check');
			return true;
		} catch (error) {
			ui.show((error as Error).message);
			return false;
		}
	}

	const num = (value: string): number | null => (value.trim() === '' ? null : Number(value.replace(',', '.')));
	const str = (v: number | null | undefined) => (v == null ? '' : String(v));

	// --- Bac : champs modifiables en ligne, « Enregistrer » apparaît dans la barre si modifié.
	let name = $state('');
	let volume = $state('');
	let started = $state('');
	/** Repas visés par jour : 0 = pas d'objectif. */
	let feedPerDay = $state(0);
	let loadedFor = $state<number | null>(null);
	$effect(() => {
		if (aquarium && loadedFor !== aquarium.id) {
			name = aquarium.name;
			volume = str(aquarium.volumeL);
			started = aquarium.startedOn ?? '';
			feedPerDay = aquarium.feedingsPerDay ?? 0;
			loadedFor = aquarium.id;
		}
	});
	const dirty = $derived(
		aquarium != null &&
			(name.trim() !== aquarium.name || num(volume) !== (aquarium.volumeL == null ? null : Number(aquarium.volumeL)) || (started || null) !== (aquarium.startedOn ?? null) || feedPerDay !== (aquarium.feedingsPerDay ?? 0))
	);
	async function saveAquarium() {
		if (!name.trim()) return;
		await run(
			() =>
				store.mutate('PATCH', `/api/aquariums/${id}`, {
					name: name.trim(),
					volumeL: num(volume),
					startedOn: started || null,
					feedingsPerDay: feedPerDay > 0 ? feedPerDay : null
				}),
			'Bac enregistré'
		);
	}

	async function removeAquarium() {
		const yes = await ui.confirm({
			title: `Supprimer « ${aquarium?.name} » ?`,
			message: 'Toutes ses mesures, tâches et notes seront supprimées. Pense à exporter avant.',
			confirmLabel: 'Supprimer',
			destructive: true
		});
		if (!yes) return;
		await run(async () => {
			await store.mutate('DELETE', `/api/aquariums/${id}`);
			await goto('/aquariums', { replaceState: true });
		});
	}

	// --- Paramètres : feuille d'édition ou d'ajout.
	let sheet = $state<{ mode: 'edit' | 'add'; p: Parameter | null } | null>(null);
	let pName = $state('');
	let pUnit = $state('');
	let pMin = $state('');
	let pMax = $state('');
	let pDrift = $state('');
	let pWait = $state('');

	function openParam(p: Parameter | null) {
		pName = p?.name ?? '';
		pUnit = p?.unit ?? '';
		pMin = str(p?.min);
		pMax = str(p?.max);
		pDrift = str(p?.driftPerWeek);
		pWait = str(p?.testWaitSeconds);
		sheet = { mode: p ? 'edit' : 'add', p };
	}

	// Arrivée depuis « Modifier la plage » : ouvre directement le paramètre visé.
	let target = $state<number | null>(null);
	onMount(() => {
		const match = location.hash.match(/^#param-(\d+)$/);
		if (match) target = Number(match[1]);
	});
	$effect(() => {
		if (target == null) return;
		const p = parameters.find((x) => x.id === target);
		if (p) {
			target = null;
			openParam(p);
		}
	});

	const body = () => ({ name: pName.trim(), unit: pUnit.trim(), min: num(pMin), max: num(pMax), driftPerWeek: num(pDrift), testWaitSeconds: num(pWait) });

	async function saveParam() {
		if (!sheet || !pName.trim()) return;
		const current = sheet;
		const ok =
			current.mode === 'edit' && current.p
				? await run(() => store.mutate('PATCH', `/api/parameters/${current.p!.id}`, body()), 'Paramètre enregistré')
				: await run(() => store.mutate('POST', `/api/aquariums/${id}/parameters`, body()), 'Paramètre ajouté');
		if (ok) sheet = null;
	}

	async function removeParam() {
		const p = sheet?.p;
		if (!p) return;
		const yes = await ui.confirm({
			title: `Supprimer « ${p.name} » ?`,
			message: 'Toutes ses mesures seront supprimées.',
			confirmLabel: 'Supprimer',
			destructive: true
		});
		if (!yes) return;
		const ok = await run(() => store.mutate('DELETE', `/api/parameters/${p.id}`));
		if (ok) sheet = null;
	}

	// --- Photo de couverture
	const cover = $derived(aquarium?.coverPhotoId ?? null);
	async function removeCover() {
		await run(() => store.mutate('PATCH', `/api/aquariums/${id}`, { coverPhotoId: null }), 'Photo de couverture retirée');
	}

	// --- Ordre des paramètres : mode « Modifier » avec poignées, glisser-déposer au doigt.
	let reordering = $state(false);
	let order = $state<number[]>([]);
	const ordered = $derived(order.map((pid) => parameters.find((p) => p.id === pid)).filter((p): p is Parameter => Boolean(p)));
	let dragIndex = $state<number | null>(null);
	let dragY = $state(0);
	let rowH = 44;
	let startY = 0;

	function startReorder() {
		order = parameters.map((p) => p.id);
		reordering = true;
	}
	async function finishReorder() {
		const ids = [...order];
		reordering = false;
		const same = ids.length === parameters.length && ids.every((pid, i) => parameters[i]?.id === pid);
		if (!same) await run(() => store.reorderParameters(id, ids), 'Ordre enregistré');
	}
	/** Indice d'arrivée de la ligne tirée, d'après le déplacement du doigt. */
	const dropIndex = $derived(
		dragIndex == null ? null : Math.max(0, Math.min(order.length - 1, dragIndex + Math.round(dragY / rowH)))
	);
	function shiftOf(i: number): number {
		if (dragIndex == null || dropIndex == null || i === dragIndex) return 0;
		if (dragIndex < dropIndex && i > dragIndex && i <= dropIndex) return -rowH;
		if (dragIndex > dropIndex && i < dragIndex && i >= dropIndex) return rowH;
		return 0;
	}
	function grab(e: PointerEvent, i: number) {
		const li = (e.currentTarget as HTMLElement).closest('li');
		rowH = li?.offsetHeight || 44;
		dragIndex = i;
		dragY = 0;
		startY = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function drag(e: PointerEvent) {
		if (dragIndex != null) dragY = e.clientY - startY;
	}
	function drop() {
		if (dragIndex == null || dropIndex == null) return;
		const next = [...order];
		const [moved] = next.splice(dragIndex, 1);
		next.splice(dropIndex, 0, moved);
		order = next;
		dragIndex = null;
		dragY = 0;
	}

	const range = (p: Parameter) =>
		p.min == null && p.max == null
			? 'Aucune plage'
			: `${p.min == null ? '…' : fmt(p.min, p.decimals)} – ${p.max == null ? '…' : fmt(p.max, p.decimals)}${p.unit ? ` ${p.unit}` : ''}`;
</script>

<svelte:head><title>Réglages · {aquarium?.name ?? 'Bac'} · Aquarium</title></svelte:head>

{#if !aquarium}
	<NavBar title="Réglages" back={{ href: '/aquariums', label: 'Bacs' }} large={false} />
	<p class="subhead mt-10 text-center text-label2">Ce bac n’existe pas ou plus.</p>
{:else}
	<NavBar title="Réglages" back={{ href: `/aquariums/${id}`, label: aquarium.name }} large={false}>
		{#snippet trailing()}
			{#if dirty}
				<button class="btn-plain pr-1 font-semibold" disabled={!name.trim()} onclick={saveAquarium}>Enregistrer</button>
			{/if}
		{/snippet}
	</NavBar>

	<div class="mb-6 mt-4 flex flex-col items-center text-center">
		<span
			class="grid h-[72px] w-[72px] place-items-center rounded-[20px] text-white shadow-sm"
			style="background: {TANK_TONE[aquarium.waterType]}; --cut: {TANK_TONE[aquarium.waterType]}"
		>
			<Icon name={TANK_ICON[aquarium.waterType]} size={40} filled weight={1.6} />
		</span>
	</div>

	<Section header="Bac" footer="Le type d’eau ne se change pas : il fixe les modèles de paramètres à la création. Avec un objectif de repas par jour, le bouton « Nourri » demande confirmation quand il est atteint.">
		<FieldRow id="name" label="Nom" bind:value={name} required />
		<Row title="Type d’eau" value={WATER_TYPE_LABELS[aquarium.waterType]} />
		<FieldRow id="volume" label="Volume" bind:value={volume} inputmode="decimal" placeholder="0" suffix="L" />
		<FieldRow id="started" label="Mise en eau" type="date" bind:value={started} />
		<Row title="Repas par jour" subtitle={feedPerDay > 0 ? undefined : 'Pas d’objectif'}>
			{#snippet trailing()}
				<span class="rounded-num body w-5 text-right text-label2">{feedPerDay > 0 ? feedPerDay : '–'}</span>
				<Stepper bind:value={feedPerDay} min={0} max={10} label="Repas par jour" />
			{/snippet}
		</Row>
	</Section>


	<Section header="Photo de couverture" footer="Elle s’affiche en grand en haut de la fiche du bac. Choisis-la depuis une photo du journal.">
		{#if cover != null}
			<Row href="/aquariums/{id}/journal" title="Changer de photo">
				{#snippet leading()}
					<img src="/api/photos/{cover}" alt="" class="h-[30px] w-[30px] shrink-0 rounded-[8px] object-cover" />
				{/snippet}
			</Row>
			<Row title="Retirer la photo de couverture" destructive onclick={removeCover} />
		{:else}
			<Row href="/aquariums/{id}/journal" icon="camera" iconColor="var(--teal)" title="Choisir dans le journal" />
		{/if}
	</Section>

	<section class="mb-8">
		<div class="flex items-baseline justify-between px-4 pb-1.5">
			<h2 class="footnote uppercase text-label2">Paramètres</h2>
			{#if parameters.length > 1}
				{#if reordering}
					<button class="btn-plain subhead font-semibold" onclick={finishReorder}>OK</button>
				{:else}
					<button class="btn-plain subhead" onclick={startReorder}>Modifier</button>
				{/if}
			{/if}
		</div>
		{#if reordering}
			<ul class="group reorder-list touch-none">
				{#each ordered as p, i (p.id)}
					{@const lifted = i === dragIndex}
					<li
						class="relative bg-bg2 pl-4 {lifted ? 'z-10 shadow-[0_8px_24px_rgb(0_0_0/0.18)]' : ''}"
						style="transform: translateY({lifted ? dragY : shiftOf(i)}px) scale({lifted ? 1.02 : 1}); transition: {lifted ? 'none' : 'transform 220ms cubic-bezier(0.3,0.8,0.3,1)'}"
					>
						<div class="row-body flex min-h-11 items-center gap-3 pr-2">
							<p class="body min-w-0 flex-1 truncate">{p.name}</p>
							<span class="subhead shrink-0 text-label2">{range(p)}</span>
							<button
								type="button"
								class="grid h-11 w-11 shrink-0 cursor-grab touch-none place-items-center text-label3"
								aria-label="Déplacer {p.name}"
								onpointerdown={(e) => grab(e, i)}
								onpointermove={drag}
								onpointerup={drop}
								onpointercancel={drop}
							>
								<svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">
									<path d="M2 2h16M2 7h16M2 12h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
								</svg>
							</button>
						</div>
					</li>
				{/each}
			</ul>
			<p class="footnote px-4 pt-1.5 text-label2">Fais glisser les poignées pour suivre l’ordre de ton kit de tests. Cet ordre est repris dans la saisie et le suivi.</p>
		{:else}
			<ul class="group ios-params">
				{#each parameters as p (p.id)}
					<Row title={p.name} value={range(p)} onclick={() => openParam(p)} chevron />
				{/each}
				<Row title="Ajouter un paramètre" action onclick={() => openParam(null)} />
			</ul>
			<p class="footnote px-4 pt-1.5 text-label2">Touche un paramètre pour régler sa plage acceptable et la dérive tolérée sur 7 jours (vide : 25 % de la plage).</p>
		{/if}
	</section>

	<Section header="Tâches">
		<Row href="/aquariums/{id}/taches" title="Tâches récurrentes" />
	</Section>

	<Section>
		<Row title="Supprimer ce bac" destructive onclick={removeAquarium} />
	</Section>

	<Sheet
		open={sheet != null}
		title={sheet?.mode === 'add' ? 'Nouveau paramètre' : (sheet?.p?.name ?? '')}
		onclose={() => (sheet = null)}
		action={{ label: sheet?.mode === 'add' ? 'Ajouter' : 'OK', onclick: saveParam, disabled: !pName.trim() }}
	>
		<Section>
			<FieldRow id="p-name" label="Nom" placeholder="Ex. Fer" bind:value={pName} required />
			<FieldRow id="p-unit" label="Unité" placeholder="mg/L" bind:value={pUnit} />
		</Section>
		<Section header="Plage acceptable" footer="Laisse vide pour ne pas fixer de limite.">
			<FieldRow id="p-min" label="Minimum" placeholder="Aucun" inputmode="decimal" bind:value={pMin} suffix={pUnit || undefined} />
			<FieldRow id="p-max" label="Maximum" placeholder="Aucun" inputmode="decimal" bind:value={pMax} suffix={pUnit || undefined} />
		</Section>
		<Section header="Dérive" footer="Variation maximale tolérée sur 7 jours avant alerte. Vide : 25 % de la plage.">
			<FieldRow id="p-drift" label="Sur 7 jours" placeholder="Auto" inputmode="decimal" bind:value={pDrift} suffix={pUnit || undefined} />
		</Section>
		<Section header="Test colorimétrique" footer="Temps d’attente du réactif, en secondes. Le pas à pas propose alors un minuteur pour ce paramètre. Vide : aucun minuteur.">
			<FieldRow id="p-wait" label="Temps de réaction" placeholder="Aucun" inputmode="numeric" bind:value={pWait} suffix="s" />
		</Section>
		{#if sheet?.mode === 'edit'}
			<Section>
				<Row title="Supprimer le paramètre" destructive onclick={removeParam} />
			</Section>
		{/if}
	</Sheet>
{/if}

<style>
	.ios-params > :global(li + li .row-body),
	.reorder-list > li + li .row-body {
		box-shadow: inset 0 0.5px 0 var(--sep);
	}
</style>

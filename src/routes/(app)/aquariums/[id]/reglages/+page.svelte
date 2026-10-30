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
	let loadedFor = $state<number | null>(null);
	$effect(() => {
		if (aquarium && loadedFor !== aquarium.id) {
			name = aquarium.name;
			volume = str(aquarium.volumeL);
			started = aquarium.startedOn ?? '';
			loadedFor = aquarium.id;
		}
	});
	const dirty = $derived(
		aquarium != null &&
			(name.trim() !== aquarium.name || num(volume) !== (aquarium.volumeL == null ? null : Number(aquarium.volumeL)) || (started || null) !== (aquarium.startedOn ?? null))
	);
	async function saveAquarium() {
		if (!name.trim()) return;
		await run(
			() =>
				store.mutate('PATCH', `/api/aquariums/${id}`, {
					name: name.trim(),
					volumeL: num(volume),
					startedOn: started || null
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

	function openParam(p: Parameter | null) {
		pName = p?.name ?? '';
		pUnit = p?.unit ?? '';
		pMin = str(p?.min);
		pMax = str(p?.max);
		pDrift = str(p?.driftPerWeek);
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

	const body = () => ({ name: pName.trim(), unit: pUnit.trim(), min: num(pMin), max: num(pMax), driftPerWeek: num(pDrift) });

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

	<Section header="Bac" footer="Le type d’eau ne se change pas : il fixe les modèles de paramètres à la création.">
		<FieldRow id="name" label="Nom" bind:value={name} required />
		<Row title="Type d’eau" value={WATER_TYPE_LABELS[aquarium.waterType]} />
		<FieldRow id="volume" label="Volume" bind:value={volume} inputmode="decimal" placeholder="0" suffix="L" />
		<FieldRow id="started" label="Mise en eau" type="date" bind:value={started} />
	</Section>

	<Section header="Paramètres" footer="Touche un paramètre pour régler sa plage acceptable et la dérive tolérée sur 7 jours (vide : 25 % de la plage).">
		{#each parameters as p (p.id)}
			<Row title={p.name} value={range(p)} onclick={() => openParam(p)} chevron />
		{/each}
		<Row title="Ajouter un paramètre" action onclick={() => openParam(null)} />
	</Section>

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
		{#if sheet?.mode === 'edit'}
			<Section>
				<Row title="Supprimer le paramètre" destructive onclick={removeParam} />
			</Section>
		{/if}
	</Sheet>
{/if}

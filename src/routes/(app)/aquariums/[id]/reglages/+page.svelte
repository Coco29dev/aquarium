<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { WATER_TYPE_LABELS } from '$lib/types';
	import { fmt } from '$lib/ui';
	import Icon from '$lib/components/Icon.svelte';
	import TankHeader from '$lib/components/TankHeader.svelte';
	import type { Parameter } from '$lib/types';

	const id = $derived(Number(page.params.id));
	const view = $derived(store.view);
	const aquarium = $derived(view?.aquariums.find((a) => a.id === id));
	const parameters = $derived((view?.parameters ?? []).filter((p) => p.aquariumId === id));

	let message = $state('');
	let saved = $state('');
	let editing = $state<number | null>(null);
	let adding = $state(false);

	// Arrivée depuis « Modifier la plage » : ouvre directement le paramètre visé.
	onMount(() => {
		const match = location.hash.match(/^#param-(\d+)$/);
		if (match) {
			editing = Number(match[1]);
			requestAnimationFrame(() => document.getElementById(`param-${match[1]}`)?.scrollIntoView({ block: 'center' }));
		}
	});

	async function run(action: () => Promise<unknown>, done?: string) {
		message = '';
		saved = '';
		try {
			await action();
			if (done) {
				saved = done;
				setTimeout(() => (saved = ''), 3000);
			}
		} catch (error) {
			message = (error as Error).message;
		}
	}

	const num = (value: string): number | null => (value.trim() === '' ? null : Number(value.replace(',', '.')));

	// --- Bac
	async function saveAquarium(event: SubmitEvent) {
		event.preventDefault();
		const form = new FormData(event.currentTarget as HTMLFormElement);
		await run(
			() =>
				store.mutate('PATCH', `/api/aquariums/${id}`, {
					name: form.get('name'),
					volumeL: num(String(form.get('volumeL'))),
					startedOn: String(form.get('startedOn')) || null
				}),
			'Bac enregistré.'
		);
	}

	async function removeAquarium() {
		if (!confirm('Supprimer ce bac et toutes ses mesures ? Pense à exporter avant.')) return;
		await run(async () => {
			await store.mutate('DELETE', `/api/aquariums/${id}`);
			await goto('/aquariums');
		});
	}

	// --- Paramètres
	const body = (f: FormData) => ({
		name: f.get('name'),
		unit: f.get('unit'),
		min: num(String(f.get('min'))),
		max: num(String(f.get('max'))),
		driftPerWeek: num(String(f.get('driftPerWeek')))
	});

	async function saveParameter(event: SubmitEvent, parameterId: number) {
		event.preventDefault();
		const f = new FormData(event.currentTarget as HTMLFormElement);
		await run(async () => {
			await store.mutate('PATCH', `/api/parameters/${parameterId}`, body(f));
			editing = null;
		}, 'Paramètre enregistré.');
	}

	async function removeParameter(parameterId: number, name: string) {
		if (!confirm(`Supprimer « ${name} » et ses mesures ?`)) return;
		await run(async () => {
			await store.mutate('DELETE', `/api/parameters/${parameterId}`);
			editing = null;
		});
	}

	async function addParameter(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		const f = new FormData(form);
		await run(async () => {
			await store.mutate('POST', `/api/aquariums/${id}/parameters`, body(f));
			form.reset();
			adding = false;
		}, 'Paramètre ajouté.');
	}

	const range = (p: Parameter) =>
		p.min == null && p.max == null
			? 'pas de plage'
			: `${p.min == null ? '…' : fmt(p.min, p.decimals)} – ${p.max == null ? '…' : fmt(p.max, p.decimals)}${p.unit ? ` ${p.unit}` : ''}`;
</script>

<svelte:head><title>Réglages · {aquarium?.name ?? 'Bac'} · Bulle</title></svelte:head>

{#snippet paramFields(p: Parameter | null)}
	<div class="grid grid-cols-3 gap-3">
		<label class="col-span-2 flex flex-col gap-1 text-xs font-bold text-muted">
			Nom
			<input name="name" value={p?.name ?? ''} required placeholder="Ex. Fer" class="field font-normal text-ink" />
		</label>
		<label class="flex flex-col gap-1 text-xs font-bold text-muted">
			Unité
			<input name="unit" value={p?.unit ?? ''} placeholder="mg/L" class="field font-normal text-ink" />
		</label>
		<label class="flex flex-col gap-1 text-xs font-bold text-muted">
			Minimum
			<input name="min" value={p?.min ?? ''} inputmode="decimal" class="field num font-normal text-ink" />
		</label>
		<label class="flex flex-col gap-1 text-xs font-bold text-muted">
			Maximum
			<input name="max" value={p?.max ?? ''} inputmode="decimal" class="field num font-normal text-ink" />
		</label>
		<label class="flex flex-col gap-1 text-xs font-bold text-muted">
			Dérive / 7 j
			<input name="driftPerWeek" value={p?.driftPerWeek ?? ''} inputmode="decimal" placeholder="auto" class="field num font-normal text-ink" />
		</label>
	</div>
{/snippet}

{#if !aquarium}
	<p class="hand text-lg text-muted">Ce bac n’existe pas ou plus.</p>
{:else}
	<TankHeader {aquarium} tab="reglages" />

	{#if message}<p class="mb-4 rounded-lg border-2 border-bad bg-bad-soft px-3 py-2 text-sm font-bold text-bad" role="alert">{message}</p>{/if}
	{#if saved}<p class="rise mb-4 rounded-lg border-2 border-ok bg-ok-soft px-3 py-2 text-sm font-bold text-ok" role="status">{saved}</p>{/if}

	<section class="rise mb-8">
		<h2 class="tape mb-3">Le bac</h2>
		<form onsubmit={saveAquarium} class="card flex flex-col gap-3 p-4">
			<label class="flex flex-col gap-1 text-xs font-bold text-muted">
				Nom
				<input name="name" value={aquarium.name} required maxlength="100" class="field text-base font-bold text-ink" />
			</label>
			<div class="grid grid-cols-2 gap-3">
				<label class="flex flex-col gap-1 text-xs font-bold text-muted">
					Volume (L)
					<input name="volumeL" value={aquarium.volumeL ?? ''} inputmode="decimal" class="field num font-normal text-ink" />
				</label>
				<label class="flex flex-col gap-1 text-xs font-bold text-muted">
					Mise en eau
					<input name="startedOn" type="date" value={aquarium.startedOn ?? ''} class="field font-normal text-ink" />
				</label>
			</div>
			<p class="text-xs text-muted">Type d’eau : {WATER_TYPE_LABELS[aquarium.waterType]} (fixé à la création).</p>
			<button class="btn">Enregistrer</button>
		</form>
	</section>

	<section class="rise mb-8" style="animation-delay: 40ms">
		<h2 class="tape mb-2">Paramètres suivis</h2>
		<p class="hand mb-3 text-base leading-snug text-muted">
			Plage acceptable et dérive maximale sur 7 jours. Sans dérive, j’alerte au-delà de 25 % de la plage.
		</p>
		<ul class="card-flat divide-y-2 divide-line overflow-hidden">
			{#each parameters as p (p.id)}
				<li id="param-{p.id}" class="scroll-mt-24">
					<button
						onclick={() => (editing = editing === p.id ? null : p.id)}
						aria-expanded={editing === p.id}
						class="flex w-full items-center gap-3 px-4 py-3 text-left"
					>
						<div class="min-w-0 flex-1">
							<p class="truncate font-bold">{p.name}</p>
							<p class="num text-xs text-muted">
								{range(p)}{p.driftPerWeek != null ? ` · dérive ${fmt(p.driftPerWeek, p.decimals)}/7 j` : ''}
							</p>
						</div>
						<Icon name={editing === p.id ? 'close' : 'edit'} size={18} class="shrink-0 text-muted" />
					</button>
					{#if editing === p.id}
						<form onsubmit={(e) => saveParameter(e, p.id)} class="flex flex-col gap-3 border-t-2 border-edge bg-surface2 p-4">
							{@render paramFields(p)}
							<div class="grid grid-cols-2 gap-3">
								<button class="btn">Enregistrer</button>
								<button type="button" onclick={() => removeParameter(p.id, p.name)} class="btn-ghost text-bad">
									<Icon name="trash" size={18} />Supprimer
								</button>
							</div>
						</form>
					{/if}
				</li>
			{/each}
		</ul>

		{#if adding}
			<form onsubmit={addParameter} class="card mt-4 flex flex-col gap-3 p-4">
				<p class="font-bold">Nouveau paramètre</p>
				{@render paramFields(null)}
				<div class="grid grid-cols-2 gap-3">
					<button class="btn">Ajouter</button>
					<button type="button" onclick={() => (adding = false)} class="btn-ghost">Annuler</button>
				</div>
			</form>
		{:else}
			<button
				onclick={() => (adding = true)}
				class="press mt-4 flex w-full items-center justify-center gap-2 rounded-[0.875rem] border-2 border-dashed border-edge py-3.5 text-sm font-bold text-muted"
			>
				<Icon name="plus" size={18} />Suivre un autre paramètre
			</button>
		{/if}
	</section>

	<section class="rise mb-8" style="animation-delay: 80ms">
		<a href="/aquariums/{id}/taches" class="card press flex items-center gap-3 px-4 py-3.5">
			<Icon name="calendar" size={22} />
			<span class="flex-1 font-bold">Tâches récurrentes</span>
			<Icon name="next" size={18} />
		</a>
	</section>

	<section class="rise rounded-[0.875rem] border-2 border-dashed border-bad p-4" style="animation-delay: 120ms">
		<h2 class="mb-1 font-bold text-bad">Zone sensible</h2>
		<p class="mb-3 text-sm text-muted">Supprime le bac avec ses mesures, tâches, vivants et photos. Exporte tes données avant (Réglages).</p>
		<button onclick={removeAquarium} class="btn-ghost w-full text-bad">
			<Icon name="trash" size={18} />Supprimer ce bac
		</button>
	</section>
{/if}

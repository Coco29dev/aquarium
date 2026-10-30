<script lang="ts">
	import { page } from '$app/state';
	import Chart from '$lib/components/Chart.svelte';
	import { store } from '$lib/client/store.svelte';
	import { cyclingForAquarium } from '$lib/domain/cycling';
	import { analyzeParameter } from '$lib/domain/drift';
	import type { Parameter } from '$lib/types';

	const id = $derived(Number(page.params.id));
	const view = $derived(store.view);
	const aquarium = $derived(view?.aquariums.find((a) => a.id === id));
	const parameters = $derived((view?.parameters ?? []).filter((p) => p.aquariumId === id));
	const measurements = $derived((view?.measurements ?? []).filter((m) => m.aquariumId === id));
	const coach = $derived(cyclingForAquarium(parameters, measurements));

	const lastValue = (p: Parameter): number | null => {
		const list = measurements.filter((m) => m.parameterId === p.id);
		return list.length ? list[list.length - 1].value : null;
	};
	const points = (p: Parameter) =>
		measurements
			.filter((m) => m.parameterId === p.id)
			.map((m) => ({ t: new Date(m.measuredAt).getTime(), v: m.value }));

	// Saisie : valeurs précédentes préremplies, coche = sera enregistrée.
	let inputs = $state<Record<number, string>>({});
	let checked = $state<Record<number, boolean>>({});
	let savedNote = $state('');

	function current(p: Parameter): string {
		if (inputs[p.id] !== undefined) return inputs[p.id];
		const last = lastValue(p);
		return last == null ? '' : String(last);
	}

	function edit(p: Parameter, value: string) {
		inputs[p.id] = value;
		checked[p.id] = value.trim() !== '';
	}

	function nudge(p: Parameter, direction: 1 | -1) {
		const base = Number(current(p) || lastValue(p) || 0);
		const next = Math.round((base + direction * p.step) * 1e6) / 1e6;
		edit(p, next.toFixed(p.decimals));
	}

	function confirmAll() {
		for (const p of parameters) {
			if (current(p).trim() !== '') checked[p.id] = true;
		}
	}

	const selected = $derived(
		parameters.filter((p) => checked[p.id] && current(p).trim() !== '' && Number.isFinite(Number(current(p).replace(',', '.'))))
	);

	async function save() {
		const values = selected.map((p) => ({ parameterId: p.id, value: Number(current(p).replace(',', '.')) }));
		if (!values.length) return;
		await store.addMeasurements(id, values);
		inputs = {};
		checked = {};
		savedNote = `${values.length} mesure${values.length > 1 ? 's' : ''} enregistrée${values.length > 1 ? 's' : ''}.`;
		setTimeout(() => (savedNote = ''), 4000);
	}

	const status = (p: Parameter) => {
		const alert = analyzeParameter(p, measurements.filter((m) => m.parameterId === p.id));
		return alert ? (alert.level === 'hors_plage' ? 'text-red-300' : 'text-amber-300') : 'text-slate-400';
	};
</script>

<svelte:head><title>{aquarium?.name ?? 'Aquarium'} · Aquarium</title></svelte:head>

{#if !aquarium}
	<p class="text-sm text-slate-400">Aquarium introuvable.</p>
{:else}
	<header class="mb-6 flex items-start justify-between gap-4">
		<h1 class="text-2xl font-semibold">{aquarium.name}</h1>
		<a href="/aquariums/{id}/reglages" class="text-sm text-cyan-300 underline">Réglages</a>
	</header>

	<nav class="mb-6 grid grid-cols-4 gap-2 text-center text-sm">
		<a href="/aquariums/{id}/inventaire" class="rounded-lg bg-slate-900 py-3 active:bg-slate-800">Inventaire</a>
		<a href="/aquariums/{id}/peuplement" class="rounded-lg bg-slate-900 py-3 active:bg-slate-800">Peuplement</a>
		<a href="/aquariums/{id}/journal" class="rounded-lg bg-slate-900 py-3 active:bg-slate-800">Journal</a>
		<a href="/depenses" class="rounded-lg bg-slate-900 py-3 active:bg-slate-800">Dépenses</a>
	</nav>

	{#if coach && coach.stage !== 'aucune_mesure'}
		<section class="mb-6 rounded-lg border {coach.ready ? 'border-emerald-700' : 'border-cyan-900'} p-4">
			<h2 class="font-medium">{coach.title}</h2>
			<p class="mt-1 text-sm text-slate-300">{coach.advice}</p>
		</section>
	{/if}

	<section class="mb-8">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-medium uppercase tracking-wide text-slate-400">Saisie</h2>
			<button onclick={confirmAll} class="text-sm text-cyan-300 underline">Tout confirmer</button>
		</div>
		<ul class="flex flex-col gap-2">
			{#each parameters as p (p.id)}
				<li class="flex items-center gap-2 rounded-lg bg-slate-900 p-2 pl-3">
					<input
						type="checkbox"
						bind:checked={checked[p.id]}
						class="h-5 w-5 shrink-0 accent-cyan-500"
						aria-label="Enregistrer {p.name}"
					/>
					<span class="min-w-0 flex-1 truncate text-sm">
						{p.name}
						{#if p.unit}<span class="text-slate-500">({p.unit})</span>{/if}
					</span>
					<button onclick={() => nudge(p, -1)} class="h-10 w-10 rounded-lg bg-slate-800 text-lg active:bg-slate-700" aria-label="Diminuer">−</button>
					<input
						value={current(p)}
						oninput={(e) => edit(p, e.currentTarget.value)}
						inputmode="decimal"
						class="w-20 rounded-lg border border-cyan-900 bg-slate-950 px-2 py-2 text-center text-base"
						aria-label="Valeur de {p.name}"
					/>
					<button onclick={() => nudge(p, 1)} class="h-10 w-10 rounded-lg bg-slate-800 text-lg active:bg-slate-700" aria-label="Augmenter">+</button>
				</li>
			{/each}
		</ul>
		<button
			onclick={save}
			disabled={selected.length === 0}
			class="mt-4 w-full rounded-lg bg-cyan-700 px-4 py-3 font-medium active:bg-cyan-800 disabled:opacity-40"
		>
			Enregistrer{selected.length ? ` (${selected.length})` : ''}
		</button>
		{#if savedNote}<p class="mt-2 text-center text-sm text-emerald-300" role="status">{savedNote}</p>{/if}
	</section>

	<section>
		<h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">Graphes</h2>
		<div class="flex flex-col gap-6">
			{#each parameters as p (p.id)}
				<div>
					<p class="mb-1 text-sm {status(p)}">
						{p.name}
						{#if p.min != null || p.max != null}
							<span class="text-xs text-slate-500">· plage {p.min ?? '…'} – {p.max ?? '…'} {p.unit}</span>
						{/if}
					</p>
					<Chart points={points(p)} min={p.min} max={p.max} decimals={p.decimals} />
				</div>
			{/each}
		</div>
	</section>
{/if}

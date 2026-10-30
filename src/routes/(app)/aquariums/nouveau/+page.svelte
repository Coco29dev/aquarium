<script lang="ts">
	import { goto } from '$app/navigation';
	import { store } from '$lib/client/store.svelte';
	import { WATER_TYPE_LABELS, type WaterType } from '$lib/types';
	import { PARAMETER_TEMPLATES } from '$lib/templates';

	let name = $state('');
	let waterType = $state<WaterType>('douce');
	let volumeL = $state('');
	let startedOn = $state('');
	let busy = $state(false);
	let message = $state('');

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		message = '';
		try {
			const response = await store.mutate('POST', '/api/aquariums', {
				name,
				waterType,
				volumeL: volumeL === '' ? null : Number(volumeL),
				startedOn: startedOn || null
			});
			const { id } = await response.json();
			await goto(`/aquariums/${id}`);
		} catch (error) {
			message = (error as Error).message;
		} finally {
			busy = false;
		}
	}

	const field = 'rounded-lg border border-cyan-900 bg-slate-900 px-4 py-3 text-base';
</script>

<svelte:head><title>Nouvel aquarium · Aquarium</title></svelte:head>

<h1 class="mb-6 text-2xl font-semibold">Nouvel aquarium</h1>

<form onsubmit={submit} class="flex flex-col gap-4">
	<label class="flex flex-col gap-2 text-sm">
		Nom
		<input bind:value={name} required maxlength="100" class={field} />
	</label>
	<label class="flex flex-col gap-2 text-sm">
		Type d'eau
		<select bind:value={waterType} class={field}>
			{#each Object.entries(WATER_TYPE_LABELS) as [value, label] (value)}
				<option {value}>{label}</option>
			{/each}
		</select>
	</label>
	<p class="text-xs text-slate-400">
		Paramètres créés : {PARAMETER_TEMPLATES[waterType].map((p) => p.name).join(', ')}. Tous modifiables ensuite.
	</p>
	<label class="flex flex-col gap-2 text-sm">
		Volume (L)
		<input bind:value={volumeL} type="number" inputmode="decimal" min="0" step="any" class={field} />
	</label>
	<label class="flex flex-col gap-2 text-sm">
		Date de mise en eau
		<input bind:value={startedOn} type="date" class={field} />
	</label>
	{#if message}<p class="text-sm text-red-400" role="alert">{message}</p>{/if}
	<button disabled={busy} class="rounded-lg bg-cyan-700 px-4 py-3 font-medium active:bg-cyan-800 disabled:opacity-40">
		Créer
	</button>
</form>

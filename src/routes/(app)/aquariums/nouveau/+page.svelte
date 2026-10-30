<script lang="ts">
	import { goto } from '$app/navigation';
	import { store } from '$lib/client/store.svelte';
	import { WATER_TYPE_LABELS, type WaterType } from '$lib/types';
	import { PARAMETER_TEMPLATES } from '$lib/templates';
	import { TANK_TONE, fmt } from '$lib/ui';
	import { dayInParis } from '$lib/domain/dates';
	import Icon from '$lib/components/Icon.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';

	let name = $state('');
	let waterType = $state<WaterType>('douce');
	let volumeL = $state('');
	let startedOn = $state(dayInParis());
	let busy = $state(false);
	let message = $state('');

	const types: { value: WaterType; hint: string }[] = [
		{ value: 'douce', hint: 'Poissons et plantes faciles' },
		{ value: 'plantee', hint: 'Aquascape, CO₂, engrais' },
		{ value: 'mer', hint: 'Poissons marins, roches' },
		{ value: 'recif', hint: 'Coraux, calcium, KH' }
	];

	const template = $derived(PARAMETER_TEMPLATES[waterType]);
	const range = (min: number | null, max: number | null, decimals: number) =>
		min == null && max == null ? '' : `${min == null ? '…' : fmt(min, decimals)} – ${max == null ? '…' : fmt(max, decimals)}`;

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		message = '';
		try {
			const response = await store.mutate('POST', '/api/aquariums', {
				name,
				waterType,
				volumeL: volumeL === '' ? null : Number(volumeL.replace(',', '.')),
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
</script>

<svelte:head><title>Nouveau bac · Bulle</title></svelte:head>

<div class="rise">
	<PageHeader title="Nouveau bac" back="/aquariums" backLabel="Bacs" />
</div>

<form onsubmit={submit} class="flex flex-col gap-7">
	<section class="rise flex flex-col gap-2" style="animation-delay: 40ms">
		<label for="tank-name" class="tape w-fit">Son nom</label>
		<input id="tank-name" bind:value={name} required maxlength="100" placeholder="Salon, Nano du bureau…" class="field mt-1 text-lg font-bold" />
	</section>

	<fieldset class="rise flex flex-col gap-3" style="animation-delay: 80ms">
		<legend class="tape mb-3">Type d’eau</legend>
		<div class="grid grid-cols-2 gap-3">
			{#each types as t (t.value)}
				{@const on = waterType === t.value}
				<label
					class="press relative flex cursor-pointer flex-col gap-1 rounded-[0.875rem] border-2 border-edge p-3.5 {on ? 'shadow-[4px_4px_0_var(--shadow)]' : 'opacity-80'}"
					style="background: {TANK_TONE[t.value]}"
				>
					<input type="radio" name="waterType" value={t.value} bind:group={waterType} class="sr-only" />
					<span class="display text-lg leading-tight">{WATER_TYPE_LABELS[t.value]}</span>
					<span class="text-xs">{t.hint}</span>
					{#if on}
						<span class="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border-2 border-edge bg-ink text-on-ink">
							<Icon name="check" size={14} />
						</span>
					{/if}
				</label>
			{/each}
		</div>
	</fieldset>

	<section class="rise grid grid-cols-2 gap-3" style="animation-delay: 120ms">
		<label class="flex flex-col gap-2">
			<span class="tape w-fit">Volume</span>
			<span class="relative mt-1">
				<input bind:value={volumeL} inputmode="decimal" placeholder="240" class="field num pr-9" />
				<span class="num pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">L</span>
			</span>
		</label>
		<label class="flex flex-col gap-2">
			<span class="tape w-fit">Mise en eau</span>
			<input bind:value={startedOn} type="date" class="field mt-1" />
		</label>
	</section>

	<section class="rise" style="animation-delay: 160ms">
		<div class="card-flat overflow-hidden">
			<p class="border-b-2 border-edge px-4 py-2.5 text-sm font-bold" style="background: {TANK_TONE[waterType]}">
				Je prépare {template.length} paramètres à suivre
			</p>
			<ul class="divide-y divide-line">
				{#each template as p (p.key)}
					<li class="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
						<span>{p.name}</span>
						<span class="num shrink-0 text-xs text-muted">{range(p.min, p.max, p.decimals)} {p.unit}</span>
					</li>
				{/each}
			</ul>
		</div>
		<p class="hand mt-2 text-base text-muted">Plages de départ raisonnables, tu pourras tout ajuster.</p>
	</section>

	{#if message}<p class="rounded-lg border-2 border-bad bg-bad-soft px-3 py-2 text-sm font-bold text-bad" role="alert">{message}</p>{/if}

	<button disabled={busy || !name.trim()} class="btn w-full">
		{busy ? 'Création…' : 'Créer le bac'}
	</button>
</form>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { store } from '$lib/client/store.svelte';
	import { WATER_TYPE_LABELS, type WaterType } from '$lib/types';
	import { PARAMETER_TEMPLATES } from '$lib/templates';
	import { TANK_ICON, TANK_TONE, fmt } from '$lib/ui';
	import { dayInParis } from '$lib/domain/dates';
	import Icon from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';

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
	const ready = $derived(name.trim() !== '' && !busy);

	async function submit() {
		if (!ready) return;
		busy = true;
		message = '';
		try {
			const response = await store.mutate('POST', '/api/aquariums', {
				name: name.trim(),
				waterType,
				volumeL: volumeL === '' ? null : Number(volumeL.replace(',', '.')),
				startedOn: startedOn || null
			});
			const { id } = await response.json();
			await goto(`/aquariums/${id}`, { replaceState: true });
		} catch (error) {
			message = (error as Error).message;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Nouveau bac · Aquarium</title></svelte:head>

<NavBar title="Nouveau bac" large={false}>
	{#snippet leading()}
		<a href="/aquariums" data-nav="pop" class="btn-plain pl-2">Annuler</a>
	{/snippet}
	{#snippet trailing()}
		<button class="btn-plain pr-1 font-semibold" disabled={!ready} onclick={submit}>{busy ? 'Ajout…' : 'Ajouter'}</button>
	{/snippet}
</NavBar>

<form
	class="mt-4"
	onsubmit={(e) => {
		e.preventDefault();
		void submit();
	}}
>
	<div class="mb-6 flex flex-col items-center">
		<span
			class="grid h-[72px] w-[72px] place-items-center rounded-[20px] text-white shadow-sm transition-colors duration-300"
			style="background: {TANK_TONE[waterType]}; --cut: {TANK_TONE[waterType]}"
		>
			<Icon name={TANK_ICON[waterType]} size={40} filled weight={1.6} />
		</span>
	</div>

	{#if message}<p class="footnote mb-4 px-4 text-red" role="alert">{message}</p>{/if}

	<Section>
		<li class="flex min-h-11 items-center pl-4 pr-4">
			<input
				bind:value={name}
				required
				maxlength="60"
				placeholder="Nom (ex. Salon)"
				aria-label="Nom du bac"
				class="body h-11 w-full bg-transparent outline-none placeholder:text-label3"
			/>
		</li>
	</Section>

	<Section header="Type d’eau">
		{#each types as t (t.value)}
			<Row
				icon={TANK_ICON[t.value]}
				iconColor={TANK_TONE[t.value]}
				title={WATER_TYPE_LABELS[t.value]}
				subtitle={t.hint}
				onclick={() => (waterType = t.value)}
			>
				{#snippet trailing()}
					{#if waterType === t.value}<span class="text-tint"><Icon name="check" size={20} weight={2.6} /></span>{/if}
				{/snippet}
			</Row>
		{/each}
	</Section>

	<Section footer="Le volume sert aux calculateurs (changement d’eau, dosages). La date de mise en eau sert au coach de cyclage.">
		<li class="pl-4"><div class="row-body flex min-h-11 items-center gap-3 pr-4">
			<label for="volume" class="body shrink-0">Volume</label>
			<input
				id="volume"
				bind:value={volumeL}
				inputmode="decimal"
				placeholder="0"
				class="body h-11 min-w-0 flex-1 bg-transparent text-right text-label2 outline-none placeholder:text-label3"
			/>
			<span class="body text-label2">L</span>
		</div></li>
		<li class="pl-4"><div class="row-body flex min-h-11 items-center gap-3 pr-4">
			<label for="started" class="body flex-1">Mise en eau</label>
			<input id="started" type="date" bind:value={startedOn} class="body rounded-lg bg-fill3 px-2.5 py-1 text-right outline-none" />
		</div></li>
	</Section>

	<Section header="Paramètres suivis" footer="Ces plages sont un point de départ : tu pourras toutes les modifier dans les réglages du bac.">
		{#each template as p (p.key)}
			<Row title={p.name}>
				{#snippet trailing()}
					<span class="subhead shrink-0 text-label2">
						{#if p.min != null || p.max != null}
							{p.min == null ? '…' : fmt(p.min, p.decimals)} – {p.max == null ? '…' : fmt(p.max, p.decimals)}{p.unit ? ` ${p.unit}` : ''}
						{:else}
							–
						{/if}
					</span>
				{/snippet}
			</Row>
		{/each}
	</Section>

	<button type="submit" class="btn-filled mb-6 w-full" disabled={!ready}>{busy ? 'Ajout…' : 'Ajouter le bac'}</button>
</form>

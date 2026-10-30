<script lang="ts">
	import { store } from '$lib/client/store.svelte';
	import { tankHealth } from '$lib/tank';
	import Icon from '$lib/components/Icon.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import TankCard from '$lib/components/TankCard.svelte';

	const view = $derived(store.view);
	const tanks = $derived(view ? view.aquariums.map((a) => ({ aquarium: a, health: tankHealth(view, a) })) : []);
	const totalL = $derived(tanks.reduce((sum, t) => sum + (t.aquarium.volumeL ?? 0), 0));
</script>

<svelte:head><title>Bacs · Bulle</title></svelte:head>

<div class="rise">
	<PageHeader
		title="Mes bacs"
		kicker={tanks.length ? `${tanks.length} bac${tanks.length > 1 ? 's' : ''}${totalL ? ` · ${totalL.toLocaleString('fr-FR')} L en tout` : ''}` : undefined}
	>
		{#snippet action()}
			<a href="/aquariums/nouveau" class="press grid h-11 w-11 place-items-center rounded-full border-2 border-edge bg-sun text-[#16202e] shadow-[3px_3px_0_var(--shadow)]" aria-label="Nouveau bac">
				<Icon name="plus" size={22} />
			</a>
		{/snippet}
	</PageHeader>
</div>

{#if tanks.length === 0}
	<section class="card rise flex flex-col items-start gap-4 p-5" style="animation-delay: 60ms">
		<Logo size={72} />
		<h2 class="display text-2xl">Aucun bac pour l’instant</h2>
		<p class="hand text-lg leading-snug text-muted">
			Commence par celui du salon : un nom, un type d’eau, et je prépare les paramètres à suivre.
		</p>
		<a href="/aquariums/nouveau" class="btn">Créer un bac</a>
	</section>
{:else}
	<ul class="flex flex-col gap-5">
		{#each tanks as { aquarium, health }, i (aquarium.id)}
			<li class="rise" style="animation-delay: {60 + i * 50}ms"><TankCard {aquarium} {health} /></li>
		{/each}
	</ul>
	<a
		href="/aquariums/nouveau"
		class="press rise mt-5 flex items-center justify-center gap-2 rounded-[0.875rem] border-2 border-dashed border-edge py-4 text-sm font-bold text-muted"
		style="animation-delay: {60 + tanks.length * 50}ms"
	>
		<Icon name="plus" size={18} />Ajouter un bac
	</a>
{/if}

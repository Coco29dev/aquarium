<script lang="ts">
	import { goto } from '$app/navigation';
	import { store } from '$lib/client/store.svelte';
	import { tankHealth } from '$lib/tank';
	import { SHORT_WATER, TANK_ICON, TANK_TONE, fmt, tankAge } from '$lib/ui';
	import Icon from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import { contextMenu } from '$lib/ios/contextMenu';
	import type { Aquarium } from '$lib/types';

	const view = $derived(store.view);
	const aquariums = $derived(view?.aquariums ?? []);
	const cards = $derived(view ? aquariums.map((a) => ({ aquarium: a, health: tankHealth(view, a) })) : []);
	const totalL = $derived(aquariums.reduce((sum, a) => sum + (a.volumeL ?? 0), 0));

	const lastOf = (id: number) => {
		const list = (view?.measurements ?? []).filter((m) => m.parameterId === id);
		return list.length ? list[list.length - 1] : null;
	};
	/** Trois repères par bac : température, pH, nitrates (ceux qui existent). */
	const featured = (aquariumId: number) =>
		['temp', 'ph', 'no3']
			.map((k) => view?.parameters.find((p) => p.aquariumId === aquariumId && p.key === k))
			.filter((p): p is NonNullable<typeof p> => Boolean(p));
	// Appui long sur une carte : raccourcis vers les écrans du bac.
	const tankMenu = (a: Aquarium) => ({
		items: [
			{ label: 'Ouvrir', icon: 'bacs' as const, onselect: () => goto(`/aquariums/${a.id}`) },
			{ label: 'Saisir des mesures', icon: 'drop' as const, onselect: () => goto(`/mesurer?bac=${a.id}`) },
			{ label: 'Tâches', icon: 'calendar' as const, onselect: () => goto(`/aquariums/${a.id}/taches`) },
			{ label: 'Journal', icon: 'note' as const, onselect: () => goto(`/aquariums/${a.id}/journal`) },
			{ label: 'Réglages', icon: 'gear' as const, onselect: () => goto(`/aquariums/${a.id}/reglages`) }
		]
	});
	const shortName = (key: string | null, name: string) =>
		key === 'temp' ? 'Temp.' : key === 'no3' ? 'Nitrates' : key === 'ph' ? 'pH' : name;
</script>

<svelte:head><title>Bacs · Aquarium</title></svelte:head>

<NavBar title="Bacs" kicker={aquariums.length ? `${aquariums.length} bac${aquariums.length > 1 ? 's' : ''}${totalL ? ` · ${fmt(totalL, 0)} L` : ''}` : undefined}>
	{#snippet trailing()}
		<a href="/aquariums/nouveau" class="glass pressable grid h-9 w-9 place-items-center rounded-full text-tint" aria-label="Ajouter un bac">
			<Icon name="plus" size={20} weight={2.4} />
		</a>
	{/snippet}
</NavBar>

{#if aquariums.length === 0}
	<div class="mt-16 flex flex-col items-center px-6 text-center">
		<span class="mb-4 grid h-20 w-20 place-items-center rounded-[22px] bg-gradient-to-b from-cyan to-blue text-white shadow-lg" style="--cut: var(--blue)">
			<Icon name="fish" size={44} filled weight={1.6} />
		</span>
		<h2 class="title2">Aucun bac</h2>
		<p class="subhead mt-1.5 text-label2">Ajoute ton premier aquarium : je prépare les paramètres à suivre et leurs plages.</p>
		<a href="/aquariums/nouveau" class="btn-filled mt-6">Ajouter un bac</a>
	</div>
{:else}
	<div class="mb-8 mt-2 flex flex-col gap-3">
		{#each cards as { aquarium, health: h } (aquarium.id)}
			{@const tone = TANK_TONE[aquarium.waterType]}
			{@const age = tankAge(aquarium)}
			<a href="/aquariums/{aquarium.id}" class="pressable block rounded-[22px] bg-bg2 p-4" use:contextMenu={tankMenu(aquarium)}>
				<div class="flex items-center gap-2" style="color: {tone}; --cut: var(--bg2)">
					<Icon name={TANK_ICON[aquarium.waterType]} size={20} filled weight={1.6} />
					<span class="headline min-w-0 flex-1 truncate">{aquarium.name}</span>
					<span class="text-label3"><Icon name="next" size={16} weight={2.4} /></span>
				</div>
				<p class="footnote mt-0.5 text-label2">
					{SHORT_WATER[aquarium.waterType]}{aquarium.volumeL ? ` · ${fmt(aquarium.volumeL, 0)} L` : ''}{age != null ? ` · jour ${age}` : ''}
				</p>
				<div class="mt-4 grid grid-cols-3 gap-3">
					{#each featured(aquarium.id) as p (p.id)}
						{@const last = lastOf(p.id)}
						<div class="min-w-0">
							<p class="caption1 truncate font-semibold text-label2">{shortName(p.key, p.name)}</p>
							<p class="rounded-num truncate">
								<span class="text-[24px] font-semibold leading-7">{last ? fmt(last.value, p.decimals) : '–'}</span>
								{#if p.unit}<span class="footnote font-semibold text-label2">{p.unit}</span>{/if}
							</p>
						</div>
					{/each}
				</div>
				<div class="mt-3 flex items-center justify-between gap-2">
					<p class="footnote flex min-w-0 items-center gap-1.5 font-semibold {h.level === 'bad' ? 'text-red' : h.level === 'warn' ? 'text-orange' : h.level === 'cycle' ? 'text-indigo' : 'text-green'}">
						<Icon name={h.level === 'ok' ? 'check' : h.level === 'cycle' ? 'cycle' : 'alert'} size={15} weight={2.6} />
						<span class="truncate">{h.label}</span>
					</p>
					{#if h.due.length}
						<span class="footnote shrink-0 text-label2">{h.due.length} à faire</span>
					{/if}
				</div>
			</a>
		{/each}
	</div>

	<Section>
		<Row href="/aquariums/nouveau" icon="plus" iconColor="var(--blue)" title="Ajouter un bac" />
		<Row href="/especes" icon="book" iconColor="var(--teal)" title="Encyclopédie des espèces" />
	</Section>
{/if}

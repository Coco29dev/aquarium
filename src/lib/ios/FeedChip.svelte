<script lang="ts">
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { feedingStatus, feedingsToday } from '$lib/domain/feeding';
	import Icon from '$lib/components/Icon.svelte';

	/**
	 * Nourrissage en un toucher : compteur du jour (« 2/3 repas · 08:12 ») et bouton « Nourri ».
	 * Une confirmation iOS s'affiche quand la consigne du jour est atteinte ou dépassée.
	 * Sûr à placer dans une carte-lien : le toucher ne déclenche pas la navigation.
	 */
	interface Props {
		aquariumId: number;
		compact?: boolean;
	}
	let { aquariumId, compact = false }: Props = $props();

	const aquarium = $derived(store.view?.aquariums.find((a) => a.id === aquariumId));
	const today = $derived(feedingsToday(store.view?.feedings ?? [], aquariumId));
	const perDay = $derived(aquarium?.feedingsPerDay ?? null);
	const status = $derived(feedingStatus(today.count, perDay));
	const warn = $derived(status === 'complet' || status === 'trop');

	const time = $derived(
		today.last ? new Date(today.last).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }) : null
	);
	const info = $derived.by(() => {
		if (today.count === 0) return 'Pas encore nourri';
		const n = perDay ? `${today.count}/${perDay} repas` : `${today.count} repas`;
		return `${n} · ${time}`;
	});
	const hint = $derived(
		status === 'trop' ? `Consigne dépassée (${perDay} par jour)` : status === 'complet' ? 'Repas du jour complets' : null
	);

	let busy = false;
	async function feed(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (busy) return;
		busy = true;
		try {
			if (warn) {
				const ok = await ui.confirm({
					title: status === 'trop' ? 'Déjà trop nourri ?' : 'Repas du jour complets',
					message: `${aquarium?.name ?? 'Ce bac'} a déjà eu ${today.count} repas aujourd’hui${perDay ? ` (consigne : ${perDay})` : ''}. Nourrir encore ?`,
					confirmLabel: 'Nourrir quand même',
					cancelLabel: 'Pas maintenant'
				});
				if (!ok) return;
			}
			await store.addFeeding(aquariumId);
			ui.show('Repas noté', undefined, 'check');
		} catch (error) {
			ui.show((error as Error).message);
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex items-center gap-3">
	<div class="min-w-0 flex-1">
		<p class="{compact ? 'footnote' : 'subhead'} truncate font-semibold {warn ? 'text-orange' : today.count ? 'text-label' : 'text-label2'}">{info}</p>
		{#if hint}<p class="caption1 truncate text-orange">{hint}</p>{/if}
	</div>
	<button
		type="button"
		onclick={feed}
		class="pressable flex shrink-0 items-center gap-1.5 rounded-full bg-fill3 font-semibold text-tint {compact ? 'footnote h-8 px-3' : 'subhead h-9 px-3.5'}"
		aria-label="Noter un repas pour {aquarium?.name ?? 'ce bac'}"
	>
		<Icon name="fish" size={compact ? 15 : 17} weight={2} />Nourri
	</button>
</div>

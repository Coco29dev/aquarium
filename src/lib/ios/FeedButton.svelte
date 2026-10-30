<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { feedingStatus, feedingsToday } from '$lib/domain/feeding';
	import type { Feeding } from '$lib/types';

	/**
	 * Bouton « Nourri » en un toucher, avec le compteur du jour.
	 * - aquariumId : le bac nourri.
	 * - compact : capsule seule (pastille de compteur), sans ligne de texte ; sinon carte pleine largeur.
	 * Demande confirmation quand la consigne du jour est atteinte. Marche hors ligne (file d'attente).
	 */
	interface Props {
		aquariumId: number;
		compact?: boolean;
	}
	let { aquariumId, compact = false }: Props = $props();

	const aquarium = $derived(store.view?.aquariums.find((a) => a.id === aquariumId));
	const perDay = $derived(aquarium?.feedingsPerDay ?? null);
	const mine = $derived((store.view?.feedings ?? []).filter((f) => f.aquariumId === aquariumId));
	const today = $derived(feedingsToday(mine, aquariumId));
	const status = $derived(feedingStatus(today.count, perDay));
	const waiting = $derived(mine.some((f) => f.id == null && f.clientId));
	let busy = $state(false);

	const time = (iso: string) =>
		new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });

	const sentence = $derived.by(() => {
		if (today.count === 0) return perDay ? `Aucun repas aujourd’hui · objectif ${perDay}` : 'Aucun repas aujourd’hui';
		const n = `${today.count} repas aujourd’hui`;
		const last = today.last ? ` · dernier à ${time(today.last)}` : '';
		return n + last;
	});

	async function feed() {
		if (busy || !aquarium) return;
		if (status === 'complet' || status === 'trop') {
			const ok = await ui.confirm({
				title: 'Déjà nourri ?',
				message:
					status === 'complet'
						? `« ${aquarium.name} » a déjà reçu ses ${perDay} repas aujourd’hui. Ajouter quand même ?`
						: `« ${aquarium.name} » a déjà reçu ${today.count} repas aujourd’hui, pour un objectif de ${perDay}. Ajouter quand même ?`,
				confirmLabel: 'Ajouter'
			});
			if (!ok) return;
		}
		busy = true;
		try {
			const before = new Set(mine.map((f) => f.clientId ?? `id:${f.id}`));
			await store.addFeeding(aquariumId);
			const added = (store.view?.feedings ?? []).find(
				(f) => f.aquariumId === aquariumId && !before.has(f.clientId ?? `id:${f.id}`)
			);
			ui.show('Repas noté', added ? () => void undo(added) : undefined, 'check');
		} catch (e) {
			ui.show((e as Error).message);
		} finally {
			busy = false;
		}
	}

	/** Annule le repas : si le serveur ne l'a pas encore reçu, on attend qu'il lui donne un identifiant. */
	async function undo(added: Feeding) {
		ui.dismiss();
		try {
			const deadline = Date.now() + 8000;
			let id = added.id;
			while (id == null && Date.now() < deadline) {
				id = (store.view?.feedings ?? []).find((f) => f.clientId === added.clientId)?.id;
				if (id == null) await new Promise((r) => setTimeout(r, 300));
			}
			if (id == null) throw new Error('Annulation impossible pour l’instant : le repas n’est pas encore envoyé.');
			await store.deleteFeeding(id);
			ui.show('Repas annulé');
		} catch (e) {
			ui.show((e as Error).message || 'Annulation impossible hors connexion.');
		}
	}

	const tone = $derived(status === 'trop' ? 'text-red' : status === 'complet' ? 'text-orange' : 'text-label2');
</script>

{#if aquarium}
	{#if compact}
		<button
			type="button"
			class="pressable relative inline-flex min-h-9 items-center gap-1.5 rounded-full bg-fill3 pl-3 pr-3.5 text-[15px] font-semibold text-tint disabled:opacity-50"
			onclick={feed}
			disabled={busy}
			aria-label="Nourri : {sentence}"
		>
			<Icon name="fish" size={18} filled weight={1.8} />
			Nourri
			{#if today.count > 0}
				<span class="rounded-num ml-0.5 min-w-5 rounded-full px-1.5 text-center text-[13px] {status === 'trop' ? 'bg-red text-white' : status === 'complet' ? 'bg-orange text-white' : 'bg-tint text-white'}">{today.count}</span>
			{/if}
			{#if waiting}<span class="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg2 bg-orange" title="En attente d’envoi"></span>{/if}
		</button>
	{:else}
		<div class="group flex items-center gap-3 p-3.5">
			<span class="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-teal text-white" style="--cut: var(--teal)">
				<Icon name="fish" size={20} filled weight={1.8} />
			</span>
			<div class="min-w-0 flex-1">
				<p class="headline">Nourrissage</p>
				<p class="subhead {tone}">
					{sentence}{#if waiting}<span class="text-orange">{' '}· en attente d’envoi</span>{/if}
				</p>
			</div>
			<button
				type="button"
				class="btn-filled !min-h-10 !px-4 !text-[16px]"
				onclick={feed}
				disabled={busy}
			>
				Nourri
			</button>
		</div>
	{/if}
{/if}

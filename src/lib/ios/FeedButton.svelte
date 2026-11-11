<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { feedingStatus, feedingsToday } from '$lib/domain/feeding';
	import { haptic } from '$lib/motion/haptic';
	import { reducedMotion } from '$lib/motion/reduced';
	import { fed } from '$lib/voice';
	import type { Feeding } from '$lib/types';

	/**
	 * Bouton « Nourri » en un toucher, avec le compteur du jour.
	 * - aquariumId : le bac nourri.
	 * - compact : capsule seule (pastille de compteur), sans ligne de texte ; sinon carte pleine largeur.
	 * Demande confirmation quand la consigne du jour est atteinte. Marche hors ligne (file d'attente).
	 * Pas de bannière : des flocons tombent, le compteur monte, et pendant quelques secondes le bouton
	 * devient « Annuler ».
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

	// Flocons de nourriture (mouvement court, coupé en « Réduire les animations »).
	const FLAKES = [-16, -8, 0, 8, 16];
	let flakes = $state(0);
	let flakeTimer: ReturnType<typeof setTimeout> | undefined;
	function sprinkle() {
		if (reducedMotion()) return;
		flakes += 1;
		clearTimeout(flakeTimer);
		flakeTimer = setTimeout(() => (flakes = 0), 900);
	}

	/** Repas qu'on peut encore annuler d'un toucher (le bouton affiche « Annuler » pendant ce temps). */
	const UNDO_MS = 4500;
	let justFed = $state<Feeding | null>(null);
	let undoTimer: ReturnType<typeof setTimeout> | undefined;
	/** Dit le geste aux lecteurs d'écran, puisqu'aucune bannière ne l'affiche. */
	let said = $state('');
	$effect(() => () => {
		clearTimeout(flakeTimer);
		clearTimeout(undoTimer);
	});

	async function feed() {
		if (busy || !aquarium) return;
		if (justFed) return void undo();
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
			haptic('tick');
			sprinkle();
			await store.addFeeding(aquariumId);
			const added = (store.view?.feedings ?? []).find(
				(f) => f.aquariumId === aquariumId && !before.has(f.clientId ?? `id:${f.id}`)
			);
			said = fed(today.count, perDay);
			if (added) {
				justFed = added;
				clearTimeout(undoTimer);
				undoTimer = setTimeout(() => (justFed = null), UNDO_MS);
			}
		} catch (e) {
			ui.fail(e);
		} finally {
			busy = false;
		}
	}

	/** Annule le repas : si le serveur ne l'a pas encore reçu, on attend qu'il lui donne un identifiant. */
	async function undo() {
		const added = justFed;
		if (!added) return;
		clearTimeout(undoTimer);
		justFed = null;
		haptic('tick');
		try {
			const deadline = Date.now() + 8000;
			let id = added.id;
			while (id == null && Date.now() < deadline) {
				id = (store.view?.feedings ?? []).find((f) => f.clientId === added.clientId)?.id;
				if (id == null) await new Promise((r) => setTimeout(r, 300));
			}
			if (id == null) throw new Error('Annulation impossible pour l’instant : le repas n’est pas encore envoyé.');
			await store.deleteFeeding(id);
			said = 'Repas annulé.';
		} catch (e) {
			ui.fail(e, 'Annulation impossible hors connexion.');
		}
	}

	const tone = $derived(status === 'trop' ? 'text-red' : status === 'complet' ? 'text-orange' : 'text-label2');
</script>

{#snippet sprinkles()}
	{#if flakes}
		{#key flakes}
			<span class="pointer-events-none absolute inset-x-0 top-1 flex justify-center" aria-hidden="true">
				{#each FLAKES as dx, i (dx)}
					<span class="absolute h-1 w-1 rounded-full" style="background: var(--coral); --dx: {dx}px; animation: flake 760ms var(--ease-out) {i * 40}ms both"></span>
				{/each}
			</span>
		{/key}
	{/if}
{/snippet}

{#if aquarium}
	{#if compact}
		<button
			type="button"
			class="pressable relative inline-flex min-h-9 items-center gap-1.5 rounded-full bg-fill3 pl-3 pr-3.5 text-[15px] font-semibold text-tint disabled:opacity-50"
			onclick={feed}
			disabled={busy}
			aria-label={justFed ? 'Annuler le repas noté' : `Nourri : ${sentence}`}
		>
			{#if justFed}
				<Icon name="undo" size={18} weight={2.2} />
				Annuler
			{:else}
				<Icon name="fish" size={18} filled weight={1.8} />
				Nourri
			{/if}
			{#if today.count > 0}
				<span class="rounded-num ml-0.5 min-w-5 rounded-full px-1.5 text-center text-[13px] {status === 'trop' ? 'bg-red text-white' : status === 'complet' ? 'bg-orange text-white' : 'bg-tint text-on-tint'}">{today.count}</span>
			{/if}
			{#if waiting}<span class="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg2 bg-orange" title="En attente d’envoi"></span>{/if}
			{@render sprinkles()}
		</button>
		<span class="sr-only" role="status">{said}</span>
	{:else}
		<div class="group flex items-center gap-3 p-3.5">
			<span class="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-chip bg-teal text-white" style="--cut: var(--teal)">
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
				class="relative {justFed ? 'btn-tinted' : 'btn-filled'} !min-h-10 !px-4 !text-[16px]"
				onclick={feed}
				disabled={busy}
			>
				{justFed ? 'Annuler' : 'Nourri'}
				{@render sprinkles()}
			</button>
			<span class="sr-only" role="status">{said}</span>
		</div>
	{/if}
{/if}

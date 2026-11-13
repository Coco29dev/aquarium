<script lang="ts">
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import { haptic } from '$lib/motion/haptic';
	import type { DisplayItem } from '$lib/domain/assistant';

	/**
	 * Carte d'une action proposée par l'assistant (noter une mesure, cocher une tâche, un repas, une note).
	 * Elle montre ce qui sera fait AVANT de le faire : « Confirmer » l'exécute, « Refuser » ne fait rien et le
	 * dit à l'assistant. Une fois jugée, elle devient un reçu : fait, refusé ou échoué.
	 * Props : item (kind 'action'), waiting (cette carte attend une décision), decision (choix déjà pris, en
	 * cours d'envoi), ondecide(approuvée ?).
	 */
	type Action = Extract<DisplayItem, { kind: 'action' }>;
	interface Props {
		item: Action;
		waiting: boolean;
		decision?: boolean;
		ondecide: (approve: boolean) => void;
	}
	let { item, waiting, decision, ondecide }: Props = $props();

	const ICONS: Record<string, IconName> = { noter_mesure: 'flask', terminer_tache: 'today', noter_repas: 'fish', ajouter_note: 'note' };
	const KICKERS: Record<string, string> = { noter_mesure: 'Mesure', terminer_tache: 'Tâche', noter_repas: 'Repas', ajouter_note: 'Note' };
	const icon = $derived(ICONS[item.name] ?? 'check');
	const kicker = $derived(KICKERS[item.name] ?? 'Action');

	const look = $derived(
		item.status === 'done'
			? { color: 'var(--green)', text: 'Enregistré', symbol: 'check' as IconName }
			: item.status === 'error'
				? { color: 'var(--red)', text: 'Pas enregistré', symbol: 'alert' as IconName }
				: item.status === 'refused'
					? { color: 'var(--gray)', text: 'Refusé', symbol: 'close' as IconName }
					: decision !== undefined
						? { color: decision ? 'var(--green)' : 'var(--gray)', text: decision ? 'Confirmé…' : 'Refusé…', symbol: (decision ? 'check' : 'close') as IconName }
						: { color: 'var(--tint)', text: 'À confirmer', symbol: icon }
	);
	const open = $derived(item.status === 'pending' && waiting && decision === undefined);

	function choose(approve: boolean) {
		haptic(approve ? 'confirm' : 'tick');
		ondecide(approve);
	}
</script>

<div
	class="card w-full overflow-hidden rounded-[22px] bg-bg2 {open ? 'open' : ''}"
	style="--accent: {look.color}"
	role="group"
	aria-label="{kicker} proposée : {item.label}"
>
	<div class="flex items-start gap-3 px-3.5 pb-3 pt-3">
		<span class="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] text-white transition-colors duration-300" style="background: {look.color}">
			<Icon name={look.symbol} size={20} filled={look.symbol === icon} weight={2.2} />
		</span>
		<div class="min-w-0 flex-1">
			<p class="caption1 font-semibold uppercase tracking-wide" style="color: {look.color}">{kicker} · {look.text}</p>
			<p class="subhead mt-0.5 font-semibold">{item.label}</p>
			{#if item.status === 'done' && item.detail}<p class="footnote mt-0.5 text-label2">{item.detail}</p>
			{:else if item.status === 'error'}<p class="footnote mt-0.5 text-red">{item.detail}</p>
			{:else if open}<p class="footnote mt-0.5 text-label2">Rien n’est enregistré tant que tu n’as pas confirmé.</p>{/if}
		</div>
	</div>
	{#if open}
		<div class="grid grid-cols-2 gap-2 px-3.5 pb-3.5">
			<button class="pressable h-11 rounded-full bg-fill3 font-semibold" onclick={() => choose(false)}>Refuser</button>
			<button class="pressable h-11 rounded-full bg-tint font-semibold text-on-tint" onclick={() => choose(true)}>Confirmer</button>
		</div>
	{/if}
</div>

<style>
	.card {
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent);
		transition: box-shadow 300ms;
	}
	/* Une carte qui attend une décision se détache un peu du fil. */
	.card.open {
		box-shadow:
			inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 45%, transparent),
			var(--elev-1);
	}
</style>

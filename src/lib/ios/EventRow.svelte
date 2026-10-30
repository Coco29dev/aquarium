<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { EVENT_META, eventSummary } from '$lib/domain/events';
	import type { AquariumEvent } from '$lib/types';

	/**
	 * Ligne d'événement du journal : pastille d'icône colorée, résumé, note, heure.
	 * - onopen : toucher la ligne (modifier) ; absent pour un événement pas encore envoyé.
	 * - oncomplete : « Compléter » apparaît pour un changement d'eau noté automatiquement sans détails.
	 * À placer dans un <SwipeRow> (qui fournit le <li>) ou une liste.
	 */
	interface Props {
		event: AquariumEvent;
		onopen?: () => void;
		oncomplete?: () => void;
	}
	let { event, onopen, oncomplete }: Props = $props();

	const meta = $derived(EVENT_META[event.kind]);
	const pending = $derived(event.id == null);
	const bare = $derived(event.kind === 'changement_eau' && Object.keys(event.payload ?? {}).length === 0);
	const time = $derived(new Date(event.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }));
	const summary = $derived(event.kind === 'note' && event.note ? event.note : eventSummary(event));
</script>

<div class="flex items-start gap-3 px-4 py-3 {onopen && !pending ? 'tappable' : ''}">
	<span
		class="mt-0.5 grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px] text-white {pending ? 'opacity-50' : ''}"
		style="background: {meta.color}; --cut: {meta.color}"
	>
		<Icon name={meta.icon} size={18} filled weight={2} />
	</span>
	{#if onopen && !pending}
		<button type="button" class="min-w-0 flex-1 text-left" onclick={onopen}>
			<p class="body {event.kind === 'note' ? 'whitespace-pre-line' : ''}">{summary}</p>
			{#if event.note && event.kind !== 'note'}<p class="subhead text-label2">{event.note}</p>{/if}
			{#if pending}<p class="footnote text-orange">En attente d’envoi</p>{/if}
		</button>
	{:else}
		<div class="min-w-0 flex-1">
			<p class="body {pending ? 'text-label2' : ''}">{summary}</p>
			{#if event.note && event.kind !== 'note'}<p class="subhead text-label2">{event.note}</p>{/if}
			{#if pending}<p class="footnote text-orange">En attente d’envoi</p>{/if}
		</div>
	{/if}
	<div class="flex shrink-0 flex-col items-end gap-1">
		<span class="rounded-num subhead text-label2">{time}</span>
		{#if bare && oncomplete && !pending}
			<button type="button" class="footnote rounded-full bg-tint/15 px-2.5 py-1 font-semibold text-tint active:opacity-60" onclick={oncomplete}>Compléter</button>
		{/if}
	</div>
</div>

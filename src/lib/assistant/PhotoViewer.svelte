<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';

	/**
	 * Visionneuse d'une photo envoyée à l'assistant : plein écran sombre, « Ajouter aux photos du bac » (copie
	 * dans la galerie du bac, qui survit à la suppression de la conversation). Toucher la photo ou le fond,
	 * ou Échap, la ferme.
	 */
	interface Props {
		id: number | null;
		onclose: () => void;
		onadd: (id: number) => void;
	}
	let { id, onclose, onadd }: Props = $props();
</script>

<svelte:window onkeydown={(e) => id !== null && e.key === 'Escape' && onclose()} />

{#if id !== null}
	<div class="fixed inset-0 z-50 flex flex-col bg-black/92" style="animation: fade-in 200ms both; padding-top: env(safe-area-inset-top)" role="dialog" aria-modal="true" aria-label="Photo">
		<div class="flex items-center justify-between px-4 py-3 text-white">
			<button class="pressable grid h-11 w-11 place-items-center rounded-full bg-white/15" onclick={onclose} aria-label="Fermer"><Icon name="close" size={22} weight={2.4} /></button>
			<button class="pressable inline-flex h-11 items-center gap-2 rounded-full bg-white/15 px-4 subhead font-semibold" onclick={() => onadd(id)}>
				<Icon name="plus" size={18} weight={2.6} />Ajouter aux photos du bac
			</button>
		</div>
		<button class="flex min-h-0 flex-1 items-center justify-center p-2" style="padding-bottom: max(env(safe-area-inset-bottom), 8px)" onclick={onclose} aria-label="Fermer la photo">
			<img src="/api/assistant/images/{id}" alt="Pièce jointe" class="max-h-full max-w-full rounded-[10px] object-contain" />
		</button>
	</div>
{/if}

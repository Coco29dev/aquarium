<script lang="ts">
	import { ui } from '$lib/client/ui.svelte';
	import Icon from '$lib/components/Icon.svelte';

	/**
	 * Bloc de texte en police mono avec un bouton « Copier » : adresses, en-têtes, jetons.
	 * La copie passe par le presse-papiers ; si Safari la refuse, le texte est sélectionné pour être copié à la main.
	 */
	interface Props {
		label: string;
		value: string;
		/** Précision sous le bloc. */
		hint?: string;
		/** Texte copié si différent de l'affichage (ex. jeton masqué). */
		copyValue?: string;
		/** Texte du message après la copie. */
		copied?: string;
	}
	let { label, value, hint, copyValue, copied = 'Copié' }: Props = $props();

	let box = $state<HTMLElement>();

	function selectText() {
		if (!box) return;
		const range = document.createRange();
		range.selectNodeContents(box);
		const selection = getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(copyValue ?? value);
			ui.show(copied, undefined, 'check');
		} catch {
			selectText();
			ui.show('Sélectionné : touche Copier dans le menu');
		}
	}
</script>

<div class="px-4 py-3">
	<div class="mb-1.5 flex items-center justify-between gap-3">
		<p class="footnote font-semibold uppercase text-label2">{label}</p>
		<button type="button" class="btn-plain subhead flex items-center gap-1 font-semibold" onclick={copy}>
			<Icon name="note" size={16} weight={2} />Copier
		</button>
	</div>
	<p bind:this={box} class="rounded-xl bg-fill3 px-3 py-2.5 font-mono text-[13px] leading-snug break-all select-text">{value}</p>
	{#if hint}<p class="footnote mt-1.5 text-label2">{hint}</p>{/if}
</div>

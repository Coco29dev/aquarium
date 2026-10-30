<script lang="ts">
	/**
	 * Interrupteur iOS. L'attribut `switch` fait dessiner à Safari (iOS 17.4+) un vrai
	 * interrupteur natif, avec retour haptique ; ailleurs, layout.css l'imite.
	 */
	interface Props {
		checked?: boolean;
		name?: string;
		disabled?: boolean;
		label?: string;
		onchange?: (event: Event & { currentTarget: HTMLInputElement }) => void;
	}
	let { checked = $bindable(false), name, disabled = false, label, onchange }: Props = $props();

	// `switch` n'est pas encore dans les types HTML de Svelte.
	const native: Record<string, string> = { switch: '' };
</script>

<input type="checkbox" {...native} {name} {disabled} bind:checked {onchange} aria-label={label} />

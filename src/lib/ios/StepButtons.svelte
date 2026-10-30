<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';

	/** Stepper iOS piloté par rappels (pas libre, décimales) : capsule grise « − | + ». */
	interface Props {
		onminus: () => void;
		onplus: () => void;
		minusDisabled?: boolean;
		plusDisabled?: boolean;
		label?: string;
	}
	let { onminus, onplus, minusDisabled = false, plusDisabled = false, label = '' }: Props = $props();
</script>

<div class="flex h-8 w-[94px] shrink-0 items-center rounded-full bg-fill3" role="group" aria-label={label}>
	<button
		type="button"
		class="grid h-full flex-1 place-items-center rounded-l-full active:bg-fill disabled:text-label3"
		onclick={onminus}
		disabled={minusDisabled}
		aria-label="Diminuer {label}"
	>
		<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M1.5 7h11" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
	</button>
	<span class="h-[18px] w-px bg-sep"></span>
	<button
		type="button"
		class="grid h-full flex-1 place-items-center rounded-r-full active:bg-fill disabled:text-label3"
		onclick={onplus}
		disabled={plusDisabled}
		aria-label="Augmenter {label}"
	>
		<Icon name="plus" size={18} weight={2.2} />
	</button>
</div>

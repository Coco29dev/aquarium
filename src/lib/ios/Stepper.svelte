<script lang="ts">
	/** Stepper iOS : capsule grise « − | + ». */
	interface Props {
		value: number;
		min?: number;
		max?: number;
		step?: number;
		label?: string;
	}
	let { value = $bindable(), min = 1, max = 365, step = 1, label = 'Valeur' }: Props = $props();
</script>

<div class="flex h-8 shrink-0 items-center rounded-full bg-fill3" role="group" aria-label={label}>
	<button
		type="button"
		class="grid h-8 w-12 place-items-center text-[22px] leading-none active:opacity-40 disabled:text-label3"
		disabled={value <= min}
		onclick={() => (value = Math.max(min, value - step))}
		aria-label="Diminuer"
	>−</button>
	<span class="h-4 w-px bg-sep"></span>
	<button
		type="button"
		class="grid h-8 w-12 place-items-center text-[22px] leading-none active:opacity-40 disabled:text-label3"
		disabled={value >= max}
		onclick={() => (value = Math.min(max, value + step))}
		aria-label="Augmenter"
	>+</button>
</div>

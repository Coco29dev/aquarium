<script lang="ts" generics="T extends string | number">
	/** Contrôle segmenté iOS : capsule grise, segment choisi en relief qui glisse. */
	interface Props {
		options: { value: T; label: string }[];
		value: T;
		onchange?: (value: T) => void;
		label?: string;
	}
	let { options, value = $bindable(), onchange, label }: Props = $props();

	const index = $derived(Math.max(0, options.findIndex((o) => o.value === value)));
</script>

<div class="relative grid rounded-full bg-fill3 p-[3px]" style="grid-template-columns: repeat({options.length}, minmax(0, 1fr))" role="radiogroup" aria-label={label}>
	<span
		class="absolute bottom-[3px] top-[3px] rounded-full bg-bg2 shadow-[0_3px_8px_rgb(0_0_0/0.12),0_0.5px_1px_rgb(0_0_0/0.08)] transition-transform duration-300 ease-[cubic-bezier(0.3,0.8,0.3,1)] dark:bg-[#636366]"
		style="left: 3px; width: calc((100% - 6px) / {options.length}); transform: translateX({index * 100}%)"
		aria-hidden="true"
	></span>
	{#each options as o (o.value)}
		<button
			type="button"
			role="radio"
			aria-checked={o.value === value}
			class="footnote relative z-[1] h-8 truncate px-2 font-semibold transition-opacity active:opacity-60"
			onclick={() => {
				value = o.value;
				onchange?.(o.value);
			}}
		>
			{o.label}
		</button>
	{/each}
</div>

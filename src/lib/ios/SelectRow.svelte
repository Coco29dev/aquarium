<script lang="ts">
	/** Ligne de choix façon menu iOS : libellé à gauche, valeur grise et chevrons haut-bas à droite. */
	interface Props {
		label: string;
		name?: string;
		value?: string;
		options: { value: string; label: string }[];
		onchange?: (value: string) => void;
	}
	let { label, name, value = $bindable(''), options, onchange }: Props = $props();
</script>

<li>
	<label class="flex min-h-11 items-center gap-3 pl-4">
		<span class="row-body flex min-h-11 min-w-0 flex-1 items-center gap-2 py-1.5 pr-4">
			<span class="body min-w-0 flex-1 truncate">{label}</span>
			<select {name} bind:value onchange={(e) => onchange?.(e.currentTarget.value)} class="body max-w-[60%] appearance-none truncate bg-transparent text-right text-label2 outline-none">
				{#each options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
			</select>
			<svg class="shrink-0 text-label3" width="9" height="14" viewBox="0 0 9 14" aria-hidden="true">
				<path d="M1.5 5L4.5 2l3 3M1.5 9l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</span>
	</label>
</li>

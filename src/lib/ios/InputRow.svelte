<script lang="ts">
	/**
	 * Ligne de saisie façon Réglages / Contacts : libellé à gauche, champ aligné à droite,
	 * unité en gris. À placer dans un <Section>.
	 */
	interface Props {
		label: string;
		value?: string;
		name?: string;
		placeholder?: string;
		unit?: string;
		type?: string;
		inputmode?: 'decimal' | 'numeric' | 'text';
		required?: boolean;
		oninput?: (value: string) => void;
		/** Champ aligné à gauche, pleine largeur, sans libellé visible (titre, libellé d'achat). */
		wide?: boolean;
		italic?: boolean;
	}
	let {
		label,
		value = $bindable(''),
		name,
		placeholder,
		unit,
		type = 'text',
		inputmode,
		required = false,
		oninput,
		wide = false,
		italic = false
	}: Props = $props();
</script>

<li>
	<label class="flex min-h-11 items-center gap-3 pl-4">
		<span class="row-body flex min-h-11 min-w-0 flex-1 items-center gap-2 py-1.5 pr-4">
			{#if !wide}<span class="body shrink-0">{label}</span>{/if}
			<input
				{name}
				{type}
				{inputmode}
				{required}
				bind:value
				oninput={(e) => oninput?.(e.currentTarget.value)}
				placeholder={placeholder ?? (wide ? label : '')}
				aria-label={label}
				class="body min-w-0 flex-1 bg-transparent outline-none placeholder:text-label3 {wide ? 'text-left' : 'text-right text-label2 focus:text-label'} {italic ? 'italic' : ''} {inputmode === 'decimal' || inputmode === 'numeric' ? 'rounded-num' : ''}"
			/>
			{#if unit}<span class="body shrink-0 text-label2">{unit}</span>{/if}
		</span>
	</label>
</li>

<script lang="ts">
	/** Ligne de formulaire iOS : libellé à gauche, champ aligné à droite, unité éventuelle. */
	interface Props {
		label: string;
		value: string;
		placeholder?: string;
		inputmode?: 'text' | 'decimal' | 'numeric';
		type?: 'text' | 'date' | 'number';
		suffix?: string;
		id: string;
		/** Champ pleine largeur sans libellé visible (nom, intitulé). */
		wide?: boolean;
		required?: boolean;
	}
	let { label, value = $bindable(), placeholder, inputmode, type = 'text', suffix, id, wide = false, required = false }: Props = $props();
</script>

<li class="pl-4">
	<div class="row-body flex min-h-11 items-center gap-3 pr-4">
		{#if wide}
			<input
				{id}
				{type}
				bind:value
				{placeholder}
				{inputmode}
				{required}
				aria-label={label}
				class="body h-11 w-full bg-transparent outline-none placeholder:text-label3"
			/>
		{:else}
			<label for={id} class="body shrink-0">{label}</label>
			{#if type === 'date'}
				<input {id} type="date" bind:value class="body ml-auto rounded-lg bg-fill3 px-2.5 py-1 text-right outline-none" />
			{:else}
				<input
					{id}
					{type}
					bind:value
					{placeholder}
					{inputmode}
					{required}
					class="body h-11 min-w-0 flex-1 bg-transparent text-right text-label2 outline-none placeholder:text-label3"
				/>
			{/if}
			{#if suffix}<span class="body text-label2">{suffix}</span>{/if}
		{/if}
	</div>
</li>

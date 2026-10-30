<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';

	/** Champ de recherche iOS : capsule grise avec loupe, « Annuler » qui apparaît au focus. */
	interface Props {
		value: string;
		placeholder?: string;
		oninput?: () => void;
		label?: string;
	}
	let { value = $bindable(), placeholder = 'Rechercher', oninput, label = 'Rechercher' }: Props = $props();

	let focused = $state(false);
	let input = $state<HTMLInputElement>();

	function cancel() {
		value = '';
		oninput?.();
		input?.blur();
		focused = false;
	}
</script>

<div class="flex items-center gap-2">
	<label class="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-full bg-fill3 px-2.5 text-label2">
		<Icon name="search" size={18} weight={2.2} />
		<input
			bind:this={input}
			bind:value
			{oninput}
			onfocus={() => (focused = true)}
			onblur={() => (focused = value.trim() !== '' && focused)}
			type="search"
			enterkeyhint="search"
			{placeholder}
			aria-label={label}
			class="body min-w-0 flex-1 bg-transparent text-label outline-none placeholder:text-label2 [&::-webkit-search-cancel-button]:hidden"
		/>
		{#if value}
			<button
				type="button"
				class="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-label3 text-bg2"
				aria-label="Effacer"
				onclick={() => {
					value = '';
					oninput?.();
					input?.focus();
				}}
			>
				<Icon name="close" size={11} weight={3.4} />
			</button>
		{/if}
	</label>
	{#if focused}
		<button type="button" class="btn-plain shrink-0" style="animation: fade-in 160ms both" onclick={cancel}>Annuler</button>
	{/if}
</div>

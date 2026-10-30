<script lang="ts">
	import { ui } from '$lib/client/ui.svelte';
	import Icon from './Icon.svelte';
</script>

{#if ui.toast}
	{#key ui.toast.id}
		<div
			class="rise fixed inset-x-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl border-2 border-edge bg-ink px-4 py-3 text-on-ink shadow-[4px_4px_0_var(--sun)]"
			style="bottom: calc(env(safe-area-inset-bottom) + 6.5rem)"
			role="status"
		>
			<span class="min-w-0 flex-1 text-sm font-bold">{ui.toast.message}</span>
			{#if ui.toast.undo}
				<button
					class="flex items-center gap-1 rounded-lg bg-sun px-3 py-1.5 text-sm font-bold text-[#16202e]"
					onclick={() => ui.toast?.undo?.()}
				>
					<Icon name="undo" size={16} />Annuler
				</button>
			{/if}
		</div>
	{/key}
{/if}

<script lang="ts">
	import { ui } from '$lib/client/ui.svelte';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
</script>

<!-- Bannière flottante en haut, en verre, comme une notification iOS. -->
{#if ui.toast}
	{#key ui.toast.id}
		<div
			class="glass fixed inset-x-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-full py-2 pl-2.5 pr-2"
			style="top: calc(env(safe-area-inset-top) + 8px); animation: banner-in 420ms cubic-bezier(0.3, 0.8, 0.3, 1.15) both"
			role="status"
		>
			{#if ui.toast.icon}
				<span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-green text-white">
					<Icon name={ui.toast.icon as IconName} size={18} weight={2.6} />
				</span>
			{/if}
			<span class="subhead min-w-0 flex-1 truncate font-semibold">{ui.toast.message}</span>
			{#if ui.toast.undo}
				<button class="subhead rounded-full bg-fill3 px-3.5 py-1.5 font-semibold text-tint active:opacity-50" onclick={() => ui.toast?.undo?.()}>
					Annuler
				</button>
			{/if}
		</div>
	{/key}
{/if}

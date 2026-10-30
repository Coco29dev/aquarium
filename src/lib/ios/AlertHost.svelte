<script lang="ts">
	import { ui } from '$lib/client/ui.svelte';
</script>

<!-- Alerte iOS 26 : carte de verre centrée, boutons en capsules côte à côte. -->
{#if ui.alert}
	{@const a = ui.alert}
	<div class="fixed inset-0 z-[60] grid place-items-center bg-[var(--dim)] px-10" style="animation: fade-in 200ms both" role="presentation">
		<div
			class="w-full max-w-[300px] rounded-[34px] bg-[var(--glass-strong)] p-5 text-center shadow-2xl backdrop-blur-2xl"
			style="animation: pop-in 260ms cubic-bezier(0.3, 0.8, 0.3, 1.1) both"
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="alert-title"
		>
			<h2 id="alert-title" class="headline">{a.title}</h2>
			{#if a.message}<p class="footnote mt-1.5 text-label">{a.message}</p>{/if}
			<div class="mt-5 grid grid-cols-2 gap-2.5">
				<button class="headline min-h-12 rounded-full bg-fill2 font-medium active:opacity-60" onclick={() => a.resolve(false)}>
					{a.cancelLabel ?? 'Annuler'}
				</button>
				<button
					class="headline min-h-12 rounded-full active:opacity-60 {a.destructive ? 'bg-red text-white' : 'bg-tint text-white'}"
					onclick={() => a.resolve(true)}
				>
					{a.confirmLabel ?? 'OK'}
				</button>
			</div>
		</div>
	</div>
{/if}

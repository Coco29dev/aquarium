<script lang="ts">
	import { ui } from '$lib/client/ui.svelte';
	import { presence } from '$lib/motion/presence.svelte';

	// L'alerte reste affichée le temps de sa sortie : on garde une copie de la dernière demande, ui.alert
	// passant à null dès qu'on a répondu.
	let last = $state<typeof ui.alert>(null);
	$effect(() => {
		if (ui.alert) last = ui.alert;
	});
	const view = presence(() => Boolean(ui.alert), 200);
	const a = $derived(ui.alert ?? last);
</script>

<!-- Alerte iOS 26 : carte de verre centrée, boutons en capsules côte à côte. Le voile et la carte portent chacun un
     nom de transition : ils restent par-dessus la page quand une navigation suit la réponse. -->
{#if view.rendered && a}
	<div class="fixed inset-0 z-[60] grid place-items-center px-10" style:pointer-events={view.leaving ? 'none' : undefined} role="presentation">
		<div
			class="absolute inset-0 bg-[var(--dim)]"
			style="view-transition-name: alert-dim; animation: {view.leaving ? 'fade-out var(--dur-s) var(--ease-in) both' : 'fade-in 200ms both'}"
			aria-hidden="true"
		></div>
		<div
			class="relative w-full max-w-[300px] rounded-[34px] bg-[var(--glass-strong)] p-5 text-center shadow-[var(--elev-3)] backdrop-blur-2xl"
			style="view-transition-name: alert; animation: {view.leaving ? 'pop-out var(--dur-s) var(--ease-in) both' : 'pop-in 260ms var(--ease-pop) both'}"
			onanimationend={view.end}
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
					class="headline min-h-12 rounded-full active:opacity-60 {a.destructive ? 'bg-red text-white' : 'bg-tint text-on-tint'}"
					onclick={() => a.resolve(true)}
				>
					{a.confirmLabel ?? 'OK'}
				</button>
			</div>
		</div>
	</div>
{/if}

<script lang="ts">
	import { goto } from '$app/navigation';
	import { ui, type Toast, type ToastKind } from '$lib/client/ui.svelte';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';

	/**
	 * Bannière flottante en haut, en verre, comme une notification iOS. Quatre natures : confirmation
	 * (pastille verte), information (couleur d'accent), à regarder (orange, ton calme) et échec (rouge,
	 * reste affichée et se ferme d'un toucher). Une bannière peut porter « Annuler » ou un lien (« Voir »).
	 * Elle porte son propre nom de transition (view-transition-name) pour rester au-dessus d'un
	 * changement d'écran, et se retire par une courte sortie plutôt que de disparaître d'un coup.
	 */

	/** Bannière gardée à l'écran pendant sa sortie (ui.toast est déjà null à ce moment-là). */
	let shown = $state<Toast | null>(null);
	let leaving = $state(false);

	$effect(() => {
		const toast = ui.toast;
		if (toast) {
			shown = toast;
			leaving = false;
			return;
		}
		if (!shown) return;
		leaving = true;
		// Durée de la sortie (--dur-s) ; « Réduire les animations » la ramène à 1 ms côté CSS.
		const timer = setTimeout(() => {
			shown = null;
			leaving = false;
		}, 190);
		return () => clearTimeout(timer);
	});

	const TONE: Record<ToastKind, string> = {
		ok: 'var(--green)',
		info: 'var(--tint)',
		warn: 'var(--orange)',
		error: 'var(--red)'
	};
	const DEFAULT_ICON: Record<ToastKind, IconName | null> = { ok: 'check', info: null, warn: 'alert', error: 'alert' };

	const iconOf = (t: Toast): IconName | null => (t.icon as IconName | undefined) ?? DEFAULT_ICON[t.kind];

	/** Une valeur à regarder ou un échec entre par un simple fondu : pas de rebond sur ce qui demande de l'attention. */
	const calm = (t: Toast) => t.kind === 'warn' || t.kind === 'error';

	function follow(href: string) {
		ui.dismiss();
		void goto(href);
	}
</script>

{#if shown}
	{@const t = shown}
	{@const icon = iconOf(t)}
	{#key t.id}
		<div
			class="glass fixed inset-x-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-card py-2 pl-2.5 pr-2"
			style="top: calc(env(safe-area-inset-top) + 8px); view-transition-name: banner; animation: {leaving
				? 'banner-out var(--dur-s) var(--ease-in) both'
				: calm(t)
					? 'fade-in var(--dur-s) var(--ease-out) both'
					: 'banner-in var(--dur-m) var(--ease-pop) both'}"
			role={t.kind === 'error' ? 'alert' : 'status'}
		>
			{#if icon}
				<span class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white" style="background: {TONE[t.kind]}; --cut: {TONE[t.kind]}">
					<Icon name={icon} size={18} weight={2.6} />
				</span>
			{/if}
			<span class="subhead line-clamp-2 min-w-0 flex-1 font-semibold">{t.message}</span>
			{#if t.undo}
				<button class="subhead min-h-9 shrink-0 rounded-full bg-fill3 px-3.5 py-1.5 font-semibold text-tint active:opacity-50" onclick={() => t.undo?.()}>
					Annuler
				</button>
			{:else if t.action}
				{@const href = t.action.href}
				<button class="subhead min-h-9 shrink-0 rounded-full bg-fill3 px-3.5 py-1.5 font-semibold text-tint active:opacity-50" onclick={() => follow(href)}>
					{t.action.label}
				</button>
			{:else if t.kind === 'error'}
				<button class="subhead min-h-9 shrink-0 rounded-full bg-fill3 px-3.5 py-1.5 font-semibold text-tint active:opacity-50" onclick={() => ui.dismiss()}>
					OK
				</button>
			{/if}
		</div>
	{/key}
{/if}

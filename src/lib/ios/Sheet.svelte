<script lang="ts">
	import type { Snippet } from 'svelte';
	import { presence } from '$lib/motion/presence.svelte';

	/**
	 * Feuille modale iOS : monte du bas, poignée, barre « Annuler · Titre · Action »,
	 * se ferme en la tirant vers le bas ou en touchant le fond.
	 */
	interface Props {
		open: boolean;
		title?: string;
		onclose: () => void;
		/** 'medium' : moitié d'écran ; 'large' : presque plein écran. */
		detent?: 'medium' | 'large';
		cancelLabel?: string;
		action?: { label: string; onclick: () => void; disabled?: boolean };
		children: Snippet;
	}
	let { open, title, onclose, detent = 'large', cancelLabel = 'Annuler', action, children }: Props = $props();

	// La feuille reste montée le temps de sa sortie (descente + fondu du voile), puis disparaît.
	const view = presence(() => open, 280);

	let drag = $state(0);
	let startY = 0;
	let startT = 0;
	let dragging = $state(false);

	let pressed = false;
	let pointer = -1;
	let zone: HTMLElement | null = null;

	function down(e: PointerEvent) {
		// Un appui sur un bouton de la barre reste un clic : pas de glissement.
		if ((e.target as Element).closest('button')) return;
		pressed = true;
		pointer = e.pointerId;
		zone = e.currentTarget as HTMLElement;
		startY = e.clientY;
		startT = performance.now();
	}
	function move(e: PointerEvent) {
		if (!pressed || e.pointerId !== pointer) return;
		const dy = e.clientY - startY;
		// On ne capture le doigt qu'une fois le glissement amorcé.
		if (!dragging && dy > 6) {
			dragging = true;
			zone?.setPointerCapture(pointer);
		}
		if (dragging) drag = Math.max(0, dy);
	}
	function up() {
		pressed = false;
		if (!dragging) return;
		dragging = false;
		const speed = drag / Math.max(1, performance.now() - startT);
		// Fermeture : la feuille repart de l'endroit où le doigt l'a lâchée (drag est remis à zéro une fois démontée).
		if (drag > 140 || speed > 0.6) onclose();
		else drag = 0;
	}
	$effect(() => {
		if (!view.rendered) drag = 0;
	});

	// Empêche la page de défiler derrière la feuille.
	$effect(() => {
		if (!open) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !view.leaving && onclose();
		addEventListener('keydown', onKey);
		return () => {
			document.body.style.overflow = previous;
			removeEventListener('keydown', onKey);
		};
	});
</script>

{#if view.rendered}
	<div class="fixed inset-0 z-50" style:pointer-events={view.leaving ? 'none' : undefined} role="presentation">
		<button
			class="absolute inset-0 bg-[var(--dim)]"
			style="animation: {view.leaving ? 'fade-out var(--dur-m) var(--ease-in) both' : 'fade-in 260ms both'}"
			aria-label="Fermer"
			onclick={onclose}
		></button>
		<div
			class="absolute inset-x-0 bottom-0 mx-auto flex max-w-md flex-col overflow-hidden rounded-t-[38px] bg-bg shadow-[0_-8px_40px_rgb(var(--shadow-ink)/0.2)]"
			style="height: {detent === 'large' ? 'calc(100dvh - env(safe-area-inset-top) - 12px)' : '55dvh'}; transform: translateY({drag}px); transition: {dragging ? 'none' : 'transform 300ms cubic-bezier(0.3,0.8,0.3,1)'}; animation: {view.leaving ? 'sheet-down var(--dur-m) var(--ease-in) both' : 'sheet-up 420ms var(--ease-nav) both'}"
			onanimationend={view.end}
			role="dialog"
			aria-modal="true"
			aria-label={title}
		>
			<div
				class="shrink-0 touch-none pb-1 pt-1.5"
				onpointerdown={down}
				onpointermove={move}
				onpointerup={up}
				onpointercancel={up}
				role="presentation"
			>
				<div class="mx-auto h-[5px] w-9 rounded-full bg-label3"></div>
				<div class="grid h-11 grid-cols-[1fr_auto_1fr] items-center px-4">
					<button class="btn-plain justify-self-start" onclick={onclose}>{cancelLabel}</button>
					<p class="headline truncate">{title}</p>
					{#if action}
						<button class="btn-plain justify-self-end font-semibold" disabled={action.disabled} onclick={action.onclick}>{action.label}</button>
					{/if}
				</div>
			</div>
			<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-10 pt-2">
				{@render children()}
			</div>
		</div>
	</div>
{/if}

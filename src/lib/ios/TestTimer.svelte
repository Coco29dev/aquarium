<script lang="ts">
	/**
	 * Minuteur d'attente d'un réactif, façon Minuteur d'iOS : anneau qui se vide, chiffres arrondis.
	 * Composant de présentation : l'état (échéance, fin) vit dans la page, qui passe `remaining` (ms).
	 * - variant 'full' : anneau, bouton Lancer / Annuler / Recommencer.
	 * - variant 'chip' : capsule compacte pour un minuteur d'un autre paramètre (toucher = y aller).
	 */
	interface Props {
		state: 'idle' | 'running' | 'done';
		/** Durée totale en secondes. */
		total: number;
		/** Temps restant en millisecondes (running). */
		remaining?: number;
		label: string;
		variant?: 'full' | 'chip';
		/** La notification serveur n'a pas pu être programmée. */
		notifyFailed?: boolean;
		onstart?: () => void;
		oncancel?: () => void;
		onopen?: () => void;
	}
	let { state, total, remaining = 0, label, variant = 'full', notifyFailed = false, onstart, oncancel, onopen }: Props = $props();

	const secondsLeft = $derived(state === 'running' ? Math.max(0, Math.ceil(remaining / 1000)) : state === 'done' ? 0 : total);
	const clock = $derived(`${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`);
	const ratio = $derived(state === 'running' ? Math.min(1, Math.max(0, remaining / (total * 1000))) : 1);

	function duration(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		if (m === 0) return `${s} s`;
		return s === 0 ? `${m} min` : `${m} min ${s} s`;
	}

	// Anneau : rayon 70, circonférence ≈ 439,8.
	const C = 2 * Math.PI * 70;
</script>

{#if variant === 'chip'}
	<button
		type="button"
		class="pressable flex items-center gap-2 rounded-full bg-fill3 py-1 pl-1.5 pr-3 {state === 'done' ? 'text-green' : 'text-label'}"
		onclick={onopen}
		aria-label="{label} : {state === 'done' ? 'terminé' : clock}"
	>
		<svg width="22" height="22" viewBox="0 0 160 160" aria-hidden="true">
			<circle cx="80" cy="80" r="70" fill="none" stroke="var(--fill)" stroke-width="18" />
			<circle
				cx="80" cy="80" r="70" fill="none"
				stroke={state === 'done' ? 'var(--green)' : 'var(--orange)'}
				stroke-width="18" stroke-linecap="round"
				stroke-dasharray={C} stroke-dashoffset={C * (1 - ratio)}
				transform="rotate(-90 80 80)"
			/>
		</svg>
		<span class="footnote max-w-24 truncate font-semibold">{label}</span>
		<span class="rounded-num footnote">{state === 'done' ? 'Prêt' : clock}</span>
	</button>
{:else}
	<div class="flex flex-col items-center gap-3">
		{#if state === 'idle'}
			<button type="button" class="btn-tinted w-full" onclick={onstart}>
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<circle cx="12" cy="13.5" r="7.5" /><path d="M12 9.5v4l2.5 1.5M9.5 3h5" />
				</svg>
				Lancer le minuteur de {duration(total)}
			</button>
		{:else}
			<div class="relative grid h-[128px] w-[128px] place-items-center" class:pulse={state === 'done'}>
				<svg class="absolute inset-0" viewBox="0 0 160 160" aria-hidden="true">
					<circle cx="80" cy="80" r="70" fill="none" stroke="var(--fill2)" stroke-width="10" />
					<circle
						cx="80" cy="80" r="70" fill="none"
						stroke={state === 'done' ? 'var(--green)' : 'var(--orange)'}
						stroke-width="10" stroke-linecap="round"
						stroke-dasharray={C} stroke-dashoffset={C * (1 - ratio)}
						transform="rotate(-90 80 80)"
					/>
				</svg>
				<div class="text-center" role="timer" aria-live="off" aria-label="{label} : {state === 'done' ? 'terminé' : clock}">
					{#if state === 'done'}
						<p class="title2 text-green">Prêt</p>
						<p class="caption1 text-label2">Lis le résultat</p>
					{:else}
						<p class="rounded-num text-[32px] font-light leading-none">{clock}</p>
						<p class="caption1 mt-1 text-label2">sur {duration(total)}</p>
					{/if}
				</div>
			</div>
			<div class="flex gap-2.5">
				{#if state === 'running'}
					<button type="button" class="btn-tinted !min-h-10 !px-5 !text-[16px]" style="--tint: var(--red)" onclick={oncancel}>Annuler</button>
				{:else}
					<button type="button" class="btn-tinted !min-h-10 !px-5 !text-[16px]" onclick={onstart}>Recommencer</button>
					<button type="button" class="btn-plain !text-[16px]" onclick={oncancel}>Fermer</button>
				{/if}
			</div>
			{#if notifyFailed && state === 'running'}
				<p class="caption1 text-center text-orange">
					Notification indisponible : garde l’écran ouvert, le compte à rebours continue ici.
				</p>
			{/if}
		{/if}
	</div>
{/if}

<style>
	@keyframes ring-pulse {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.07);
		}
	}
	.pulse {
		animation: ring-pulse 700ms ease-in-out 4;
	}
</style>

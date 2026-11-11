<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import { store } from '$lib/client/store.svelte';
	import { tour } from '$lib/client/tour.svelte';
	import { TOUR_STEPS, isLastStep } from '$lib/domain/onboarding';

	/**
	 * Visite guidée du premier lancement : un projecteur sur l'élément réel de l'écran (onglet, bouton +,
	 * bulle de l'assistant) et une carte qui l'explique. Une idée par étape, progression visible,
	 * « Passer » toujours à portée, « Précédent » pour revenir. Les étapes changent d'écran derrière
	 * la carte pour montrer ce que chaque onglet contient.
	 */

	const total = TOUR_STEPS.length;
	const step = $derived(tour.step ?? TOUR_STEPS[0]);
	const index = $derived(tour.index ?? 0);
	const last = $derived(isLastStep(index));
	const noTank = $derived((store.view?.aquariums.length ?? 0) === 0);

	let rect = $state<{ x: number; y: number; w: number; h: number } | null>(null);
	let viewport = $state({ w: 0, h: 0 });
	let card = $state<HTMLElement>();

	const PAD = 5;

	function measure() {
		viewport = { w: innerWidth, h: innerHeight };
		const target = step.target;
		const el = target ? document.querySelector<HTMLElement>(`[data-tour="${target}"]`) : null;
		if (!el) {
			rect = null;
			return;
		}
		const r = el.getBoundingClientRect();
		// Élément rangé hors de l'écran (bulle de l'assistant pendant un défilement) : carte centrée.
		rect = r.width && r.right > 0 && r.left < innerWidth ? { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 } : null;
	}

	// À chaque étape : l'écran derrière la carte change et s'anime, on mesure donc pendant un instant.
	$effect(() => {
		void tour.index;
		measure();
		let ticks = 0;
		const timer = setInterval(() => {
			measure();
			if (++ticks >= 16) clearInterval(timer);
		}, 100);
		void tick().then(() => card?.focus({ preventScroll: true }));
		return () => clearInterval(timer);
	});

	onMount(() => {
		const previous = document.body.style.overflow;
		// Fige la page (et le geste « tirer pour synchroniser », qui regarde ce réglage) pendant la visite.
		document.body.style.overflow = 'hidden';
		addEventListener('resize', measure);
		return () => {
			document.body.style.overflow = previous;
			removeEventListener('resize', measure);
		};
	});

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') tour.finish('skipped');
		else if (e.key === 'ArrowRight') tour.next();
		else if (e.key === 'ArrowLeft') tour.back();
		else if (e.key === 'Tab' && card) {
			// La visite est modale : le focus reste dans la carte.
			const items = [...card.querySelectorAll<HTMLElement>('button:not([disabled])')];
			if (!items.length) return;
			const first = items[0];
			const final = items[items.length - 1];
			const at = document.activeElement;
			if (e.shiftKey && (at === first || at === card)) (e.preventDefault(), final.focus());
			else if (!e.shiftKey && at === final) (e.preventDefault(), first.focus());
		}
	}

	function primary() {
		if (last && noTank) {
			tour.finish('done');
			void goto('/aquariums/nouveau');
		} else tour.next();
	}

	const primaryLabel = $derived(index === 0 ? 'C’est parti' : last ? (noTank ? 'Créer mon premier bac' : 'Terminer') : 'Suivant');

	// Carte sous l'élément s'il est en haut de l'écran, au-dessus sinon (barre d'onglets : en bas).
	const cardStyle = $derived.by(() => {
		if (!rect) return 'top: 50%; transform: translateY(-50%)';
		if (rect.y + rect.h / 2 > viewport.h / 2) return `bottom: ${Math.max(16, viewport.h - rect.y + 14)}px`;
		return `top: ${rect.y + rect.h + 14}px`;
	});
</script>

<svelte:window onkeydown={onKey} />

<!-- Nommée pour la transition entre écrans : la visite change d'onglet derrière la carte sans glisser avec lui.
     overflow-hidden : l'ombre géante du projecteur ne gonfle pas l'image captée par la transition. -->
<div class="fixed inset-0 z-[70] overflow-hidden" style="view-transition-name: tour" role="presentation">
	<!-- Fond : bloque l'écran pendant la visite. Sans élément ciblé, il assombrit tout ; sinon c'est le projecteur qui le fait. -->
	<div class="absolute inset-0" style="background: {rect ? 'transparent' : 'rgb(0 0 0 / 0.55)'}; transition: background 250ms" aria-hidden="true"></div>
	{#if rect}
		<div
			class="pointer-events-none absolute rounded-full"
			style="left: {rect.x}px; top: {rect.y}px; width: {rect.w}px; height: {rect.h}px; box-shadow: 0 0 0 2.5px var(--tint), 0 0 0 100vmax rgb(0 0 0 / 0.58); transition: left var(--dur-m) var(--ease-nav), top var(--dur-m) var(--ease-nav), width var(--dur-m) var(--ease-nav), height var(--dur-m) var(--ease-nav)"
			aria-hidden="true"
		></div>
	{/if}

	<div class="pointer-events-none absolute inset-x-0 mx-auto max-w-md px-4" style={cardStyle}>
		{#key index}
			<div
				bind:this={card}
				tabindex="-1"
				role="dialog"
				aria-modal="true"
				aria-labelledby="tour-title"
				aria-describedby="tour-text"
				class="pointer-events-auto rounded-card bg-bg2 p-5 shadow-[0_16px_48px_rgb(0_0_0/0.35)] outline-none"
				style="animation: pop-in 280ms var(--ease-pop) both"
			>
				<div class="flex items-start gap-3.5">
					<span class="grid h-11 w-11 shrink-0 place-items-center rounded-field bg-tint text-on-tint" style="--cut: var(--tint)">
						<Icon name={step.icon} size={26} filled weight={1.9} />
					</span>
					<div class="min-w-0 flex-1">
						<p class="caption1 font-semibold uppercase tracking-wide text-label2">Étape {index + 1} sur {total}</p>
						<h2 id="tour-title" class="title3 mt-0.5">{step.title}</h2>
					</div>
					{#if !last}
						<button class="btn-plain -mr-2 -mt-2 grid min-h-11 place-items-center px-2 text-[15px]" onclick={() => tour.finish('skipped')}>Passer</button>
					{/if}
				</div>
				<p id="tour-text" class="subhead mt-3 text-label2">{step.text}</p>

				<div class="mt-4 flex gap-1.5" aria-hidden="true">
					{#each TOUR_STEPS as s, i (s.id)}
						<span class="h-1.5 rounded-full transition-all duration-300 {i === index ? 'w-5 bg-tint' : i < index ? 'w-1.5 bg-tint/45' : 'w-1.5 bg-label3'}"></span>
					{/each}
				</div>
				<div class="mt-4 flex items-center gap-3">
					{#if index > 0 && !(last && noTank)}
						<button class="btn-plain grid min-h-11 place-items-center px-1" onclick={() => tour.back()}>Précédent</button>
					{/if}
					<button class="btn-filled flex-1" style="min-height: 48px" onclick={primary}>{primaryLabel}</button>
				</div>
				{#if last && noTank}
					<button class="btn-plain mt-1 grid min-h-11 w-full place-items-center text-[15px]" onclick={() => tour.finish('done')}>Pas maintenant</button>
				{/if}
			</div>
		{/key}
	</div>
</div>

<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import { enableReminders, isStandalone, pushSupported } from '$lib/push-client';
	import { ui } from '$lib/client/ui.svelte';

	// Accueil du premier lancement, façon écrans de bienvenue d'Apple : trois pages qu'on fait
	// défiler, puis création du premier bac.

	let scroller = $state<HTMLElement>();
	let index = $state(0);
	let canNotify = $state(false);
	let reminders = $state<'idle' | 'busy' | 'on' | 'off'>('idle');

	onMount(() => {
		canNotify = isStandalone() && pushSupported();
		if ('Notification' in window && Notification.permission === 'granted') reminders = 'on';
	});

	const features: { icon: IconName; color: string; title: string; text: string }[] = [
		{ icon: 'drop', color: 'var(--blue)', title: 'Mesures en deux touches', text: 'Les dernières valeurs sont déjà là : tu ne touches que ce qui a changé.' },
		{ icon: 'chart', color: 'var(--orange)', title: 'Alertes de dérive', text: 'Une valeur qui bouge trop vite est signalée avant de sortir de la plage.' },
		{ icon: 'cycle', color: 'var(--indigo)', title: 'Coach de cyclage', text: 'Ammoniac, nitrites, nitrates : il te dit quand le bac peut accueillir ses poissons.' }
	];
	const PAGES = 3;

	function onScroll() {
		if (!scroller) return;
		index = Math.round(scroller.scrollLeft / scroller.clientWidth);
	}

	function goTo(i: number) {
		scroller?.scrollTo({ left: i * (scroller?.clientWidth ?? 0), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
	}

	function finish(to: string) {
		try {
			localStorage.setItem('onboarded', '1');
		} catch {
			// Sans stockage, l'accueil pourra revenir : sans gravité.
		}
		void goto(to, { replaceState: true });
	}

	async function activate() {
		reminders = 'busy';
		try {
			const state = await enableReminders();
			reminders = state === 'inactif' ? 'off' : 'on';
		} catch (e) {
			reminders = 'off';
			ui.show((e as Error).message);
		}
	}
</script>

<svelte:head><title>Bienvenue · Aquarium</title></svelte:head>

<div class="fixed inset-0 z-40 mx-auto flex max-w-md flex-col bg-bg" style="padding-top: env(safe-area-inset-top); padding-bottom: max(16px, env(safe-area-inset-bottom))">
	<div class="flex h-11 items-center justify-end px-4">
		<button class="btn-plain" onclick={() => finish('/')}>Plus tard</button>
	</div>

	<div
		bind:this={scroller}
		onscroll={onScroll}
		class="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
		style="scrollbar-width: none"
	>
		<!-- 1. Bienvenue -->
		<section class="flex w-full shrink-0 snap-center flex-col items-center justify-center px-8 text-center">
			<img
				src="/apple-touch-icon-180x180.png"
				alt=""
				width="120"
				height="120"
				class="mb-8 rounded-[27px] shadow-[0_18px_40px_rgb(10_91_214/0.35)]"
				style="animation: pop-in 600ms cubic-bezier(0.3, 0.8, 0.3, 1.1) both"
			/>
			<h1 class="large-title">Bienvenue dans Aquarium</h1>
			<p class="body mt-3 text-label2">Tes bacs, tes mesures et tes tâches, réunis dans une seule appli pensée pour l’iPhone.</p>
		</section>

		<!-- 2. Ce que fait l'appli -->
		<section class="flex w-full shrink-0 snap-center flex-col justify-center px-8">
			<h1 class="title1 mb-9 text-center">Ce que l’appli fait pour toi</h1>
			<ul class="flex flex-col gap-7">
				{#each features as f (f.title)}
					<li class="flex items-start gap-4">
						<span class="mt-0.5 shrink-0" style="color: {f.color}; --cut: var(--bg)"><Icon name={f.icon} size={38} filled weight={1.6} /></span>
						<div>
							<p class="headline">{f.title}</p>
							<p class="subhead mt-0.5 text-label2">{f.text}</p>
						</div>
					</li>
				{/each}
			</ul>
		</section>

		<!-- 3. Rappels -->
		<section class="flex w-full shrink-0 snap-center flex-col items-center justify-center px-8 text-center">
			<span class="mb-8 grid h-[104px] w-[104px] place-items-center rounded-[26px] bg-red text-white shadow-[0_14px_34px_rgb(255_59_48/0.3)]" style="--cut: var(--red)">
				<Icon name="bell" size={58} filled weight={1.6} />
			</span>
			<h1 class="title1">Ne rate plus un changement d’eau</h1>
			<p class="body mt-3 text-label2">
				Un rappel arrive le jour où une tâche est due : changement d’eau, filtre, tests, dosages.
			</p>
			{#if canNotify}
				{#if reminders === 'on'}
					<p class="headline mt-6 flex items-center gap-1.5 text-green"><Icon name="check" size={18} weight={2.8} />Rappels activés</p>
				{:else}
					<button class="btn-tinted mt-6" disabled={reminders === 'busy'} onclick={activate}>
						{reminders === 'off' ? 'Réessayer' : 'Activer les rappels'}
					</button>
				{/if}
			{:else}
				<p class="footnote mt-6 max-w-72 text-label2">
					Pour recevoir les rappels, ajoute d’abord l’appli à l’écran d’accueil : dans Safari, Partager puis « Sur l’écran d’accueil ».
				</p>
			{/if}
		</section>
	</div>

	<div class="flex flex-col items-center gap-5 px-6 pt-4">
		<div class="flex gap-2" role="tablist" aria-label="Pages">
			{#each Array.from({ length: PAGES }, (_, i) => i) as i (i)}
				<button
					role="tab"
					aria-selected={i === index}
					aria-label="Page {i + 1}"
					class="h-2 rounded-full transition-all duration-300 {i === index ? 'w-2 bg-label' : 'w-2 bg-label3'}"
					onclick={() => goTo(i)}
				></button>
			{/each}
		</div>
		{#if index < PAGES - 1}
			<button class="btn-filled w-full" onclick={() => goTo(index + 1)}>Continuer</button>
		{:else}
			<button class="btn-filled w-full" onclick={() => finish('/aquariums/nouveau')}>Créer mon premier bac</button>
		{/if}
	</div>
</div>

<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import Lagoon from '$lib/components/Lagoon.svelte';
	import { APP_NAME, APP_TAGLINE } from '$lib/brand';
	import { enableReminders, isStandalone, pushSupported } from '$lib/push-client';
	import { ui } from '$lib/client/ui.svelte';
	import ProfileForm from '$lib/components/ProfileForm.svelte';

	// Accueil du premier lancement, façon écrans de bienvenue d'Apple : quatre pages qu'on fait
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
		{ icon: 'cycle', color: 'var(--indigo)', title: 'Coach de cyclage', text: 'Ammoniac, nitrites, nitrates : il te dit quand le bac peut accueillir ses poissons.' },
		{ icon: 'chat', color: 'var(--coral)', title: 'Un assistant qui connaît ton bac', text: 'Pose une question ou envoie une photo : il répond avec tes mesures sous les yeux.' }
	];
	const steps = [
		{ n: 1, title: 'Décris ton bac', text: 'Type d’eau, volume, date de mise en eau : les paramètres et leurs plages se préparent seuls.' },
		{ n: 2, title: 'Note une première mesure', text: 'Deux touches suffisent, les valeurs précédentes sont déjà là.' },
		{ n: 3, title: 'Laisse Biotope veiller', text: 'Tâches, rappels et alertes de dérive s’occupent du reste.' }
	];
	const PAGES = 5;

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

<svelte:head><title>Bienvenue · Biotope</title></svelte:head>

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
		<section class="flex w-full shrink-0 snap-center flex-col justify-center px-6 text-center">
			<Lagoon class="mb-9 h-[260px] w-full" />
			<h1 class="large-title rise">Bienvenue dans {APP_NAME}</h1>
			<p class="body rise mt-3 text-label2" style="animation-delay: 80ms">{APP_TAGLINE} Mesures, tâches et conseils, réunis dans une appli pensée pour ton iPhone.</p>
		</section>

		<!-- 2. Faisons connaissance -->
		<section class="flex w-full shrink-0 snap-center flex-col overflow-y-auto px-6 pb-4 pt-2">
			<h1 class="title1 text-center">Faisons connaissance</h1>
			<p class="subhead mb-5 mt-1.5 text-center text-label2">Quelques réponses pour que {APP_NAME} te ressemble. Tout se change plus tard dans Plus › Mon profil.</p>
			<ProfileForm bare />
		</section>

		<!-- 3. Ce que fait l'appli -->
		<section class="flex w-full shrink-0 snap-center flex-col justify-center px-8">
			<h1 class="title1 mb-8 text-center">Ce que {APP_NAME} fait pour toi</h1>
			<ul class="flex flex-col gap-6">
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

		<!-- 4. Rappels -->
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

		<!-- 5. Premier bac -->
		<section class="flex w-full shrink-0 snap-center flex-col justify-center px-8">
			<h1 class="title1 mb-8 text-center">Prêt en trois étapes</h1>
			<ol class="flex flex-col gap-6">
				{#each steps as st (st.n)}
					<li class="flex items-start gap-4">
						<span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-tint text-[17px] font-bold text-on-tint">{st.n}</span>
						<div>
							<p class="headline">{st.title}</p>
							<p class="subhead mt-0.5 text-label2">{st.text}</p>
						</div>
					</li>
				{/each}
			</ol>
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

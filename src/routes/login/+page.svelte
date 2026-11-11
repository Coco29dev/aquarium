<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import Mark from '$lib/art/Mark.svelte';
	import Loader from '$lib/art/Loader.svelte';

	let { form } = $props();

	// Arrivée sur la page de connexion = déconnecté : on ne garde pas les pages privées en cache.
	onMount(() => {
		if ('caches' in window) void caches.delete('pages');
	});
	let busy = $state(false);
</script>

<svelte:head>
	<title>Connexion · Biotope</title>
</svelte:head>

<main
	class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5"
	style="padding-top: calc(env(safe-area-inset-top) + 24px); padding-bottom: calc(env(safe-area-inset-bottom) + 24px)"
>
	<div class="mb-10 flex flex-col items-center text-center" style="animation: fade-in 500ms both">
		<span
			class="mb-5 block rounded-[22.5%] shadow-[0_10px_30px_rgb(6_50_63/0.35),0_1px_3px_rgb(0_0_0/0.12)]"
			style="animation: pop-in 520ms var(--ease-pop, cubic-bezier(0.3, 0.8, 0.3, 1.15)) both"
		>
			<Mark size={104} />
		</span>
		<h1 class="large-title">Biotope</h1>
		<p class="body mt-1.5 text-label2">Saisis ton mot de passe pour ouvrir tes bacs.</p>
	</div>

	<form
		method="POST"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update();
				busy = false;
			};
		}}
		class="flex flex-col"
	>
		<ul class="group">
			<li>
				<label class="flex min-h-12 items-center gap-3 px-4">
					<span class="body shrink-0">Mot de passe</span>
					<input
						type="password"
						name="password"
						autocomplete="current-password"
						required
						placeholder="Requis"
						class="body min-w-0 flex-1 bg-transparent text-right outline-none placeholder:text-label2"
					/>
				</label>
			</li>
		</ul>
		{#if form?.error}
			<p class="footnote mt-2 px-4 text-red" role="alert">{form.error}</p>
		{/if}
		<button class="btn-filled mt-6 w-full" disabled={busy}>
			{#if busy}
				<span class="inline-flex" style="--loader-ink: var(--on-tint)"><Loader size={20} spinning /></span>
				Connexion…
			{:else}
				Se connecter
			{/if}
		</button>
	</form>
</main>

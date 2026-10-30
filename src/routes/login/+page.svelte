<script lang="ts">
	import { enhance } from '$app/forms';
	import Logo from '$lib/components/Logo.svelte';

	let { form } = $props();
	let busy = $state(false);
</script>

<svelte:head>
	<title>Connexion · Bulle</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
	<div class="rise relative mb-10">
		<div class="mb-6 grid h-28 w-28 place-items-center rounded-[1.75rem] border-2 border-edge bg-t-douce shadow-[5px_5px_0_var(--shadow)]">
			<Logo size={84} />
		</div>
		<h1 class="display text-[4rem]">bulle</h1>
		<p class="hand mt-2 text-xl leading-snug text-muted">Le carnet de tes bacs. Les mesures, les tâches, et ce qui dérive.</p>
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
		class="card rise flex flex-col gap-4 p-5"
		style="animation-delay: 60ms"
	>
		<label class="flex flex-col gap-2 text-sm font-bold">
			Mot de passe
			<input type="password" name="password" autocomplete="current-password" required class="field" />
		</label>
		{#if form?.error}
			<p class="rounded-lg border-2 border-bad bg-bad-soft px-3 py-2 text-sm font-bold text-bad" role="alert">{form.error}</p>
		{/if}
		<button class="btn" disabled={busy}>{busy ? 'Ouverture…' : 'Ouvrir le carnet'}</button>
	</form>
</main>

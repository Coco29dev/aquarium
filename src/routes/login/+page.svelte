<script lang="ts">
	import { enhance } from '$app/forms';
	import Logo from '$lib/components/Logo.svelte';

	let { form } = $props();
</script>

<svelte:head>
	<title>Connexion · Bulle</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
	<h1 class="flex items-center gap-3 text-4xl"><Logo size={56} />bulle</h1>
	<form method="POST" use:enhance class="flex flex-col gap-4">
		<label class="flex flex-col gap-2 text-sm">
			Mot de passe
			<input
				type="password"
				name="password"
				autocomplete="current-password"
				required
				class="rounded-lg border-2 border-edge bg-surface px-4 py-3 text-base"
			/>
		</label>
		{#if form?.error}
			<p class="text-sm text-bad" role="alert">{form.error}</p>
		{/if}
		<button class="rounded-lg btn-primary px-4 py-3 font-medium">Se connecter</button>
	</form>
</main>

<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<svelte:head>
	<title>Connexion · Aquarium</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
	<h1 class="text-2xl font-semibold">Aquarium</h1>
	<form method="POST" use:enhance class="flex flex-col gap-4">
		<label class="flex flex-col gap-2 text-sm">
			Mot de passe
			<input
				type="password"
				name="password"
				autocomplete="current-password"
				required
				class="rounded-lg border border-cyan-900 bg-slate-900 px-4 py-3 text-base"
			/>
		</label>
		{#if form?.error}
			<p class="text-sm text-red-400" role="alert">{form.error}</p>
		{/if}
		<button class="rounded-lg bg-cyan-700 px-4 py-3 font-medium active:bg-cyan-800">Se connecter</button>
	</form>
</main>

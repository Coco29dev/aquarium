<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { TASK_KINDS } from '$lib/templates';

	const id = $derived(Number(page.params.id));
	const view = $derived(store.view);
	const aquarium = $derived(view?.aquariums.find((a) => a.id === id));
	const parameters = $derived((view?.parameters ?? []).filter((p) => p.aquariumId === id));
	const tasks = $derived((view?.tasks ?? []).filter((t) => t.aquariumId === id));

	let message = $state('');

	async function run(action: () => Promise<unknown>) {
		message = '';
		try {
			await action();
		} catch (error) {
			message = (error as Error).message;
		}
	}

	const num = (value: string): number | null => (value.trim() === '' ? null : Number(value.replace(',', '.')));

	// --- Aquarium
	async function saveAquarium(event: SubmitEvent) {
		event.preventDefault();
		const form = new FormData(event.currentTarget as HTMLFormElement);
		await run(() =>
			store.mutate('PATCH', `/api/aquariums/${id}`, {
				name: form.get('name'),
				volumeL: num(String(form.get('volumeL'))),
				startedOn: String(form.get('startedOn')) || null
			})
		);
	}

	async function removeAquarium() {
		if (!confirm('Supprimer cet aquarium et toutes ses mesures ? Pense à exporter avant.')) return;
		await run(async () => {
			await store.mutate('DELETE', `/api/aquariums/${id}`);
			await goto('/aquariums');
		});
	}

	// --- Paramètres
	async function saveParameter(event: SubmitEvent, parameterId: number) {
		event.preventDefault();
		const f = new FormData(event.currentTarget as HTMLFormElement);
		await run(() =>
			store.mutate('PATCH', `/api/parameters/${parameterId}`, {
				name: f.get('name'),
				unit: f.get('unit'),
				min: num(String(f.get('min'))),
				max: num(String(f.get('max'))),
				driftPerWeek: num(String(f.get('driftPerWeek')))
			})
		);
	}

	async function removeParameter(parameterId: number, name: string) {
		if (!confirm(`Supprimer « ${name} » et ses mesures ?`)) return;
		await run(() => store.mutate('DELETE', `/api/parameters/${parameterId}`));
	}

	async function addParameter(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		const f = new FormData(form);
		await run(async () => {
			await store.mutate('POST', `/api/aquariums/${id}/parameters`, {
				name: f.get('name'),
				unit: f.get('unit'),
				min: num(String(f.get('min'))),
				max: num(String(f.get('max'))),
				driftPerWeek: num(String(f.get('driftPerWeek')))
			});
			form.reset();
		});
	}

	// --- Tâches
	async function addTask(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		const f = new FormData(form);
		await run(async () => {
			await store.mutate('POST', `/api/aquariums/${id}/tasks`, {
				title: f.get('title'),
				kind: f.get('kind'),
				everyDays: Number(f.get('everyDays'))
			});
			form.reset();
		});
	}

	async function saveTask(event: SubmitEvent, taskId: number) {
		event.preventDefault();
		const f = new FormData(event.currentTarget as HTMLFormElement);
		await run(() =>
			store.mutate('PATCH', `/api/tasks/${taskId}`, {
				title: f.get('title'),
				everyDays: Number(f.get('everyDays')),
				nextDue: f.get('nextDue') || undefined,
				active: f.get('active') === 'on'
			})
		);
	}

	async function removeTask(taskId: number, title: string) {
		if (!confirm(`Supprimer la tâche « ${title} » ?`)) return;
		await run(() => store.mutate('DELETE', `/api/tasks/${taskId}`));
	}

	const field = 'rounded-lg border-2 border-edge bg-surface px-3 py-2 text-base';
	const small = 'w-full rounded-lg border-2 border-edge bg-surface px-2 py-2 text-sm';
	const button = 'rounded-lg btn-primary px-4 py-2 text-sm font-medium';
</script>

<svelte:head><title>Réglages · {aquarium?.name ?? 'Aquarium'}</title></svelte:head>

{#if !aquarium}
	<p class="text-sm text-muted">Aquarium introuvable.</p>
{:else}
	<a href="/aquariums/{id}" class="text-sm text-primary underline">← {aquarium.name}</a>
	<h1 class="mb-6 mt-2 text-2xl font-semibold">Réglages</h1>

	{#if message}<p class="mb-4 rounded-lg bg-bad-soft p-3 text-sm text-bad" role="alert">{message}</p>{/if}

	<section class="mb-8">
		<h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-muted">Aquarium</h2>
		<form onsubmit={saveAquarium} class="flex flex-col gap-3">
			<input name="name" value={aquarium.name} required class={field} aria-label="Nom" />
			<div class="flex gap-3">
				<input name="volumeL" value={aquarium.volumeL ?? ''} inputmode="decimal" placeholder="Volume (L)" class="{field} w-full" aria-label="Volume en litres" />
				<input name="startedOn" type="date" value={aquarium.startedOn ?? ''} class="{field} w-full" aria-label="Mise en eau" />
			</div>
			<button class={button}>Enregistrer</button>
		</form>
	</section>

	<section class="mb-8">
		<h2 class="mb-1 text-sm font-medium uppercase tracking-wide text-muted">Paramètres</h2>
		<p class="mb-3 text-xs text-muted">
			Plage acceptable et dérive maximale sur 7 jours (laisse vide : 25 % de la plage).
		</p>
		<ul class="flex flex-col gap-3">
			{#each parameters as p (p.id)}
				<li>
					<form onsubmit={(e) => saveParameter(e, p.id)} class="grid grid-cols-6 gap-2 card p-3">
						<input name="name" value={p.name} required class="{small} col-span-4" aria-label="Nom" />
						<input name="unit" value={p.unit} class="{small} col-span-2" aria-label="Unité" />
						<label class="col-span-2 text-xs text-muted">Min<input name="min" value={p.min ?? ''} inputmode="decimal" class={small} /></label>
						<label class="col-span-2 text-xs text-muted">Max<input name="max" value={p.max ?? ''} inputmode="decimal" class={small} /></label>
						<label class="col-span-2 text-xs text-muted">Dérive/7 j<input name="driftPerWeek" value={p.driftPerWeek ?? ''} inputmode="decimal" class={small} /></label>
						<button class="{button} col-span-3">Enregistrer</button>
						<button type="button" onclick={() => removeParameter(p.id, p.name)} class="col-span-3 rounded-lg border border-bad px-4 py-2 text-sm text-bad">Supprimer</button>
					</form>
				</li>
			{/each}
		</ul>
		<form onsubmit={addParameter} class="mt-3 grid grid-cols-6 gap-2 rounded-lg border-2 border-dashed border-edge p-3">
			<input name="name" required placeholder="Nouveau paramètre" class="{small} col-span-4" />
			<input name="unit" placeholder="Unité" class="{small} col-span-2" />
			<input name="min" inputmode="decimal" placeholder="Min" class="{small} col-span-2" />
			<input name="max" inputmode="decimal" placeholder="Max" class="{small} col-span-2" />
			<input name="driftPerWeek" inputmode="decimal" placeholder="Dérive/7 j" class="{small} col-span-2" />
			<button class="{button} col-span-6">Ajouter</button>
		</form>
	</section>

	<section class="mb-8">
		<h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-muted">Tâches récurrentes</h2>
		<ul class="flex flex-col gap-3">
			{#each tasks as t (t.id)}
				<li>
					<form onsubmit={(e) => saveTask(e, t.id)} class="grid grid-cols-6 gap-2 card p-3">
						<input name="title" value={t.title} required class="{small} col-span-6" aria-label="Titre" />
						<label class="col-span-2 text-xs text-muted">Tous les (j)<input name="everyDays" type="number" min="1" max="365" value={t.everyDays} class={small} /></label>
						<label class="col-span-3 text-xs text-muted">Prochaine<input name="nextDue" type="date" value={t.nextDue} class={small} /></label>
						<label class="col-span-1 flex flex-col items-center text-xs text-muted">Actif<input name="active" type="checkbox" checked={t.active} class="mt-2 h-5 w-5 accent-primary" /></label>
						<button class="{button} col-span-3">Enregistrer</button>
						<button type="button" onclick={() => removeTask(t.id, t.title)} class="col-span-3 rounded-lg border border-bad px-4 py-2 text-sm text-bad">Supprimer</button>
					</form>
				</li>
			{/each}
		</ul>
		<form onsubmit={addTask} class="mt-3 grid grid-cols-6 gap-2 rounded-lg border-2 border-dashed border-edge p-3">
			<input name="title" required placeholder="Nouvelle tâche" class="{small} col-span-6" />
			<select name="kind" class="{small} col-span-4" onchange={(e) => {
				const kind = TASK_KINDS.find((k) => k.value === e.currentTarget.value);
				const days = e.currentTarget.form?.elements.namedItem('everyDays') as HTMLInputElement | null;
				if (kind && days) days.value = String(kind.everyDays);
			}}>
				{#each TASK_KINDS as kind (kind.value)}<option value={kind.value}>{kind.label}</option>{/each}
			</select>
			<input name="everyDays" type="number" min="1" max="365" value="7" class="{small} col-span-2" aria-label="Fréquence en jours" />
			<button class="{button} col-span-6">Ajouter</button>
		</form>
	</section>

	<button onclick={removeAquarium} class="w-full rounded-lg border border-bad px-4 py-3 text-sm text-bad">
		Supprimer cet aquarium
	</button>
{/if}

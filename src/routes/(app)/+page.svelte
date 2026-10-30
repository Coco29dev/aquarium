<script lang="ts">
	import { store } from '$lib/client/store.svelte';
	import { collectAlerts } from '$lib/domain/drift';
	import { cyclingForAquarium } from '$lib/domain/cycling';
	import { daysBetween, dayInParis } from '$lib/domain/dates';
	import { dueTasks } from '$lib/domain/tasks';
	import { consumableLife } from '$lib/domain/consumables';

	const view = $derived(store.view);
	const today = dayInParis();
	const due = $derived(view ? dueTasks(view.tasks) : []);
	const alerts = $derived(view ? collectAlerts(view.parameters, view.measurements) : []);

	const consumablesDue = $derived(
		(view?.consumables ?? [])
			.map((c) => ({ c, life: consumableLife(c, c.history, today) }))
			.filter((x) => x.life.status === 'en_retard' || x.life.status === 'bientot')
			.sort((a, b) => (a.life.daysLeft ?? 0) - (b.life.daysLeft ?? 0))
	);

	const nameOf = (id: number) => view?.aquariums.find((a) => a.id === id)?.name ?? '';

	// Coach affiché tant que le cyclage n'est pas terminé, sur les bacs récents.
	const coaches = $derived(
		(view?.aquariums ?? [])
			.filter((a) => !a.startedOn || daysBetween(a.startedOn, today) <= 90)
			.map((a) => ({
				aquarium: a,
				status: cyclingForAquarium(
					view!.parameters.filter((p) => p.aquariumId === a.id),
					view!.measurements.filter((m) => m.aquariumId === a.id)
				)
			}))
			.filter((c) => c.status && c.status.stage !== 'pret' && c.status.stage !== 'aucune_mesure')
	);

	function late(nextDue: string): string {
		const days = daysBetween(nextDue, today);
		return days > 0 ? `en retard de ${days} j` : "aujourd'hui";
	}
</script>

<svelte:head><title>Aujourd'hui · Aquarium</title></svelte:head>

<h1 class="mb-6 text-2xl font-semibold">À faire aujourd'hui</h1>

{#if view && view.aquariums.length === 0}
	<p class="rounded-lg bg-slate-900 p-4 text-sm">
		Aucun aquarium pour l'instant. <a href="/aquariums/nouveau" class="text-cyan-300 underline">Créer le premier</a>.
	</p>
{:else}
	<section class="mb-8">
		<h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">Tâches</h2>
		{#if due.length === 0}
			<p class="text-sm text-slate-400">Rien à faire. 🎉</p>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each due as task (task.id)}
					<li class="flex items-center gap-3 rounded-lg bg-slate-900 p-3">
						<button
							onclick={() => store.completeTask(task.id)}
							class="h-9 w-9 shrink-0 rounded-full border-2 border-cyan-600 active:bg-cyan-700"
							aria-label="Marquer « {task.title} » comme fait"
						></button>
						<div class="min-w-0 flex-1">
							<p class="truncate">{task.title}</p>
							<p class="text-xs text-slate-400">{nameOf(task.aquariumId)} · {late(task.nextDue)}</p>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if consumablesDue.length}
		<section class="mb-8">
			<h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">Consommables</h2>
			<ul class="flex flex-col gap-2">
				{#each consumablesDue as { c, life } (c.id)}
					<li class="rounded-lg bg-slate-900 p-3 text-sm">
						<a href="/aquariums/{c.aquariumId}/inventaire" class="block">
							<p>{c.name}</p>
							<p class="text-xs {life.status === 'en_retard' ? 'text-red-300' : 'text-amber-300'}">
								{nameOf(c.aquariumId)} · {life.daysLeft! < 0 ? `à remplacer, en retard de ${-life.daysLeft!} j` : `à remplacer dans ${life.daysLeft} j`}
							</p>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section class="mb-8">
		<h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">Alertes</h2>
		{#if alerts.length === 0}
			<p class="text-sm text-slate-400">Aucune alerte.</p>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each alerts as alert (alert.parameterId)}
					<li class="rounded-lg p-3 text-sm {alert.level === 'hors_plage' ? 'bg-red-950 text-red-100' : 'bg-amber-950 text-amber-100'}">
						<a href="/aquariums/{alert.aquariumId}" class="block">
							<span class="text-xs opacity-70">{nameOf(alert.aquariumId)} · {alert.level === 'hors_plage' ? 'hors plage' : 'dérive'}</span>
							<br />{alert.message}
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#each coaches as { aquarium, status } (aquarium.id)}
		<section class="mb-8 rounded-lg border border-cyan-900 p-4">
			<p class="text-xs text-slate-400">{aquarium.name}</p>
			<h2 class="font-medium">{status?.title}</h2>
			<p class="mt-1 text-sm text-slate-300">{status?.advice}</p>
		</section>
	{/each}
{/if}

<script lang="ts">
	import Icon from './Icon.svelte';
	import { SHORT_WATER, TANK_TONE, fmt, tankAge } from '$lib/ui';
	import { HEALTH_STYLE, type TankHealth } from '$lib/tank';
	import type { Aquarium } from '$lib/types';

	// Carte d'un bac : aplat de sa couleur de feutre, nom en grand, état et repères.
	interface Props {
		aquarium: Aquarium;
		health: TankHealth;
		compact?: boolean;
	}
	let { aquarium, health, compact = false }: Props = $props();

	const age = $derived(tankAge(aquarium));
	const dot = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', cycle: 'bg-ink' } as const;
</script>

<a
	href="/aquariums/{aquarium.id}"
	class="card press relative flex flex-col overflow-hidden {compact ? 'w-60 shrink-0' : 'w-full'}"
	style="view-transition-name: tank-{aquarium.id}"
>
	<div class="relative border-b-2 border-edge px-4 pb-3 pt-3.5" style="background: {TANK_TONE[aquarium.waterType]}">
		<p class="num text-[11px] uppercase tracking-wider">
			{SHORT_WATER[aquarium.waterType]}{aquarium.volumeL ? ` · ${fmt(aquarium.volumeL, 0)} L` : ''}
		</p>
		<h3 class="display mt-1 truncate {compact ? 'text-2xl' : 'text-3xl'}">{aquarium.name}</h3>
		<svg class="absolute right-3 top-3 opacity-60" width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
			<circle cx="24" cy="10" r="6" fill="none" stroke="var(--ink)" stroke-width="2" />
			<circle cx="12" cy="22" r="3.5" fill="none" stroke="var(--ink)" stroke-width="2" />
			<circle cx="24" cy="28" r="2" fill="var(--ink)" />
		</svg>
	</div>
	<div class="flex flex-col gap-2 px-4 py-3">
		<p class="flex items-center gap-2 text-sm font-bold {HEALTH_STYLE[health.level]}">
			<span class="h-2.5 w-2.5 rounded-full border border-edge {dot[health.level]}"></span>
			{health.label}
		</p>
		<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
			{#if health.coach && age != null}
				<span class="flex items-center gap-1"><Icon name="cycle" size={14} />Jour {age}</span>
			{/if}
			{#if health.waterDays != null}
				<span class="flex items-center gap-1"><Icon name="drop" size={14} />Eau changée {health.waterDays === 0 ? "aujourd'hui" : `il y a ${health.waterDays} j`}</span>
			{/if}
			{#if health.due.length}
				<span class="flex items-center gap-1 font-bold text-ink"><Icon name="calendar" size={14} />{health.due.length} à faire</span>
			{/if}
		</div>
	</div>
</a>

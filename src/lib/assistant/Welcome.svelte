<script lang="ts">
	import EmptyChat from '$lib/art/EmptyChat.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import { threadLabel, threadWhen, type PromptSuggestion, type SuggestionIcon, type ThreadSummary } from '$lib/domain/assistant';
	import type { HealthLevel } from '$lib/tank';
	import type { Aquarium } from '$lib/types';
	import { WATER_TYPE_LABELS } from '$lib/types';

	/**
	 * Accueil d'une conversation vide : la vignette de la marque, une salutation, ce que l'assistant sait du bac,
	 * trois questions tirées de l'état du bac (alerte, cyclage, tâches…) et les conversations à reprendre.
	 * Tout se touche : une proposition envoie la question, la photo ouvre la photothèque, une conversation
	 * s'ouvre à sa place.
	 */
	interface Props {
		tank: Aquarium;
		hello: string;
		health: { label: string; level: HealthLevel } | null;
		suggestions: PromptSuggestion[];
		recents: ThreadSummary[];
		total: number;
		onask: (prompt: string) => void;
		onphoto: () => void;
		onresume: (id: number) => void;
		onall: () => void;
	}
	let { tank, hello, health, suggestions, recents, total, onask, onphoto, onresume, onall }: Props = $props();

	const COLORS: Record<SuggestionIcon, string> = {
		alert: 'var(--orange)',
		cycle: 'var(--teal)',
		today: 'var(--tint)',
		flask: 'var(--purple)',
		chart: 'var(--blue)',
		bacs: 'var(--tint)'
	};
	const DOT: Record<HealthLevel, string> = { ok: 'var(--green)', warn: 'var(--orange)', bad: 'var(--red)', cycle: 'var(--teal)', projet: 'var(--gray)' };
	const facts = $derived([WATER_TYPE_LABELS[tank.waterType], tank.volumeL ? `${tank.volumeL.toLocaleString('fr-FR')} L` : null].filter(Boolean).join(' · '));
</script>

<div class="rise mx-auto w-full max-w-sm pt-2 text-center">
	<EmptyChat variant={tank.waterType} class="mx-auto w-full max-w-[14rem]" />
	<h2 class="title2 mt-1">{hello}</h2>
	<p class="subhead mx-auto mt-1 max-w-[19rem] text-label2">Je connais les mesures, les habitants et les tâches de ton bac. Pose-moi une question ou envoie-moi une photo.</p>

	<!-- Ce que l'assistant a sous les yeux : l'état du bac du moment, sur deux lignes qui ne se coupent pas. -->
	<div class="mx-auto mt-3 inline-flex max-w-full flex-col items-center rounded-[18px] bg-fill3 px-4 py-2" aria-label="État du bac">
		<p class="footnote flex items-center gap-2 font-semibold">
			{#if health}<span class="h-2 w-2 shrink-0 rounded-full" style="background: {DOT[health.level]}" aria-hidden="true"></span>{/if}
			{health ? health.label : tank.name}
		</p>
		{#if facts}<p class="caption1 text-label2">{facts}</p>{/if}
	</div>
</div>

<div class="mx-auto mt-6 w-full max-w-sm text-left">
	<Section header="Pour commencer" class="!mb-6">
		{#each suggestions as s (s.label)}
			<Row icon={s.icon} iconColor={COLORS[s.icon]} title={s.label} onclick={() => onask(s.prompt)} chevron />
		{/each}
		<Row icon="photo" iconColor="var(--pink)" title="Analyser une photo" subtitle="Plante, poisson, test, matériel…" onclick={onphoto} chevron />
	</Section>

	{#if recents.length}
		<Section header="Reprendre" class="!mb-4">
			{#each recents as t (t.id)}
				<Row icon="chat" iconColor="var(--indigo)" title={threadLabel(t)} value={threadWhen(t.updatedAt)} onclick={() => onresume(t.id)} chevron />
			{/each}
			{#if total > recents.length}
				<Row action title="Toutes les conversations ({total})" onclick={onall} chevron />
			{/if}
		</Section>
	{/if}
</div>

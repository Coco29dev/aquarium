<script lang="ts">
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import { journeyProgress, type JourneyStep } from '$lib/domain/journey';
	import { stageOf } from '$lib/tank';
	import type { Aquarium } from '$lib/types';

	/**
	 * Carte « Parcours » façon Fitness : anneau de progression, prochaine étape en gras avec son
	 * action en capsule, puis toutes les étapes en liste dépliable avec coches vertes.
	 * `compact` : une seule ligne avec chevron, la liste se déplie au toucher.
	 * Sans `onaction`, l'action navigue : un lien qui commence par « ? » s'applique à la fiche du bac
	 * (ex. `?etape=mise-en-eau` → /aquariums/<id>?etape=mise-en-eau), les autres sont suivis tels quels.
	 */
	interface Props {
		aquarium: Pick<Aquarium, 'id' | 'stage'>;
		steps: JourneyStep[];
		compact?: boolean;
		onaction?: (step: JourneyStep) => void;
		/** Liste dépliée au départ (défaut : repliée). */
		open?: boolean;
	}
	let { aquarium, steps, compact = false, onaction, open = false }: Props = $props();

	// Valeur initiale seulement : l'utilisateur déplie ensuite à la main.
	// svelte-ignore state_referenced_locally
	let expanded = $state(open);

	const progress = $derived(journeyProgress(steps));
	const complete = $derived(progress.total > 0 && progress.done === progress.total);
	const ratio = $derived(progress.total ? progress.done / progress.total : 0);
	const stage = $derived(stageOf(aquarium));

	const TITLES = { projet: 'Ton projet', cyclage: 'Mise en route du bac', actif: 'Vie du bac' } as const;
	const TONES = { projet: 'var(--orange)', cyclage: 'var(--indigo)', actif: 'var(--green)' } as const;
	const tone = $derived(TONES[stage]);

	// Anneau : rayon 15 dans un cadre de 36, trait de 5.
	const R = 15;
	const C = 2 * Math.PI * R;

	function run(step: JourneyStep) {
		if (!step.action) return;
		if (onaction) return onaction(step);
		const href = step.action.href;
		void goto(href.startsWith('?') ? `/aquariums/${aquarium.id}${href}` : href);
	}
</script>

{#snippet ring(size: number)}
	<svg width={size} height={size} viewBox="0 0 36 36" class="shrink-0 -rotate-90" aria-hidden="true">
		<circle cx="18" cy="18" r={R} fill="none" stroke="var(--fill)" stroke-width="5" />
		<circle
			cx="18"
			cy="18"
			r={R}
			fill="none"
			stroke={tone}
			stroke-width="5"
			stroke-linecap="round"
			stroke-dasharray="{C * ratio} {C}"
			style="transition: stroke-dasharray 600ms cubic-bezier(0.3, 0.8, 0.3, 1)"
		/>
	</svg>
{/snippet}

{#snippet list(hideCurrentExtras: boolean)}
	<ol class="mt-3 flex flex-col">
		{#each steps as step, i (step.id)}
			<li class="flex gap-3">
				<div class="flex flex-col items-center">
					<span
						class="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 {step.status === 'done' ? 'border-green bg-green text-white' : step.status === 'current' ? 'bg-transparent' : 'border-label4'}"
						style={step.status === 'current' ? `border-color: ${tone}` : ''}
					>
						{#if step.status === 'done'}
							<Icon name="check" size={13} weight={3.2} />
						{:else if step.status === 'current'}
							<span class="h-2 w-2 rounded-full" style="background: {tone}"></span>
						{/if}
					</span>
					{#if i < steps.length - 1}<span class="my-0.5 w-0.5 flex-1 rounded-full bg-fill"></span>{/if}
				</div>
				<div class="min-w-0 flex-1 pb-3.5">
					<p class="subhead {step.status === 'done' ? 'text-label2' : step.status === 'todo' ? 'text-label2' : 'font-semibold'}">{step.title}</p>
					{#if step.detail && step.status !== 'done' && !(hideCurrentExtras && step.status === 'current')}<p class="footnote text-label2">{step.detail}</p>{/if}
					{#if step.action && step.status !== 'done' && !(hideCurrentExtras && step.status === 'current')}
						<button type="button" class="btn-plain footnote mt-0.5 font-semibold" onclick={() => run(step)}>{step.action.label}</button>
					{/if}
				</div>
			</li>
		{/each}
	</ol>
{/snippet}

<section class="group p-4" aria-label="Parcours du bac">
	{#if compact}
		<button type="button" class="flex w-full items-center gap-3 text-left" onclick={() => (expanded = !expanded)} aria-expanded={expanded}>
			{@render ring(36)}
			<span class="min-w-0 flex-1">
				<span class="subhead block font-semibold">{TITLES[stage]}</span>
				<span class="footnote block truncate text-label2">
					{#if complete}Toutes les étapes sont faites{:else if progress.next}{progress.next.title}{:else}{progress.done} sur {progress.total}{/if}
				</span>
			</span>
			<span class="text-label3 transition-transform duration-200 {expanded ? 'rotate-90' : ''}"><Icon name="next" size={16} weight={2.4} /></span>
		</button>
		{#if expanded}{@render list(false)}{/if}
	{:else}
		<div class="flex items-center gap-3">
			{@render ring(52)}
			<div class="min-w-0 flex-1">
				<p class="footnote font-semibold uppercase" style="color: {tone}">{TITLES[stage]}</p>
				<p class="rounded-num subhead text-label2">{progress.done} étape{progress.done > 1 ? 's' : ''} sur {progress.total}</p>
			</div>
		</div>
		{#if complete}
			<p class="headline mt-3 flex items-center gap-1.5 text-green"><Icon name="check" size={18} weight={2.8} />Tout est en place</p>
		{:else if progress.next}
			<p class="headline mt-3">{progress.next.title}</p>
			{#if progress.next.detail}<p class="subhead mt-0.5 text-label2">{progress.next.detail}</p>{/if}
			{#if progress.next.action}
				<button type="button" class="btn-filled mt-3 min-h-11 px-5 text-[15px]" style="background: {tone}" onclick={() => run(progress.next!)}>
					{progress.next.action.label}
				</button>
			{/if}
		{/if}
		<button type="button" class="btn-plain subhead mt-3 flex w-full items-center gap-1 font-semibold" onclick={() => (expanded = !expanded)} aria-expanded={expanded}>
			{expanded ? 'Masquer les étapes' : 'Voir toutes les étapes'}
			<span class="transition-transform duration-200 {expanded ? '-rotate-90' : 'rotate-90'}"><Icon name="next" size={14} weight={2.6} /></span>
		</button>
		{#if expanded}{@render list(true)}{/if}
	{/if}
</section>

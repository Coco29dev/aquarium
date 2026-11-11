<script lang="ts">
	import type { Snippet } from 'svelte';
	import EmptyTank from './EmptyTank.svelte';
	import EmptyTasks from './EmptyTasks.svelte';
	import EmptyMeasures from './EmptyMeasures.svelte';
	import EmptyLiving from './EmptyLiving.svelte';
	import Offline from './Offline.svelte';
	import type { WaterVariant } from './fish';

	/**
	 * État vide illustré : une vignette, un titre, une phrase, des actions. Une seule ligne à poser dans un écran.
	 * Props :
	 *  - art : 'bac' (aucun bac) | 'taches' (rien à faire) | 'mesures' (aucune mesure) | 'habitants' (aucun
	 *    habitant) | 'hors-ligne' (sans connexion ou erreur) ;
	 *  - variant : type d'eau du bac concerné ('douce' | 'plantee' | 'mer' | 'recif'), teinte et décor de la vignette ;
	 *  - title : titre (h2 par défaut, `level` le change) ; text : phrase d'explication, jamais dans l'image ;
	 *  - actions : snippet de boutons (.btn-filled, .btn-plain) ;
	 *  - compact : vignette plus petite, pour un état vide dans une carte ou une feuille ;
	 *  - class.
	 * L'illustration est décorative (aria-hidden) : titre et texte portent toute l'information.
	 *
	 *   <EmptyState art="mesures" variant={aquarium.waterType} title="Aucune mesure" text="Saisis la première…">
	 *     {#snippet actions()}<a class="btn-filled" href="/mesurer">Saisir une mesure</a>{/snippet}
	 *   </EmptyState>
	 */
	interface Props {
		art: 'bac' | 'taches' | 'mesures' | 'habitants' | 'hors-ligne';
		variant?: WaterVariant;
		title: string;
		text?: string;
		actions?: Snippet;
		compact?: boolean;
		level?: 2 | 3;
		class?: string;
	}
	let { art, variant = 'douce', title, text, actions, compact = false, level = 2, class: cls = '' }: Props = $props();
</script>

<div class="mx-auto flex w-full max-w-sm flex-col items-center px-6 text-center {cls}">
	<div class="rise mb-4 w-full {compact ? 'max-w-[10.5rem]' : 'max-w-[17rem]'}">
		{#if art === 'bac'}
			<EmptyTank {variant} />
		{:else if art === 'taches'}
			<EmptyTasks {variant} />
		{:else if art === 'mesures'}
			<EmptyMeasures {variant} />
		{:else if art === 'habitants'}
			<EmptyLiving {variant} />
		{:else}
			<Offline />
		{/if}
	</div>
	<svelte:element this={level === 3 ? 'h3' : 'h2'} class={compact ? 'title3' : 'title2'}>{title}</svelte:element>
	{#if text}<p class="subhead mt-1.5 text-label2">{text}</p>{/if}
	{#if actions}<div class="mt-5 flex flex-col items-center gap-2">{@render actions()}</div>{/if}
</div>

<script lang="ts">
	import Mark from '$lib/art/Mark.svelte';

	/**
	 * Visage de l'assistant : le poisson de la marque sur sa pastille lagon. Posé à gauche de ses réponses
	 * (28 px) et dans l'en-tête. Décor : aria-hidden ; `busy` fait respirer la pastille pendant qu'il répond
	 * (un souffle d'opacité en « Réduire les animations », classe .busy de layout.css).
	 */
	let { size = 28, busy = false, class: cls = '' }: { size?: number; busy?: boolean; class?: string } = $props();
</script>

<span class="grid shrink-0 place-items-center {busy ? 'busy breathe' : ''} {cls}" style="width: {size}px; height: {size}px" aria-hidden="true">
	<Mark {size} />
</span>

<style>
	.breathe {
		animation: breathe 1.8s ease-in-out infinite;
	}
	@keyframes breathe {
		50% {
			transform: scale(0.92);
		}
	}
</style>

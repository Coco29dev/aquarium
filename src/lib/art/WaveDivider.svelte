<script lang="ts">
	import { ambient } from '$lib/motion/ambient';

	/**
	 * Séparateur de section : un fil d'eau qui ondule très lentement entre deux blocs.
	 * Props : class. Couleur : celle du texte quaternaire ; les bords s'effacent.
	 * Mouvement coupé par .ambient (mouvement réduit, réglage « Ambiance animée », hors écran).
	 * Sert : entre les sections de l'accueil et de l'onboarding. Décor : aria-hidden.
	 */
	let { class: cls = '' }: { class?: string } = $props();
	const uid = $props.id();
</script>

<div class="wave {cls}" use:ambient aria-hidden="true">
	<svg width="100%" height="12">
		<defs>
			<pattern id="{uid}-p" width="60" height="12" patternUnits="userSpaceOnUse">
				<path d="M0 6C10 0 20 0 30 6S50 12 60 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
			</pattern>
		</defs>
		<rect class="ambient drift" x="-60" width="120%" height="12" fill="url(#{uid}-p)" />
	</svg>
</div>

<style>
	.wave {
		color: var(--label4, rgb(60 60 67 / 0.18));
		-webkit-mask-image: linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent);
		mask-image: linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent);
	}
	svg {
		display: block;
	}
	.drift {
		animation: drift 14s linear infinite;
	}
	@keyframes drift {
		to {
			transform: translateX(60px);
		}
	}
</style>

<script lang="ts">
	import { ambient } from '$lib/motion/ambient';
	import { WATER, type WaterVariant } from './fish';

	/**
	 * « Aucune mesure » : un tube à essai gradué posé sur son support, à moitié plein d'eau, et une
	 * goutte qui se forme au bout d'une pipette, tombe, puis fait une onde. Derrière, un graphique encore
	 * vide : grille et ligne pointillées.
	 * Props : variant ('douce' par défaut | 'plantee' | 'mer' | 'recif' : teinte de l'eau), class.
	 * Sert : onglet Mesures d'un bac, graphique sans donnée (via EmptyState art="mesures").
	 * Décor : aria-hidden ; le texte qui l'accompagne invite à saisir la première mesure.
	 */
	let { variant = 'douce', class: cls = '' }: { variant?: WaterVariant; class?: string } = $props();
	const uid = $props.id();
	const water = $derived(WATER[variant]);
</script>

<div class="block {cls}" use:ambient aria-hidden="true">
	<svg viewBox="0 0 240 184" class="block h-auto w-full">
		<defs>
			<clipPath id="{uid}-tube"><path d="M101.5 24V126a18.5 18.5 0 0 0 37 0V24z" /></clipPath>
			<linearGradient id="{uid}-water" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color={water} stop-opacity=".7" />
				<stop offset="1" stop-color={water} stop-opacity=".4" />
			</linearGradient>
		</defs>

		<!-- graphique encore vide : grille et courbe pointillées, derrière le tube -->
		<g fill="none" stroke="var(--label4, rgb(60 60 67 / .18))" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="0.1 6">
			<path d="M24 56H216M24 86H216M24 116H216" />
		</g>
		<path d="M24 126C48 108 66 132 92 114S150 92 168 108 200 100 216 90" fill="none" stroke="var(--label3, rgb(60 60 67 / .3))" stroke-width="3" stroke-linecap="round" stroke-dasharray="0.1 7" />
		<path d="M24 38V150H216" fill="none" stroke="var(--label3, rgb(60 60 67 / .3))" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />

		<!-- support et ombre -->
		<ellipse cx="120" cy="168" rx="52" ry="5" fill="var(--art-shadow, rgb(6 50 63 / .14))" />
		<rect x="86" y="148" width="68" height="14" rx="7" fill="var(--bg2, #fff)" stroke="var(--art-glass, rgb(60 60 67 / .26))" stroke-width="2" />

		<!-- eau dans le tube -->
		<g clip-path="url(#{uid}-tube)">
			<rect x="95" y="20" width="50" height="150" fill="var(--bg2, #fff)" fill-opacity=".92" />
			<path d="M95 98c8-3.500 17-3.500 25 0s17 3.500 25 0V160H95z" fill="url(#{uid}-water)" />
			<path class="ambient shimmer" d="M101 98c6-3 12-3 19 0s13 3 19 0" fill="none" stroke="var(--art-nacre, #fff)" stroke-opacity=".95" stroke-width="2" stroke-linecap="round" />
			<path d="M104 118V132" fill="none" stroke="var(--art-nacre, #fff)" stroke-opacity=".45" stroke-width="3" stroke-linecap="round" />
		</g>
		<!-- onde au point d'impact -->
		<ellipse class="ambient ripple" cx="120" cy="98" rx="15" ry="3" fill="none" stroke="var(--art-nacre, #fff)" stroke-width="1.8" />

		<!-- verre : arête, lèvre, reflet, graduations -->
		<path d="M100 24V126a20 20 0 0 0 40 0V24" fill="none" stroke="var(--art-glass, rgb(60 60 67 / .26))" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
		<path d="M95 24h50" fill="none" stroke="var(--art-glass, rgb(60 60 67 / .26))" stroke-width="3.5" stroke-linecap="round" />
		<path d="M106 38V82" fill="none" stroke="var(--art-nacre, #fff)" stroke-opacity=".75" stroke-width="3" stroke-linecap="round" />
		<path d="M148 50h9M148 62h5M148 74h9M148 86h5M148 98h9M148 110h5" fill="none" stroke="var(--art-glass, rgb(60 60 67 / .26))" stroke-width="2" stroke-linecap="round" />

		<!-- pipette et goutte -->
		<path d="M113 0h14v6c0 3-2 6-4 9h-6c-2-3-4-6-4-9z" fill="var(--art-glass, rgb(60 60 67 / .26))" />
		<path class="ambient drop" d="M120 14c3 4.500 5 7.500 5 10a5 5 0 0 1-10 0c0-2.500 2-5.500 5-10z" fill={water} />
	</svg>
</div>

<style>
	.shimmer {
		animation: shimmer 5s ease-in-out infinite;
	}
	.drop {
		transform-box: fill-box;
		transform-origin: 50% 0%;
		animation: drop 4s infinite;
	}
	.ripple {
		transform-box: fill-box;
		transform-origin: center;
		animation: ripple 4s ease-out infinite;
		opacity: 0;
	}
	@keyframes shimmer {
		50% {
			opacity: 0.4;
		}
	}
	/* La goutte se forme (0 à 14 %), tient, tombe (22 à 52 %) puis disparaît dans l'eau. */
	@keyframes drop {
		0% {
			transform: translateY(0) scale(0);
			opacity: 0;
			animation-timing-function: ease-out;
		}
		14%,
		22% {
			transform: translateY(0) scale(1);
			opacity: 1;
			animation-timing-function: cubic-bezier(0.5, 0, 0.9, 0.5);
		}
		50% {
			transform: translateY(70px) scale(1);
			opacity: 1;
		}
		52%,
		100% {
			transform: translateY(70px) scale(0.8);
			opacity: 0;
		}
	}
	@keyframes ripple {
		0%,
		50% {
			transform: scale(0.2);
			opacity: 0;
		}
		52% {
			opacity: 0.9;
		}
		82%,
		100% {
			transform: scale(1.4);
			opacity: 0;
		}
	}
</style>

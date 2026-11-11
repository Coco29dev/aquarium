<script lang="ts">
	import { ambient } from '$lib/motion/ambient';
	import { FISH } from './fish';

	/**
	 * « Hors ligne » ou erreur : un anneau de bulle avec une brèche, des gouttelettes qui s'en échappent,
	 * un poisson qui regarde vers la brèche. Toutes les 6 s l'anneau se referme doucement avant de se rouvrir :
	 * c'est le repère d'un nouvel essai. Anneau et fond de teinte grise (--label3), poisson resté corail.
	 * Props : class.
	 * Sert : écran sans connexion, page d'erreur (via EmptyState art="hors-ligne").
	 * Décor : aria-hidden ; le texte qui l'accompagne explique la situation et propose « Réessayer ».
	 */
	let { class: cls = '' }: { class?: string } = $props();
	const uid = $props.id();
</script>

<div class="block {cls}" use:ambient aria-hidden="true">
	<svg viewBox="0 0 240 184" class="block h-auto w-full">
		<defs>
			<radialGradient id="{uid}-bub" cx=".38" cy=".3" r=".8">
				<stop offset="0" stop-color="var(--art-lagon, #19b6c6)" stop-opacity=".05" />
				<stop offset="1" stop-color="var(--art-lagon, #19b6c6)" stop-opacity=".2" />
			</radialGradient>
			<linearGradient id="{uid}-fish" gradientUnits="userSpaceOnUse" x1="8" y1="12" x2="48" y2="54">
				<stop offset="0" stop-color="var(--art-fish-a, #ffb26b)" />
				<stop offset="1" stop-color="var(--art-fish-b, #f25c4e)" />
			</linearGradient>
		</defs>

		<!-- fil d'eau coupé, sous la bulle -->
		<ellipse cx="120" cy="166" rx="48" ry="5" fill="var(--art-shadow, rgb(6 50 63 / .14))" />
		<path d="M52 150q9-7 18 0t18 0t18 0t18 0t18 0t18 0" fill="none" stroke="var(--label3, rgb(60 60 67 / .3))" stroke-width="3" stroke-linecap="round" stroke-dasharray="0.1 7" />

		<circle cx="120" cy="92" r="56" fill="url(#{uid}-bub)" />
		<path d="M82 66A46 46 0 0 1 108 46" fill="none" stroke="var(--art-nacre, #fff)" stroke-opacity=".85" stroke-width="4" stroke-linecap="round" />

		<!-- l'anneau : pathLength 100, brèche en haut à droite, qui se referme puis se rouvre -->
		<circle class="ambient heal" cx="120" cy="92" r="56" pathLength="100" fill="none" stroke="var(--label3, rgb(60 60 67 / .3))" stroke-width="3" stroke-linecap="round" stroke-dasharray="72 28" />

		<!-- le poisson regarde vers la brèche -->
		<g transform="translate(112 98) rotate(-30) translate(-{FISH.center.x} -{FISH.center.y})">
			<g class="ambient bob">
				<path d={FISH.tail} fill="url(#{uid}-fish)" stroke="url(#{uid}-fish)" stroke-width="3" stroke-linejoin="round" />
				<path d={FISH.dorsal} fill="var(--art-fish-b, #f25c4e)" stroke="var(--art-fish-b, #f25c4e)" stroke-width="2" stroke-linejoin="round" />
				<path d={FISH.body} fill="url(#{uid}-fish)" />
				<path d={FISH.gill} fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2.6" stroke-linecap="round" />
				<circle cx={FISH.eye.x} cy={FISH.eye.y} r={FISH.eye.r} fill="var(--art-abysse, #06323f)" />
				<circle cx={FISH.glint.x} cy={FISH.glint.y} r={FISH.glint.r} fill="#fff" />
			</g>
		</g>

		<!-- gouttelettes qui s'échappent par la brèche -->
		<g fill="var(--art-lagon, #19b6c6)" fill-opacity=".55">
			<circle class="ambient leak" style="--d:0s" cx="164" cy="50" r="3" />
			<circle class="ambient leak" style="--d:1.2s" cx="172" cy="58" r="2.2" />
			<circle class="ambient leak" style="--d:2.4s" cx="160" cy="44" r="1.6" />
		</g>
	</svg>
</div>

<style>
	.heal {
		animation: heal 6s ease-in-out infinite;
	}
	.leak {
		transform-box: fill-box;
		transform-origin: center;
		animation: leak 3.6s ease-out var(--d) infinite;
	}
	@keyframes heal {
		0%,
		12% {
			stroke-dasharray: 72 28;
		}
		50%,
		68% {
			stroke-dasharray: 99 1;
		}
		90%,
		100% {
			stroke-dasharray: 72 28;
		}
	}
	@keyframes leak {
		0% {
			transform: translate(0, 0) scale(0.6);
			opacity: 0;
		}
		20% {
			opacity: 1;
		}
		100% {
			transform: translate(14px, -24px) scale(1);
			opacity: 0;
		}
	}
</style>

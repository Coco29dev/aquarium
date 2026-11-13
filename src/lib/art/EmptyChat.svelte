<script lang="ts">
	import { ambient } from '$lib/motion/ambient';
	import { FISH, FROND, WATER, type WaterVariant } from './fish';

	/**
	 * « Parle à ton assistant » : le poisson de la marque, tête tournée vers une bulle de dialogue dont les trois
	 * points respirent, quelques bulles qui montent entre eux, un brin d'algue dans le sable. Le poisson flotte
	 * doucement ; rien ne bouge avec « Réduire les animations » (règle globale de layout.css).
	 * Props : variant ('douce' par défaut | 'plantee' | 'mer' | 'recif' : teinte de l'algue et des bulles), class.
	 * Sert : écran de l'assistant (accueil d'une conversation, liste vide).
	 * Décor : aria-hidden ; le texte qui l'accompagne dit quoi faire.
	 */
	let { variant = 'douce', class: cls = '' }: { variant?: WaterVariant; class?: string } = $props();
	const uid = $props.id();
	const water = $derived(WATER[variant]);
</script>

<div class="block {cls}" use:ambient aria-hidden="true">
	<svg viewBox="0 0 240 184" class="block h-auto w-full">
		<defs>
			<linearGradient id="{uid}-fish" gradientUnits="userSpaceOnUse" x1="8" y1="12" x2="48" y2="54">
				<stop offset="0" stop-color="var(--art-fish-a, #ffb26b)" />
				<stop offset="1" stop-color="var(--art-fish-b, #f25c4e)" />
			</linearGradient>
		</defs>

		<!-- sable et ombre -->
		<ellipse cx="104" cy="172" rx="86" ry="6" fill="var(--art-shadow, rgb(6 50 63 / .14))" />
		<path d="M26 172c10-9 34-12 78-12s68 3 78 12z" fill="var(--art-sable, #efdcbb)" />
		<path d="M44 165c20-3.500 44-4.500 60-4.500" fill="none" stroke="var(--art-sable-deep, #d9c39b)" stroke-width="2.4" stroke-linecap="round" opacity=".7" />

		<!-- algues -->
		<g transform="translate(46 166) scale(.62)" fill="var(--art-algue, #3cc79a)">
			<g class="ambient sway"><path d={FROND} fill-opacity=".92" /></g>
		</g>
		<g transform="translate(60 168) scale(.4)" fill="var(--art-algue, #3cc79a)">
			<g class="ambient sway late"><path d={FROND} fill-opacity=".7" /></g>
		</g>
		<g transform="translate(168 168) scale(.5)" fill="var(--art-algue, #3cc79a)">
			<g class="ambient sway"><path d={FROND} fill-opacity=".8" /></g>
		</g>

		<!-- le poisson de la marque, tête à droite, tourné vers la bulle -->
		<g transform="translate(12 60) scale(1.78)">
			<g class="ambient bob">
				<path d={FISH.tail} fill="url(#{uid}-fish)" stroke="url(#{uid}-fish)" stroke-width="3" stroke-linejoin="round" />
				<path d={FISH.dorsal} fill="var(--art-fish-b, #f25c4e)" stroke="var(--art-fish-b, #f25c4e)" stroke-width="2" stroke-linejoin="round" />
				<path d={FISH.body} fill="url(#{uid}-fish)" />
				<path d={FISH.gill} fill="none" stroke="var(--art-nacre, #fff)" stroke-opacity=".6" stroke-width="2.6" stroke-linecap="round" />
				<circle cx={FISH.eye.x} cy={FISH.eye.y} r={FISH.eye.r} fill="var(--art-abysse, #06323f)" />
				<circle cx={FISH.glint.x} cy={FISH.glint.y} r={FISH.glint.r} fill="var(--art-nacre, #fff)" />
			</g>
		</g>

		<!-- bulles qui montent de la bouche vers la bulle de dialogue -->
		<g fill="none" stroke={water} stroke-width="2" stroke-opacity=".85">
			<circle class="ambient rise-a" cx="112" cy="106" r="4.200" />
			<circle class="ambient rise-b" cx="122" cy="92" r="2.600" />
		</g>

		<!-- bulle de dialogue : un seul tracé pour que le contour reste continu jusqu'à la queue -->
		<g class="ambient hover">
			<path
				d="M152 18H196A24 24 0 0 1 220 42V46A24 24 0 0 1 196 70H172Q168 82 144 90Q154 80 154 70H152A24 24 0 0 1 128 46V42A24 24 0 0 1 152 18Z"
				fill="var(--bg2, #fff)"
				stroke="var(--art-glass, rgb(60 60 67 / .26))"
				stroke-width="2.400"
				stroke-linejoin="round"
			/>
			<g fill={water}>
				<circle class="ambient dot" cx="156" cy="44" r="5.200" />
				<circle class="ambient dot d2" cx="174" cy="44" r="5.200" />
				<circle class="ambient dot d3" cx="192" cy="44" r="5.200" />
			</g>
			<path d="M140 28c3-3 7-5 12-5" fill="none" stroke="var(--art-nacre, #fff)" stroke-opacity=".8" stroke-width="3" stroke-linecap="round" />
		</g>
	</svg>
</div>

<style>
	.bob {
		animation: bob 5.5s ease-in-out infinite;
	}
	.hover {
		animation: bob 6.5s ease-in-out -2s infinite;
	}
	.sway {
		transform-box: fill-box;
		transform-origin: 50% 100%;
		animation: sway 6s ease-in-out infinite;
	}
	.late {
		animation-delay: -2.5s;
	}
	.dot {
		transform-box: fill-box;
		transform-origin: center;
		animation: breathe 1.6s ease-in-out infinite;
	}
	.d2 {
		animation-delay: 200ms;
	}
	.d3 {
		animation-delay: 400ms;
	}
	.rise-a {
		animation: rise 5s ease-in infinite;
	}
	.rise-b {
		animation: rise 5s ease-in -2.4s infinite;
	}
	@keyframes bob {
		50% {
			transform: translateY(-4px);
		}
	}
	@keyframes sway {
		50% {
			transform: rotate(3deg);
		}
	}
	@keyframes breathe {
		0%,
		70%,
		100% {
			opacity: 0.35;
			transform: scale(0.75);
		}
		35% {
			opacity: 1;
			transform: scale(1);
		}
	}
	@keyframes rise {
		0% {
			transform: translateY(14px);
			opacity: 0;
		}
		25% {
			opacity: 1;
		}
		100% {
			transform: translateY(-16px);
			opacity: 0;
		}
	}
</style>

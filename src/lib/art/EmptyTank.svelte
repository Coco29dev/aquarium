<script lang="ts">
	import { ambient } from '$lib/motion/ambient';
	import { CORAL, FISH, FROND, FROND_VEIN, WATER, swellPath, type WaterVariant } from './fish';

	/**
	 * « Aucun bac » : un aquarium vide, eau claire, sable, une algue, et la silhouette pointillée du
	 * premier poisson qui viendra. Lumière d'en haut à gauche.
	 * Props : variant ('douce' par défaut | 'plantee' | 'mer' | 'recif' : couleur de l'eau et décor), class
	 * (sur l'enveloppe ; largeur fixée par le parent, hauteur proportionnelle).
	 * Sert : écran Bacs et accueil sans bac (via EmptyState art="bac"). Décor : aria-hidden ; le texte
	 * qui l'accompagne porte l'information. Jetons --art-* : clair et sombre sans rien d'autre.
	 */
	let { variant = 'douce', class: cls = '' }: { variant?: WaterVariant; class?: string } = $props();
	const uid = $props.id();
	const water = $derived(WATER[variant]);
	const reef = $derived(variant === 'mer' || variant === 'recif');
	const SURFACE = swellPath(36, 50);
</script>

<div class="block {cls}" use:ambient aria-hidden="true">
	<svg viewBox="0 0 240 184" class="block h-auto w-full">
		<defs>
			<clipPath id="{uid}-clip"><rect x="36" y="22" width="168" height="128" rx="20" /></clipPath>
			<linearGradient id="{uid}-water" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color={water} stop-opacity=".66" />
				<stop offset="1" stop-color={water} stop-opacity=".34" />
			</linearGradient>
			<linearGradient id="{uid}-ray" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="var(--art-nacre, #fff)" stop-opacity=".42" />
				<stop offset="1" stop-color="var(--art-nacre, #fff)" stop-opacity="0" />
			</linearGradient>
			<linearGradient id="{uid}-fish" gradientUnits="userSpaceOnUse" x1="5" y1="16" x2="50" y2="50">
				<stop offset="0" stop-color="var(--art-fish-a, #ffb26b)" />
				<stop offset="1" stop-color="var(--art-fish-b, #f25c4e)" />
			</linearGradient>
		</defs>

		<!-- ombre portée et pied -->
		<ellipse cx="120" cy="170" rx="94" ry="6.5" fill="var(--art-shadow, rgb(6 50 63 / .14))" />
		<rect x="28" y="148" width="184" height="16" rx="8" fill="var(--bg2, #fff)" stroke="var(--art-glass, rgb(60 60 67 / .26))" stroke-width="2" />

		<!-- verre : fond légèrement laiteux -->
		<rect x="36" y="22" width="168" height="128" rx="20" fill="var(--bg2, #fff)" fill-opacity=".6" />

		<g clip-path="url(#{uid}-clip)">
			<!-- eau : le groupe glisse d'une période de vague (84) -->
			<g class="ambient swell">
				<path d="{SURFACE}V150H36z" fill="url(#{uid}-water)" />
				<path d={SURFACE} fill="none" stroke="var(--art-nacre, #fff)" stroke-opacity=".95" stroke-width="2" stroke-linecap="round" />
			</g>

			<!-- rayons d'en haut à gauche, sous la surface -->
			<path d="M64 56h34L72 150H34z" fill="url(#{uid}-ray)" />
			<path d="M112 56h14l-22 94H92z" fill="url(#{uid}-ray)" opacity=".7" />

			<!-- caustiques -->
			<g class="ambient shimmer" fill="none" stroke="var(--art-caustic, rgb(255 255 255 / .5))" stroke-width="1.6" stroke-linecap="round">
				<path d="M58 68c8-5 16-5 24 0s16 5 24 0" />
				<path d="M128 76c7-4 13-4 20 0s13 4 20 0" />
				<path d="M76 88c6-3 12-3 18 0" />
			</g>

			<!-- décor planté dans le sable (le sable est dessiné par-dessus) : algues, ou corail en mer et récif -->
			{#if reef}
				<g transform="translate(76 134)" fill="none" stroke={variant === 'mer' ? 'var(--art-meduse, #8a63d8)' : 'var(--art-fish-b, #f25c4e)'} stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
					<g class="ambient sway"><path d={CORAL} /></g>
				</g>
			{:else}
				<g transform="translate(70 134)" fill="var(--art-algue, #3cc79a)">
					<g class="ambient sway">
						<path d={FROND} fill-opacity=".92" />
						<path d={FROND_VEIN} fill="none" stroke="var(--art-nacre, #fff)" stroke-opacity=".4" stroke-width="1.4" stroke-linecap="round" />
					</g>
				</g>
				<g transform="translate(86 136) scale(.62)" fill="var(--art-algue, #3cc79a)">
					<g class="ambient sway late"><path d={FROND} fill-opacity=".72" /></g>
				</g>
				{#if variant === 'plantee'}
					<g transform="translate(184 136) scale(.8)" fill="var(--art-algue, #3cc79a)">
						<g class="ambient sway"><path d={FROND} fill-opacity=".85" /></g>
					</g>
				{/if}
			{/if}

			<!-- sable -->
			<path d="M36 126c28-10 58 4 92-4s58-6 76 0V150H36z" fill="var(--art-sable, #efdcbb)" />
			<path d="M36 138c44-8 94 4 168-4V150H36z" fill="var(--art-sable-deep, #d9c39b)" />
			<path d="M36 126c28-10 58 4 92-4s58-6 76 0" fill="none" stroke="var(--art-nacre, #fff)" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round" />
			<ellipse cx="156" cy="131" rx="7.5" ry="4.5" fill="var(--art-sable-deep, #d9c39b)" />
			<ellipse cx="168" cy="134" rx="4.5" ry="3" fill="var(--art-sable-deep, #d9c39b)" />

			<!-- le premier poisson : silhouette pointillée qui flotte (keyframes bob de layout.css) -->
			<g transform="translate(97.5 58.5) scale(.9)">
				<g class="ambient bob">
					<path
						d={FISH.outline}
						fill="var(--art-fish-b, #f25c4e)"
						fill-opacity=".14"
						stroke="url(#{uid}-fish)"
						stroke-width="2.2"
						stroke-linecap="round"
						stroke-linejoin="round"
						pathLength="120"
						stroke-dasharray="3.4 3"
					/>
					<circle cx={FISH.eye.x} cy={FISH.eye.y} r="2.6" fill="var(--art-fish-b, #f25c4e)" fill-opacity=".55" />
				</g>
			</g>

			<!-- bulles qui montent de l'endroit où il sera -->
			<g fill="var(--art-nacre, #fff)" fill-opacity=".18" stroke="var(--art-nacre, #fff)" stroke-opacity=".9" stroke-width="1.6">
				<circle class="ambient bubble" style="--d:0s" cx="168" cy="92" r="4" />
				<circle class="ambient bubble" style="--d:1.2s" cx="176" cy="80" r="2.6" />
				<circle class="ambient bubble" style="--d:2.4s" cx="164" cy="70" r="1.8" />
			</g>
		</g>

		<!-- verre : arête, reflets verticaux, liseré de lumière -->
		<rect x="36" y="22" width="168" height="128" rx="20" fill="none" stroke="var(--art-glass, rgb(60 60 67 / .26))" stroke-width="2.5" />
		<path d="M50 60V104M50 112v6" fill="none" stroke="var(--art-nacre, #fff)" stroke-opacity=".7" stroke-width="3" stroke-linecap="round" />
		<path d="M48 40c1-6 5-10 11-11" fill="none" stroke="var(--art-nacre, #fff)" stroke-opacity=".8" stroke-width="2.5" stroke-linecap="round" />
	</svg>
</div>

<style>
	.swell {
		animation: swell 7s linear infinite;
	}
	.shimmer {
		animation: shimmer 5s ease-in-out infinite;
	}
	.bob {
		animation: bob 4.2s ease-in-out infinite;
	}
	.sway {
		transform-box: fill-box;
		transform-origin: 50% 100%;
		animation: sway 6s ease-in-out infinite;
	}
	.sway.late {
		animation-delay: -2.5s;
	}
	.bubble {
		transform-box: fill-box;
		transform-origin: center;
		animation: rise 4.8s ease-in var(--d) infinite;
	}
	@keyframes swell {
		to {
			transform: translateX(-84px);
		}
	}
	@keyframes shimmer {
		50% {
			opacity: 0.35;
		}
	}
	@keyframes sway {
		50% {
			transform: rotate(4deg);
		}
	}
	@keyframes rise {
		0% {
			transform: translateY(0) scale(0.6);
			opacity: 0;
		}
		20% {
			opacity: 1;
		}
		100% {
			transform: translateY(-34px) scale(1);
			opacity: 0;
		}
	}
</style>

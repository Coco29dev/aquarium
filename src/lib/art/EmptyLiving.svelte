<script lang="ts">
	import { ambient } from '$lib/motion/ambient';
	import { CORAL, FISH, FROND, SPARKLE, WATER, type WaterVariant } from './fish';

	/**
	 * « Aucun habitant » : un hublot sur le fond du bac, sans verre ni cadre rectangulaire (autre forme que
	 * EmptyTank). Sable, galets, décor propre au type d'eau, la silhouette pointillée de l'habitant à
	 * venir, deux étincelles et des bulles. Lumière d'en haut à gauche.
	 * Props : variant ('douce' par défaut | 'plantee' | 'mer' : coquillage et étoile | 'recif' : corail et
	 * anémone), class.
	 * Sert : onglet Faune et flore d'un bac, inventaire vide (via EmptyState art="habitants").
	 * Décor : aria-hidden ; le texte qui l'accompagne invite à ajouter un habitant.
	 */
	let { variant = 'douce', class: cls = '' }: { variant?: WaterVariant; class?: string } = $props();
	const uid = $props.id();
	const water = $derived(WATER[variant]);

	/** Étoile de mer à cinq bras, centrée en (0, 0). */
	const star = Array.from({ length: 10 }, (_, i) => {
		const a = (Math.PI * i) / 5 - Math.PI / 2;
		const r = i % 2 === 0 ? 11 : 5;
		return `${i === 0 ? 'M' : 'L'}${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`;
	}).join('') + 'z';
	/** Tentacules d'anémone : dérive horizontale de la pointe. */
	const tentacles = [-13, -8, -3, 2, 7, 12];
</script>

<div class="block {cls}" use:ambient aria-hidden="true">
	<svg viewBox="0 0 240 184" class="block h-auto w-full">
		<defs>
			<clipPath id="{uid}-clip"><circle cx="120" cy="92" r="77" /></clipPath>
			<linearGradient id="{uid}-water" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color={water} stop-opacity=".62" />
				<stop offset="1" stop-color={water} stop-opacity=".3" />
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

		<ellipse cx="120" cy="174" rx="60" ry="5" fill="var(--art-shadow, rgb(6 50 63 / .14))" />

		<g clip-path="url(#{uid}-clip)">
			<rect x="30" y="10" width="180" height="170" fill="url(#{uid}-water)" />
			<!-- rayons d'en haut à gauche -->
			<path d="M72 14h30L84 180H34z" fill="url(#{uid}-ray)" />
			<path d="M118 14h14L110 180H92z" fill="url(#{uid}-ray)" opacity=".7" />
			<g class="ambient shimmer" fill="none" stroke="var(--art-caustic, rgb(255 255 255 / .5))" stroke-width="1.6" stroke-linecap="round">
				<path d="M84 34c8-5 16-5 24 0s16 5 24 0" />
				<path d="M134 46c7-4 13-4 20 0s13 4 20 0" />
			</g>

			<!-- décor planté dans le sable, selon le type d'eau (le sable est dessiné par-dessus) -->
			{#if variant === 'douce'}
				<g transform="translate(78 150)" fill="var(--art-algue, #3cc79a)">
					<g class="ambient sway"><path d={FROND} fill-opacity=".9" /></g>
				</g>
				<g transform="translate(94 152) scale(.5)" fill="var(--art-algue, #3cc79a)">
					<g class="ambient sway late"><path d={FROND} fill-opacity=".7" /></g>
				</g>
			{:else if variant === 'plantee'}
				<g transform="translate(76 152)" fill="var(--art-algue, #3cc79a)">
					<g class="ambient sway"><path d={FROND} fill-opacity=".9" /></g>
				</g>
				<g transform="translate(94 154) scale(.6)" fill="var(--art-algue, #3cc79a)">
					<g class="ambient sway late"><path d={FROND} fill-opacity=".72" /></g>
				</g>
				<g transform="translate(160 152) scale(.78)" fill="var(--art-algue, #3cc79a)">
					<g class="ambient sway"><path d={FROND} fill-opacity=".85" /></g>
				</g>
			{:else if variant === 'recif'}
				<g transform="translate(80 150)" fill="none" stroke="var(--art-fish-b, #f25c4e)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
					<g class="ambient sway"><path d={CORAL} /></g>
				</g>
				<g transform="translate(156 150)" fill="none" stroke="var(--art-meduse, #8a63d8)" stroke-width="3" stroke-linecap="round">
					<g class="ambient sway late">
						{#each tentacles as dx (dx)}
							<path d="M{dx * 0.6} 0q{dx * 0.4} -9 {dx} -22" />
						{/each}
					</g>
				</g>
			{/if}

			<!-- sable -->
			<path d="M36 148c26-12 56-4 84-8s62-8 86 4V180H36z" fill="var(--art-sable, #efdcbb)" />
			<path d="M36 164c46-8 100 4 170-6V180H36z" fill="var(--art-sable-deep, #d9c39b)" />
			<path d="M36 148c26-12 56-4 84-8s62-8 86 4" fill="none" stroke="var(--art-nacre, #fff)" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round" />
			<ellipse cx="136" cy="152" rx="7" ry="4.2" fill="var(--art-sable-deep, #d9c39b)" />
			<ellipse cx="148" cy="155" rx="4.2" ry="2.8" fill="var(--art-sable-deep, #d9c39b)" />
			{#if variant === 'douce'}
				<ellipse cx="116" cy="157" rx="5" ry="3" fill="var(--art-sable-deep, #d9c39b)" />
			{/if}
			{#if variant === 'mer'}
				<!-- coquillage et étoile de mer posés sur le sable -->
				<g transform="translate(86 154)">
					<path d="M0 0C-12-4-16-16-10-22 -5-26 5-26 10-22 16-16 12-4 0 0z" fill="var(--art-fish-a, #ffb26b)" />
					<path d="M0 0L-6-22M0 0L0-25M0 0L6-22" fill="none" stroke="var(--art-nacre, #fff)" stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round" />
				</g>
				<g transform="translate(150 152) rotate(-14)">
					<path d={star} fill="var(--art-meduse, #8a63d8)" stroke="var(--art-meduse, #8a63d8)" stroke-width="3" stroke-linejoin="round" />
				</g>
			{/if}

			<!-- l'habitant à venir : silhouette pointillée qui flotte -->
			<g transform="translate(99 56) scale(.8)">
				<g class="ambient bob">
					<path
						d={FISH.outline}
						fill="var(--art-fish-b, #f25c4e)"
						fill-opacity=".14"
						stroke="url(#{uid}-fish)"
						stroke-width="2.4"
						stroke-linecap="round"
						stroke-linejoin="round"
						pathLength="120"
						stroke-dasharray="3.4 3"
					/>
					<circle cx={FISH.eye.x} cy={FISH.eye.y} r="2.6" fill="var(--art-fish-b, #f25c4e)" fill-opacity=".55" />
				</g>
			</g>

			<!-- étincelles et bulles -->
			<g fill="var(--art-nacre, #fff)">
				<g transform="translate(166 52) scale(7)"><path class="ambient twinkle" style="--d:0s" d={SPARKLE} /></g>
				<g transform="translate(88 96) scale(5)"><path class="ambient twinkle" style="--d:1.4s" d={SPARKLE} /></g>
			</g>
			<g fill="var(--art-nacre, #fff)" fill-opacity=".18" stroke="var(--art-nacre, #fff)" stroke-opacity=".9" stroke-width="1.6">
				<circle class="ambient bubble" style="--d:0s" cx="156" cy="112" r="3.6" />
				<circle class="ambient bubble" style="--d:2s" cx="146" cy="102" r="2.2" />
			</g>
		</g>

		<!-- hublot : anneau, liseré de lumière, quatre rivets -->
		<circle cx="120" cy="92" r="79" fill="none" stroke="var(--art-glass, rgb(60 60 67 / .26))" stroke-width="5" />
		<circle cx="120" cy="92" r="75.5" fill="none" stroke="var(--art-nacre, #fff)" stroke-opacity=".6" stroke-width="1.5" />
		<g fill="var(--bg2, #fff)" stroke="var(--art-glass, rgb(60 60 67 / .26))" stroke-width="1.6">
			<circle cx="64" cy="36" r="3" />
			<circle cx="176" cy="36" r="3" />
			<circle cx="64" cy="148" r="3" />
			<circle cx="176" cy="148" r="3" />
		</g>
		<path d="M68 52A62 62 0 0 1 96 30" fill="none" stroke="var(--art-nacre, #fff)" stroke-opacity=".85" stroke-width="3.5" stroke-linecap="round" />
	</svg>
</div>

<style>
	.shimmer {
		animation: shimmer 5s ease-in-out infinite;
	}
	.sway {
		transform-box: fill-box;
		transform-origin: 50% 100%;
		animation: sway 6s ease-in-out infinite;
	}
	.sway.late {
		animation-delay: -2.5s;
	}
	.bob {
		animation: bob 4.2s ease-in-out infinite;
	}
	.twinkle {
		transform-box: fill-box;
		transform-origin: center;
		animation: twinkle 3.2s ease-in-out var(--d) infinite;
	}
	.bubble {
		transform-box: fill-box;
		transform-origin: center;
		animation: rise 5s ease-in var(--d) infinite;
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
	@keyframes twinkle {
		0%,
		100% {
			opacity: 0.25;
			transform: scale(0.6);
		}
		50% {
			opacity: 1;
			transform: scale(1);
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
			transform: translateY(-30px) scale(1);
			opacity: 0;
		}
	}
</style>

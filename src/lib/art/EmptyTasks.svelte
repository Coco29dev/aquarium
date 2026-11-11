<script lang="ts">
	import { ambient } from '$lib/motion/ambient';
	import { FISH, FROND, WATER, type WaterVariant } from './fish';

	/**
	 * « Rien à faire » : une grande bulle posée sur le sable, un poisson détendu qui y dort (œil en arc),
	 * trois bulles « zzz » qui s'en échappent, un badge bioluminescent à coche : tout est fait.
	 * Props : variant ('douce' par défaut | 'plantee' | 'mer' | 'recif' : teinte de l'eau de la bulle), class.
	 * Sert : « Aujourd'hui » sans tâche, onglet Tâches d'un bac (via EmptyState art="taches").
	 * Décor : aria-hidden ; le texte qui l'accompagne dit que tout est fait.
	 */
	let { variant = 'douce', class: cls = '' }: { variant?: WaterVariant; class?: string } = $props();
	const uid = $props.id();
	const water = $derived(WATER[variant]);
</script>

<div class="block {cls}" use:ambient aria-hidden="true">
	<svg viewBox="0 0 240 184" class="block h-auto w-full">
		<defs>
			<radialGradient id="{uid}-bub" cx=".38" cy=".3" r=".8">
				<stop offset="0" stop-color={water} stop-opacity=".1" />
				<stop offset="1" stop-color={water} stop-opacity=".34" />
			</radialGradient>
			<linearGradient id="{uid}-fish" gradientUnits="userSpaceOnUse" x1="8" y1="12" x2="48" y2="54">
				<stop offset="0" stop-color="var(--art-fish-a, #ffb26b)" />
				<stop offset="1" stop-color="var(--art-fish-b, #f25c4e)" />
			</linearGradient>
		</defs>

		<!-- île de sable, algues et ombre de la bulle -->
		<path d="M26 166C30 152 72 146 120 146s90 6 94 20c-4 12-52 16-94 16S30 178 26 166z" fill="var(--art-sable, #efdcbb)" />
		<path d="M28 168c8 6 44 8 92 8s84-2 92-8c-6 12-50 16-92 16S34 180 28 168z" fill="var(--art-sable-deep, #d9c39b)" />
		<path d="M40 156c20-6 48-8 80-8s60 2 80 8" fill="none" stroke="var(--art-nacre, #fff)" stroke-opacity=".5" stroke-width="1.6" stroke-linecap="round" />
		<ellipse cx="120" cy="150" rx="42" ry="4.5" fill="var(--art-shadow, rgb(6 50 63 / .14))" />
		<ellipse cx="176" cy="160" rx="6" ry="3.6" fill="var(--art-sable-deep, #d9c39b)" />
		<ellipse cx="187" cy="163" rx="3.6" ry="2.4" fill="var(--art-sable-deep, #d9c39b)" />
		<g transform="translate(60 158) scale(.5)" fill="var(--art-algue, #3cc79a)">
			<g class="ambient sway"><path d={FROND} fill-opacity=".9" /></g>
		</g>
		<g transform="translate(72 162) scale(.34)" fill="var(--art-algue, #3cc79a)">
			<g class="ambient sway late"><path d={FROND} fill-opacity=".7" /></g>
		</g>

		<!-- la bulle respire doucement ; le poisson flotte dedans -->
		<g class="ambient breathe">
			<circle cx="120" cy="88" r="58" fill="url(#{uid}-bub)" stroke={water} stroke-opacity=".6" stroke-width="2.5" />
			<path d="M84 58A46 46 0 0 1 112 42" fill="none" stroke="var(--art-nacre, #fff)" stroke-opacity=".9" stroke-width="4" stroke-linecap="round" />
			<path d="M156 126A46 46 0 0 1 134 138" fill="none" stroke="var(--art-nacre, #fff)" stroke-opacity=".55" stroke-width="3" stroke-linecap="round" />
			<g transform="translate(120 90) rotate(-5) scale(1.05) translate(-{FISH.center.x} -{FISH.center.y})">
				<g class="ambient float">
					<path d={FISH.tail} fill="url(#{uid}-fish)" stroke="url(#{uid}-fish)" stroke-width="3" stroke-linejoin="round" />
					<path d={FISH.dorsal} fill="var(--art-fish-b, #f25c4e)" stroke="var(--art-fish-b, #f25c4e)" stroke-width="2" stroke-linejoin="round" />
					<path d={FISH.body} fill="url(#{uid}-fish)" />
					<path d={FISH.gill} fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2.6" stroke-linecap="round" />
					<path d={FISH.sleepyEye} fill="none" stroke="var(--art-abysse, #06323f)" stroke-width="2" stroke-linecap="round" />
				</g>
			</g>
		</g>

		<!-- bulles « zzz » -->
		<g fill="var(--art-nacre, #fff)" fill-opacity=".2" stroke={water} stroke-opacity=".7" stroke-width="1.6">
			<circle class="ambient zz" style="--d:0s" cx="60" cy="48" r="3" />
			<circle class="ambient zz" style="--d:1.6s" cx="48" cy="34" r="4.4" />
			<circle class="ambient zz" style="--d:3.2s" cx="34" cy="20" r="6" />
		</g>

		<!-- badge : tout est fait -->
		<circle class="ambient halo" cx="178" cy="44" r="17" fill="none" stroke="var(--art-bio, #0fb5a4)" stroke-width="2" />
		<circle cx="178" cy="44" r="17" fill="var(--art-bio, #0fb5a4)" />
		<path d="M170 44.5l5.5 5.5 10.500-12" fill="none" stroke="var(--on-tint, #fff)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
	</svg>
</div>

<style>
	.breathe {
		transform-box: fill-box;
		transform-origin: 50% 100%;
		animation: breathe 5s ease-in-out infinite;
	}
	.float {
		animation: float 4.4s ease-in-out infinite;
	}
	.sway {
		transform-box: fill-box;
		transform-origin: 50% 100%;
		animation: sway 6s ease-in-out infinite;
	}
	.sway.late {
		animation-delay: -2.5s;
	}
	.zz {
		transform-box: fill-box;
		transform-origin: center;
		animation: rise 4.8s ease-in var(--d) infinite;
	}
	.halo {
		transform-box: fill-box;
		transform-origin: center;
		animation: halo 3.2s ease-out infinite;
	}
	@keyframes breathe {
		50% {
			transform: scale(1.025);
		}
	}
	@keyframes float {
		50% {
			transform: translateY(-1.6px);
		}
	}
	@keyframes sway {
		50% {
			transform: rotate(4deg);
		}
	}
	@keyframes rise {
		0% {
			transform: translate(0, 0) scale(0.6);
			opacity: 0;
		}
		20% {
			opacity: 1;
		}
		100% {
			transform: translate(-6px, -22px) scale(1);
			opacity: 0;
		}
	}
	@keyframes halo {
		0% {
			transform: scale(1);
			opacity: 0.6;
		}
		70%,
		100% {
			transform: scale(1.5);
			opacity: 0;
		}
	}
</style>

<script lang="ts">
	import { FISH, onCircle } from './fish';

	/**
	 * Loader maison : un poisson corail fait le tour d'un anneau d'eau, trois bulles dans son sillage.
	 * Props : progress (0 → 1, tirer pour synchroniser : le poisson avance sur l'anneau en apparaissant),
	 * spinning (il nage en boucle, la queue bat), size (px, 28), class.
	 * Couleur de l'anneau et des bulles : --loader-ink (défaut --tint) ; sur un bouton plein, poser
	 * style="--loader-ink: var(--on-tint)".
	 * Mouvement réduit : le poisson se pose en haut de l'anneau et le sillage respire (classe .busy de layout.css).
	 * Sert : Spinner (tout l'appli), connexion, tirer-pour-synchroniser, recherche. Décor : aria-hidden ;
	 * le parent annonce l'attente (role="status", aria-label).
	 */
	interface Props {
		progress?: number;
		spinning?: boolean;
		size?: number;
		class?: string;
	}
	let { progress = 1, spinning = false, size = 28, class: cls = '' }: Props = $props();
	const uid = $props.id();
	const R = 14;
	const p = $derived(Math.min(1, Math.max(0, progress)));
	// À petite taille, le poisson grossit et le sillage se réduit pour rester lisible.
	const small = $derived(size < 22);
	const fishScale = $derived(small ? 0.36 : 0.26);
	// Sillage : angle derrière le poisson (degrés), rayon et opacité des bulles.
	const wake = $derived(
		(small
			? [
					{ a: -40, r: 2, o: 0.8 },
					{ a: -68, r: 1.4, o: 0.45 }
				]
			: [
					{ a: -32, r: 2.1, o: 0.85 },
					{ a: -54, r: 1.6, o: 0.55 },
					{ a: -73, r: 1.1, o: 0.3 }
				]
		).map((w) => ({ ...w, ...onCircle(20, 20, R, w.a) }))
	);
</script>

<svg width={size} height={size} viewBox="0 0 40 40" class="loader shrink-0 {spinning ? 'is-spinning' : ''} {cls}" aria-hidden="true">
	<defs>
		<linearGradient id="{uid}-f" gradientUnits="userSpaceOnUse" x1="8" y1="12" x2="48" y2="54">
			<stop offset="0" stop-color="var(--art-fish-a, #ffb26b)" />
			<stop offset="1" stop-color="var(--art-fish-b, #f25c4e)" />
		</linearGradient>
	</defs>

	<circle cx="20" cy="20" r={R} fill="none" stroke="currentColor" stroke-opacity=".2" stroke-width="2.4" />
	{#if size >= 36}
		<circle class="core" cx="20" cy="20" r="3.4" fill="none" stroke="currentColor" stroke-opacity=".38" stroke-width="1.6" />
	{/if}

	<g class="orbit" style={spinning ? undefined : `transform: rotate(${p * 360}deg)`} opacity={spinning ? 1 : Math.min(1, p * 4)}>
		{#each wake as w, i (i)}
			<circle class="wake {spinning ? 'busy' : ''}" cx={w.x} cy={w.y} r={w.r} fill="currentColor" fill-opacity={w.o} />
		{/each}
		<!-- le poisson de la marque, tête à droite : il avance dans le sens des aiguilles -->
		<g transform="translate(20 6) scale({fishScale}) translate(-{FISH.center.x} -{FISH.center.y})">
			<g class="tail">
				<path d={FISH.tail} fill="url(#{uid}-f)" stroke="url(#{uid}-f)" stroke-width="3" stroke-linejoin="round" />
			</g>
			<path d={FISH.body} fill="url(#{uid}-f)" />
			<circle cx={FISH.eye.x} cy={FISH.eye.y} r="3.6" fill="#06323f" />
		</g>
	</g>
</svg>

<style>
	.loader {
		color: var(--loader-ink, var(--tint));
		overflow: visible;
	}
	.orbit {
		transform-origin: 20px 20px;
	}
	.tail {
		transform-box: fill-box;
		transform-origin: 100% 50%;
	}
	.is-spinning .orbit {
		animation: orbit 1.6s linear infinite;
	}
	.is-spinning .tail {
		animation: flick 0.38s ease-in-out infinite alternate;
	}
	.is-spinning .core {
		transform-box: fill-box;
		transform-origin: center;
		animation: breathe 1.6s ease-in-out infinite;
	}
	@keyframes orbit {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes flick {
		from {
			transform: rotate(-11deg);
		}
		to {
			transform: rotate(11deg);
		}
	}
	@keyframes breathe {
		50% {
			transform: scale(1.25);
		}
	}
</style>

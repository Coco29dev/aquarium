<script lang="ts">
	/**
	 * Squelette de chargement : la silhouette de l'écran qui arrive (bloc scène, puis deux cartes), en teinte
	 * `--fill3`, avec un reflet qui glisse. Il remplace le rond d'attente tant que les données de l'appli ne sont
	 * pas lues ; le layout ne l'affiche qu'après 150 ms (le cache local répond presque toujours avant) et jamais
	 * sur un écran présenté en feuille plein écran.
	 * Props : variant ('aujourdhui' : scène arrondie `rounded-hero`, carte « Prochaine action », carte de tuiles).
	 * Mouvement réduit : plus de reflet, les blocs respirent (classe .busy de layout.css).
	 * Annonce l'attente (role="status", aria-label) ; les blocs sont décoratifs.
	 */
	interface Props {
		variant?: 'aujourdhui';
	}
	let { variant = 'aujourdhui' }: Props = $props();
</script>

<!-- Même décalage que la barre de navigation (zone sûre + 44 px) : les blocs tombent où l'écran les posera. -->
<div class="skeleton w-full text-left" style="padding-top: calc(env(safe-area-inset-top) + 48px)" role="status" aria-label="Chargement" data-variant={variant}>
	{#if variant === 'aujourdhui'}
		<div class="sk busy mb-6 h-[17rem] rounded-hero" aria-hidden="true"></div>
		<div class="sk busy mb-6 h-[4.75rem] rounded-card" aria-hidden="true"></div>
		<div class="sk busy h-[8.5rem] rounded-card" aria-hidden="true"></div>
	{/if}
</div>

<style>
	.sk {
		--sheen: rgb(255 255 255 / 0.55);
		position: relative;
		overflow: hidden;
		background: var(--fill3);
	}
	:global([data-scheme='dark']) .sk {
		--sheen: rgb(255 255 255 / 0.07);
	}
	/* Le reflet est un calque qui glisse (transform seul : tout se passe sur le compositeur). */
	.sk::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(100deg, transparent 30%, var(--sheen) 50%, transparent 70%);
		transform: translateX(-100%);
		animation: sk-sheen 1.7s var(--ease-nav) infinite;
	}
	@keyframes sk-sheen {
		to {
			transform: translateX(100%);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sk::after {
			display: none;
		}
	}
</style>

<script lang="ts">
	// Icônes de la charte : grille de 24 px, trait de 2,3 px, aplat franc (.f) sous le trait.
	const paths = {
		today: '<circle class="f" cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/>',
		bacs: '<rect class="f" x="3" y="6" width="18" height="13" rx="3"/><path d="M3 12c3-2.2 5 2.2 9 0s6 2.2 9 0"/>',
		outils: '<rect class="f" x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M8 3v4M16 3v4"/>',
		reglages:
			'<path d="M4 8h9M19 8h1M4 16h1M11 16h9"/><circle class="f" cx="16" cy="8" r="2.4"/><circle class="f" cx="8" cy="16" r="2.4"/>'
	} as const;

	let { name, class: cls = '' }: { name: keyof typeof paths; class?: string } = $props();
</script>

<svg class="icon {cls}" viewBox="0 0 24 24" aria-hidden="true">{@html paths[name]}</svg>

<style>
	.icon {
		width: 1.5rem;
		height: 1.5rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 2.3;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.icon :global(.f) {
		fill: currentColor;
		fill-opacity: 0.35;
	}
</style>

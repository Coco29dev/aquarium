<script lang="ts">
	// Marque « bulle » : un poisson tracé à l'encre, sa doublure corail légèrement décalée
	// comme une impression riso mal calée, et deux bulles.
	let { size = 48, class: cls = '' }: { size?: number; class?: string } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 64 64" class={cls} aria-hidden="true">
	<path d="M10 36c6-11 17-14 27-10 4 1.6 7 4.6 9 8.5 1.6-1.8 4.2-4 6-5.4v13.8c-1.8-1.4-4.4-3.6-6-5.4-2 3.9-5 6.9-9 8.5-10 4-21 1-27-10z" fill="var(--t-recif)" transform="translate(3 3)" />
	<path d="M10 36c6-11 17-14 27-10 4 1.6 7 4.6 9 8.5 1.6-1.8 4.2-4 6-5.4v13.8c-1.8-1.4-4.4-3.6-6-5.4-2 3.9-5 6.9-9 8.5-10 4-21 1-27-10z" fill="none" stroke="var(--ink)" stroke-width="3.2" stroke-linejoin="round" />
	<path d="M30 28.5c-2.4 4.6-2.4 10.4 0 15" fill="none" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" />
	<circle cx="20" cy="34" r="2.4" fill="var(--ink)" />
	<circle cx="44" cy="13" r="5.5" fill="var(--t-douce)" stroke="var(--ink)" stroke-width="2.6" />
	<circle cx="53" cy="5.5" r="2.8" fill="none" stroke="var(--ink)" stroke-width="2.2" />
</svg>

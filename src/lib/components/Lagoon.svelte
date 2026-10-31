<script lang="ts">
	// Vignette d'ambiance de la marque : eau lagon, rayons de lumière, bulles et poisson corail.
	// Décor pur (aria-hidden) ; les mouvements s'arrêtent si l'iPhone demande moins d'animations.
	let { class: cls = '' }: { class?: string } = $props();
	const bubbles = [
		{ x: 18, s: 10, d: 0, t: 5.2 },
		{ x: 30, s: 16, d: 1.4, t: 6.4 },
		{ x: 62, s: 8, d: 0.6, t: 4.8 },
		{ x: 74, s: 14, d: 2.2, t: 6 },
		{ x: 86, s: 9, d: 3.1, t: 5.5 }
	];
</script>

<div
	class="relative overflow-hidden rounded-[32px] shadow-[0_18px_44px_rgb(6_50_63/0.35)] {cls}"
	style="background: linear-gradient(180deg, #19b6c6 0%, #0b7f93 52%, #06323f 100%)"
	aria-hidden="true"
>
	<div class="absolute inset-0 opacity-40" style="background: radial-gradient(ellipse at 28% 0%, #fff 0%, transparent 62%)"></div>
	<div class="absolute -top-4 left-[14%] h-[130%] w-10 rotate-[14deg] bg-white/10"></div>
	<div class="absolute -top-4 left-[44%] h-[130%] w-6 rotate-[14deg] bg-white/10"></div>

	{#each bubbles as b (b.x)}
		<span
			class="ambient absolute bottom-6 rounded-full border-2 border-white/80"
			style="left: {b.x}%; width: {b.s}px; height: {b.s}px; animation: bubble-up {b.t}s ease-in {b.d}s infinite"
		></span>
	{/each}

	<svg viewBox="0 0 200 110" class="ambient absolute left-1/2 top-[34%] w-[56%] -translate-x-1/2" style="animation: bob 3.6s ease-in-out infinite">
		<defs>
			<linearGradient id="lagoon-coral" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0" stop-color="#ffc178" />
				<stop offset="1" stop-color="#ff6f61" />
			</linearGradient>
		</defs>
		<path d="M20 55C48 14 112 8 142 55 112 102 48 96 20 55z" fill="url(#lagoon-coral)" />
		<path d="M136 55c14-18 30-28 48-30-8 18-8 42 0 60-18-2-34-12-48-30z" fill="url(#lagoon-coral)" />
		<path d="M82 22c-12 22-12 44 0 66" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="6" stroke-linecap="round" />
		<circle cx="48" cy="48" r="6.5" fill="#06323f" />
		<circle cx="50" cy="45.5" r="2" fill="#fff" />
	</svg>

	<svg viewBox="0 0 400 60" preserveAspectRatio="none" class="absolute inset-x-0 bottom-0 h-12 w-full">
		<path d="M0 30c60-26 120-26 200 0s140 26 200 0v30H0z" fill="#04222c" opacity=".6" />
	</svg>
	<svg viewBox="0 0 60 120" class="absolute bottom-0 left-[8%] h-24">
		<path d="M26 120c-22-34 14-52-4-88-8-17-2-30 8-40 2 20 20 32 14 58-5 24 16 36 2 70z" fill="#5ee0b3" opacity=".85" />
	</svg>
</div>

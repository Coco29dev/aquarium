<script lang="ts">
	import 'uplot/dist/uPlot.min.css';
	import type uPlot from 'uplot';

	interface Props {
		points: { t: number; v: number }[];
		min: number | null;
		max: number | null;
		decimals: number;
	}
	let { points, min, max, decimals }: Props = $props();

	let container: HTMLDivElement;
	let width = $state(320);
	// Incrémenté quand l'iPhone passe du clair au sombre : redessine le graphe avec les bonnes couleurs.
	let scheme = $state(0);

	$effect(() => {
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		const onChange = () => scheme++;
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	$effect(() => {
		const data = points;
		const lo = min;
		const hi = max;
		const w = width;
		const digits = decimals;
		void scheme;
		const css = getComputedStyle(document.documentElement);
		const color = (name: string) => css.getPropertyValue(name).trim();
		const primary = color('--primary');
		const accent = color('--accent');
		const muted = color('--muted');
		const grid = color('--line');
		let plot: uPlot | undefined;
		let cancelled = false;

		import('uplot').then(({ default: uPlot }) => {
			if (cancelled || data.length === 0) return;
			const xs = data.map((p) => p.t / 1000);
			const series: uPlot.Series[] = [
				{},
				{
					stroke: primary,
					width: 2.5,
					points: { size: 7, fill: primary },
					value: (_u, v) => (v == null ? '' : v.toFixed(digits))
				}
			];
			const columns: (number | null)[][] = [xs, data.map((p) => p.v)];
			// Plage acceptable : deux lignes en pointillés.
			for (const bound of [lo, hi]) {
				if (bound == null) continue;
				series.push({ stroke: accent, width: 1, dash: [6, 4], points: { show: false }, label: 'limite' });
				columns.push(xs.map(() => bound));
			}
			plot = new uPlot(
				{
					width: w,
					height: 140,
					cursor: { show: false },
					legend: { show: false },
					scales: { x: { time: true } },
					axes: [
						{ stroke: muted, grid: { stroke: grid }, ticks: { show: false } },
						{ stroke: muted, grid: { stroke: grid }, ticks: { show: false }, size: 44 }
					],
					series
				},
				columns as uPlot.AlignedData,
				container
			);
		});

		return () => {
			cancelled = true;
			plot?.destroy();
		};
	});
</script>

<div bind:this={container} bind:clientWidth={width} class="w-full"></div>

{#if points.length === 0}
	<p class="text-xs text-muted">Pas encore de mesure.</p>
{/if}

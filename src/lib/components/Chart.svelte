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

	$effect(() => {
		const data = points;
		const lo = min;
		const hi = max;
		const w = width;
		const digits = decimals;
		let plot: uPlot | undefined;
		let cancelled = false;

		import('uplot').then(({ default: uPlot }) => {
			if (cancelled || data.length === 0) return;
			const xs = data.map((p) => p.t / 1000);
			const series: uPlot.Series[] = [
				{},
				{
					stroke: '#22d3ee',
					width: 2,
					points: { size: 6, fill: '#22d3ee' },
					value: (_u, v) => (v == null ? '' : v.toFixed(digits))
				}
			];
			const columns: (number | null)[][] = [xs, data.map((p) => p.v)];
			// Plage acceptable : deux lignes en pointillés.
			for (const bound of [lo, hi]) {
				if (bound == null) continue;
				series.push({ stroke: '#f59e0b', width: 1, dash: [6, 4], points: { show: false }, label: 'limite' });
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
						{ stroke: '#94a3b8', grid: { stroke: '#1e293b' }, ticks: { show: false } },
						{ stroke: '#94a3b8', grid: { stroke: '#1e293b' }, ticks: { show: false }, size: 44 }
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
	<p class="text-xs text-slate-500">Pas encore de mesure.</p>
{/if}

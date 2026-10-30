<script lang="ts">
	import 'uplot/dist/uPlot.min.css';
	import type uPlot from 'uplot';

	// Graphe d'un paramètre façon carnet : trait d'encre, points cerclés, bande verte de la plage acceptable.
	interface Props {
		points: { t: number; v: number }[];
		min: number | null;
		max: number | null;
		decimals: number;
		height?: number;
	}
	let { points, min, max, decimals, height = 170 }: Props = $props();

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
		const h = height;
		const digits = decimals;
		void scheme;
		const css = getComputedStyle(document.documentElement);
		const color = (name: string) => css.getPropertyValue(name).trim();
		const ink = color('--ink');
		const surface = color('--surface');
		const ok = color('--ok');
		const bad = color('--bad');
		const muted = color('--muted');
		const grid = color('--line');
		let plot: uPlot | undefined;
		let cancelled = false;

		import('uplot').then(({ default: uPlot }) => {
			if (cancelled || data.length === 0) return;
			const xs = data.map((p) => p.t / 1000);
			const ys = data.map((p) => p.v);
			const outside = (v: number) => (hi != null && v > hi) || (lo != null && v < lo);

			// Échelle verticale : englobe les mesures et la plage, avec un peu d'air.
			const all = [...ys, ...(lo != null ? [lo] : []), ...(hi != null ? [hi] : [])];
			let yMin = Math.min(...all);
			let yMax = Math.max(...all);
			const pad = (yMax - yMin || Math.abs(yMax) || 1) * 0.15;
			yMin = Math.max(0, yMin - pad);
			yMax = yMax + pad;

			const font = '11px "IBM Plex Mono", ui-monospace, monospace';
			const axis = {
				stroke: muted,
				font,
				grid: { stroke: grid, width: 1 },
				ticks: { show: false }
			};

			plot = new uPlot(
				{
					width: w,
					height: h,
					cursor: { show: false },
					legend: { show: false },
					scales: { x: { time: true }, y: { range: [yMin, yMax] } },
					axes: [
						{
							...axis,
							space: 70,
							values: (_u, splits) =>
								splits.map((s) => new Date(s * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', ''))
						},
						{
							...axis,
							size: 46,
							values: (_u, vals) => vals.map((v) => v.toLocaleString('fr-FR', { maximumFractionDigits: digits }))
						}
					],
					series: [
						{},
						{
							stroke: ink,
							width: 2.5,
							points: { show: false },
							value: (_u, v) => (v == null ? '' : v.toFixed(digits))
						}
					],
					hooks: {
						// Bande de la plage acceptable, sous le tracé.
						drawClear: [
							(u) => {
								if (lo == null && hi == null) return;
								const ctx = u.ctx;
								const top = u.valToPos(hi ?? yMax, 'y', true);
								const bottom = u.valToPos(lo ?? yMin, 'y', true);
								ctx.save();
								ctx.fillStyle = ok;
								ctx.globalAlpha = 0.14;
								ctx.fillRect(u.bbox.left, top, u.bbox.width, bottom - top);
								ctx.globalAlpha = 0.55;
								ctx.strokeStyle = ok;
								ctx.lineWidth = 1.5 * devicePixelRatio;
								ctx.setLineDash([5 * devicePixelRatio, 4 * devicePixelRatio]);
								for (const y of [hi != null ? top : null, lo != null ? bottom : null]) {
									if (y == null) continue;
									ctx.beginPath();
									ctx.moveTo(u.bbox.left, y);
									ctx.lineTo(u.bbox.left + u.bbox.width, y);
									ctx.stroke();
								}
								ctx.restore();
							}
						],
						// Points cerclés à l'encre, rouges hors plage, dernier point plus gros.
						draw: [
							(u) => {
								const ctx = u.ctx;
								const r = 3.6 * devicePixelRatio;
								ctx.save();
								ctx.lineWidth = 2 * devicePixelRatio;
								for (let i = 0; i < xs.length; i++) {
									const x = u.valToPos(xs[i], 'x', true);
									const y = u.valToPos(ys[i], 'y', true);
									const last = i === xs.length - 1;
									ctx.beginPath();
									ctx.arc(x, y, last ? r * 1.5 : r, 0, Math.PI * 2);
									ctx.fillStyle = outside(ys[i]) ? bad : last ? ink : surface;
									ctx.strokeStyle = outside(ys[i]) ? bad : ink;
									ctx.fill();
									ctx.stroke();
								}
								ctx.restore();
							}
						]
					}
				},
				[xs, ys] as uPlot.AlignedData,
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
	<p class="hand text-base text-muted">Pas encore de mesure.</p>
{/if}

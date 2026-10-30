<script lang="ts">
	import { fmt } from '$lib/ui';

	/**
	 * Graphe d'un paramètre façon Santé : points reliés d'un trait de couleur, plage acceptable
	 * en bande verte très légère, grille en pointillés avec valeurs à droite, dates en bas.
	 * Glisser le doigt affiche un curseur et une bulle de verre avec la valeur et la date.
	 */
	interface Props {
		points: { t: number; v: number }[];
		min: number | null;
		max: number | null;
		decimals: number;
		height?: number;
		color?: string;
	}
	let { points, min, max, decimals, height = 220, color = 'var(--tint)' }: Props = $props();

	let width = $state(0);
	let active = $state<number | null>(null);

	const top = 16;
	const bottom = 24;
	const right = 40;
	const left = 6;

	/** Graduations « rondes » (1, 2, 5 × 10ⁿ) couvrant [lo, hi]. */
	function niceTicks(lo: number, hi: number, count = 4): number[] {
		const span = hi - lo || Math.abs(hi) || 1;
		const raw = span / count;
		const mag = 10 ** Math.floor(Math.log10(raw));
		const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
		const start = Math.floor(lo / step) * step;
		const ticks: number[] = [];
		for (let v = start; v <= hi + step * 0.5 && ticks.length < 8; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
		return ticks;
	}

	const sorted = $derived([...points].sort((a, b) => a.t - b.t));

	const geo = $derived.by(() => {
		if (!width || sorted.length === 0) return null;
		const vs = sorted.map((p) => p.v);
		let lo = Math.min(...vs, ...(min != null ? [min] : []));
		let hi = Math.max(...vs, ...(max != null ? [max] : []));
		if (hi === lo) {
			hi += 1;
			lo = Math.max(0, lo - 1);
		}
		const ticks = niceTicks(lo, hi);
		lo = Math.min(lo, ticks[0]);
		hi = Math.max(hi, ticks[ticks.length - 1]);
		const t0 = sorted[0].t;
		const t1 = sorted[sorted.length - 1].t;
		const plotW = width - left - right;
		const plotH = height - top - bottom;
		const x = (t: number) => left + (t1 === t0 ? plotW / 2 : ((t - t0) / (t1 - t0)) * plotW);
		const y = (v: number) => top + (1 - (v - lo) / (hi - lo)) * plotH;
		const pts = sorted.map((p) => ({ ...p, x: x(p.t), y: y(p.v) }));
		const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
		const band =
			min != null || max != null
				? { y1: y(Math.min(hi, max ?? hi)), y2: y(Math.max(lo, min ?? lo)) }
				: null;
		// Trois ou quatre dates réparties dans le temps.
		const n = Math.min(4, Math.max(2, Math.floor(plotW / 90)));
		const dates =
			t1 === t0
				? [{ x: x(t0), label: day(t0), anchor: 'middle' }]
				: Array.from({ length: n }, (_, i) => {
						const t = t0 + ((t1 - t0) * i) / (n - 1);
						return { x: x(t), label: day(t), anchor: i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' };
					});
		return { pts, line, band, ticks: ticks.map((v) => ({ v, y: y(v) })), dates, plotW };
	});

	const day = (t: number) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '');
	const out = (v: number) => (max != null && v > max) || (min != null && v < min);

	function pick(e: PointerEvent) {
		if (!geo) return;
		const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
		const px = e.clientX - rect.left;
		let best = 0;
		for (let i = 1; i < geo.pts.length; i++) if (Math.abs(geo.pts[i].x - px) < Math.abs(geo.pts[best].x - px)) best = i;
		active = best;
	}

	const selected = $derived(geo && active != null ? geo.pts[active] : null);
	const bubbleLeft = $derived(selected && geo ? Math.min(Math.max(selected.x, 64), width - 64) : 0);
</script>

<div class="relative w-full select-none" bind:clientWidth={width} style="height: {height}px">
	{#if geo}
		<svg
			{width}
			{height}
			viewBox="0 0 {width} {height}"
			class="block touch-pan-y"
			role="img"
			aria-label="Courbe des mesures"
			onpointerdown={(e) => {
				(e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
				pick(e);
			}}
			onpointermove={(e) => e.buttons && pick(e)}
			onpointerup={() => (active = null)}
			onpointercancel={() => (active = null)}
			onpointerleave={() => (active = null)}
		>
			{#if geo.band}
				<rect x={left} y={geo.band.y1} width={geo.plotW} height={Math.max(1, geo.band.y2 - geo.band.y1)} rx="4" fill="var(--green)" fill-opacity="0.1" />
			{/if}
			{#each geo.ticks as tick (tick.v)}
				<line x1={left} x2={width - right + 4} y1={tick.y} y2={tick.y} stroke="var(--sep)" stroke-width="0.6" stroke-dasharray="2 3" />
				<text x={width - right + 10} y={tick.y + 4} class="fill-label2" font-size="11">{fmt(tick.v, tick.v % 1 ? Math.min(decimals, 2) : 0)}</text>
			{/each}
			{#each geo.dates as d, i (i)}
				<text x={d.x} y={height - 6} text-anchor={d.anchor} class="fill-label2" font-size="11">{d.label}</text>
			{/each}
			{#if geo.pts.length > 1}
				<path d={geo.line} fill="none" stroke={color} stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
			{/if}
			{#each geo.pts as p, i (p.t)}
				<circle cx={p.x} cy={p.y} r={i === active ? 6 : 3.6} fill={out(p.v) ? 'var(--red)' : color} stroke="var(--bg2)" stroke-width="2" />
			{/each}
			{#if selected}
				<line x1={selected.x} x2={selected.x} y1={top - 6} y2={height - bottom} stroke="var(--label3)" stroke-width="1" />
			{/if}
		</svg>
		{#if selected}
			<div
				class="glass pointer-events-none absolute -top-12 -translate-x-1/2 rounded-2xl px-3 py-1.5 text-center"
				style="left: {bubbleLeft}px"
			>
				<p class="rounded-num headline whitespace-nowrap {out(selected.v) ? 'text-red' : ''}">{fmt(selected.v, decimals)}</p>
				<p class="caption2 whitespace-nowrap text-label2">
					{new Date(selected.t).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} ·
					{new Date(selected.t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
				</p>
			</div>
		{/if}
	{:else if points.length === 0}
		<p class="subhead grid h-full place-items-center text-label2">Pas encore de mesure.</p>
	{/if}
</div>

<script lang="ts">
	import { fmt } from '$lib/ui';

	/**
	 * Graphe d'un paramètre façon Santé : points reliés d'un trait de couleur, plage acceptable
	 * en bande verte très légère, grille en pointillés avec valeurs à droite, dates en bas.
	 * Glisser le doigt affiche un curseur et une bulle de verre avec la valeur et la date.
	 * En option : une seconde courbe à comparer (échelle à gauche) et des repères verticaux
	 * (changements d'eau).
	 */
	interface Series {
		points: { t: number; v: number }[];
		color: string;
		label: string;
		decimals: number;
	}
	interface Props {
		points: { t: number; v: number }[];
		min: number | null;
		max: number | null;
		decimals: number;
		height?: number;
		color?: string;
		compare?: Series | null;
		markers?: { t: number; label: string }[];
	}
	let { points, min, max, decimals, height = 220, color = 'var(--tint)', compare = null, markers = [] }: Props = $props();

	let width = $state(0);
	let active = $state<number | null>(null);

	const top = 16;
	const bottom = 24;
	const right = 40;
	const left = $derived(compare ? 38 : 6);
	const NEAR_MS = 24 * 60 * 60 * 1000;

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

	/** Échelle verticale d'une série, élargie aux graduations. */
	function scale(vs: number[], extra: number[], plotH: number) {
		let lo = Math.min(...vs, ...extra);
		let hi = Math.max(...vs, ...extra);
		if (hi === lo) {
			hi += 1;
			lo = Math.max(0, lo - 1);
		}
		const ticks = niceTicks(lo, hi);
		lo = Math.min(lo, ticks[0]);
		hi = Math.max(hi, ticks[ticks.length - 1]);
		const y = (v: number) => top + (1 - (v - lo) / (hi - lo)) * plotH;
		return { ticks, y };
	}

	const sorted = $derived([...points].sort((a, b) => a.t - b.t));
	const sortedCompare = $derived(compare ? [...compare.points].sort((a, b) => a.t - b.t) : []);

	const geo = $derived.by(() => {
		if (!width || sorted.length === 0) return null;
		const all = [...sorted, ...sortedCompare];
		const t0 = Math.min(...all.map((p) => p.t));
		const t1 = Math.max(...all.map((p) => p.t));
		const plotW = width - left - right;
		const plotH = height - top - bottom;
		const x = (t: number) => left + (t1 === t0 ? plotW / 2 : ((t - t0) / (t1 - t0)) * plotW);

		const main = scale(
			sorted.map((p) => p.v),
			[...(min != null ? [min] : []), ...(max != null ? [max] : [])],
			plotH
		);
		const pts = sorted.map((p) => ({ ...p, x: x(p.t), y: main.y(p.v) }));
		const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
		const band =
			min != null || max != null
				? { y1: main.y(Math.min(main.ticks[main.ticks.length - 1], max ?? Infinity)), y2: main.y(Math.max(main.ticks[0], min ?? -Infinity)) }
				: null;

		let second: { pts: { t: number; v: number; x: number; y: number }[]; line: string; ticks: { v: number; y: number }[] } | null = null;
		if (compare && sortedCompare.length) {
			const s = scale(sortedCompare.map((p) => p.v), [], plotH);
			const cpts = sortedCompare.map((p) => ({ ...p, x: x(p.t), y: s.y(p.v) }));
			second = {
				pts: cpts,
				line: cpts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '),
				ticks: s.ticks.map((v) => ({ v, y: s.y(v) }))
			};
		}

		const marks = markers.filter((m) => m.t >= t0 && m.t <= t1).map((m) => ({ ...m, x: x(m.t) }));

		// Trois ou quatre dates réparties dans le temps.
		const n = Math.min(4, Math.max(2, Math.floor(plotW / 90)));
		const dates =
			t1 === t0
				? [{ x: x(t0), label: day(t0), anchor: 'middle' }]
				: Array.from({ length: n }, (_, i) => {
						const t = t0 + ((t1 - t0) * i) / (n - 1);
						return { x: x(t), label: day(t), anchor: i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' };
					});
		return { pts, line, band, ticks: main.ticks.map((v) => ({ v, y: main.y(v) })), dates, plotW, second, marks };
	});

	const day = (t: number) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '');
	const out = (v: number) => (max != null && v > max) || (min != null && v < min);
	const tickLabel = (v: number, d: number) => fmt(v, v % 1 ? Math.min(d, 2) : 0);

	function pick(e: PointerEvent) {
		if (!geo) return;
		const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
		const px = e.clientX - rect.left;
		let best = 0;
		for (let i = 1; i < geo.pts.length; i++) if (Math.abs(geo.pts[i].x - px) < Math.abs(geo.pts[best].x - px)) best = i;
		active = best;
	}

	const selected = $derived(geo && active != null ? geo.pts[active] : null);
	/** Valeur comparée la plus proche dans le temps (à un jour près). */
	const selectedCompare = $derived.by(() => {
		if (!selected || !geo?.second) return null;
		let best: { t: number; v: number } | null = null;
		for (const p of geo.second.pts) if (!best || Math.abs(p.t - selected.t) < Math.abs(best.t - selected.t)) best = p;
		return best && Math.abs(best.t - selected.t) <= NEAR_MS ? best : null;
	});
	/** Repère (changement d'eau) dans le jour qui précède la mesure choisie. */
	const selectedMarker = $derived.by(() => {
		if (!selected) return null;
		return markers.find((m) => m.t <= selected.t + 60 * 60 * 1000 && selected.t - m.t <= NEAR_MS) ?? null;
	});
	const bubbleLeft = $derived(selected && geo ? Math.min(Math.max(selected.x, 78), width - 78) : 0);
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
				<text x={width - right + 10} y={tick.y + 4} class="fill-label2" font-size="11">{tickLabel(tick.v, decimals)}</text>
			{/each}
			{#if geo.second && compare}
				{#each geo.second.ticks as tick (tick.v)}
					<text x={left - 6} y={tick.y + 4} text-anchor="end" font-size="11" fill={compare.color} fill-opacity="0.85">{tickLabel(tick.v, compare.decimals)}</text>
				{/each}
			{/if}
			{#each geo.marks as m (m.t)}
				<line x1={m.x} x2={m.x} y1={top + 4} y2={height - bottom} stroke="var(--cyan)" stroke-width="1.2" stroke-dasharray="3 3" />
				<path
					d="M{m.x} {top - 8}c0 0-4 4.4-4 7.2a4 4 0 0 0 8 0c0-2.8-4-7.2-4-7.2z"
					fill="var(--cyan)"
				/>
			{/each}
			{#each geo.dates as d, i (i)}
				<text x={d.x} y={height - 6} text-anchor={d.anchor} class="fill-label2" font-size="11">{d.label}</text>
			{/each}
			{#if geo.second && compare}
				{#if geo.second.pts.length > 1}
					<path d={geo.second.line} fill="none" stroke={compare.color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.85" />
				{/if}
				{#each geo.second.pts as p (p.t)}
					<circle cx={p.x} cy={p.y} r="2.8" fill={compare.color} stroke="var(--bg2)" stroke-width="1.5" />
				{/each}
			{/if}
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
				class="glass pointer-events-none absolute -translate-x-1/2 rounded-2xl px-3 py-1.5 text-center"
				style="left: {bubbleLeft}px; bottom: calc(100% + 4px)"
			>
				<p class="rounded-num headline whitespace-nowrap {out(selected.v) ? 'text-red' : ''}">
					{fmt(selected.v, decimals)}
					{#if selectedCompare && compare}
						<span class="subhead font-semibold" style="color: {compare.color}"> · {fmt(selectedCompare.v, compare.decimals)}</span>
					{/if}
				</p>
				<p class="caption2 whitespace-nowrap text-label2">
					{new Date(selected.t).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} ·
					{new Date(selected.t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
				</p>
				{#if selectedMarker}
					<p class="caption2 whitespace-nowrap font-semibold text-cyan">{selectedMarker.label}</p>
				{/if}
			</div>
		{/if}
	{:else if points.length === 0}
		<p class="subhead grid h-full place-items-center text-label2">Pas encore de mesure.</p>
	{/if}
</div>

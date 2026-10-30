<script lang="ts">
	// Petite courbe tracée à l'encre, bande de la plage acceptable en fond, dernier point marqué.
	interface Props {
		points: { t: number; v: number }[];
		min?: number | null;
		max?: number | null;
		width?: number;
		height?: number;
		tone?: string;
	}
	let { points, min = null, max = null, width = 96, height = 32, tone = 'var(--ink)' }: Props = $props();

	const pad = 3;
	const geo = $derived.by(() => {
		if (points.length < 2) return null;
		const ts = points.map((p) => p.t);
		const vs = points.map((p) => p.v);
		let lo = Math.min(...vs, ...(min != null ? [min] : []));
		let hi = Math.max(...vs, ...(max != null ? [max] : []));
		if (hi === lo) {
			hi += 1;
			lo -= 1;
		}
		const t0 = Math.min(...ts);
		const t1 = Math.max(...ts) || t0 + 1;
		const x = (t: number) => pad + ((t - t0) / (t1 - t0 || 1)) * (width - pad * 2);
		const y = (v: number) => pad + (1 - (v - lo) / (hi - lo)) * (height - pad * 2);
		const line = points.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
		const band =
			min != null && max != null ? { y: y(max), h: Math.max(1, y(min) - y(max)) } : null;
		const last = points[points.length - 1];
		return { line, band, lx: x(last.t), ly: y(last.v) };
	});
</script>

{#if geo}
	<svg {width} {height} viewBox="0 0 {width} {height}" aria-hidden="true" class="block shrink-0 overflow-visible">
		{#if geo.band}
			<rect x="0" y={geo.band.y} {width} height={geo.band.h} rx="3" fill="var(--ok)" fill-opacity="0.13" />
		{/if}
		<polyline points={geo.line} fill="none" stroke={tone} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
		<circle cx={geo.lx} cy={geo.ly} r="3.2" fill={tone} stroke="var(--surface)" stroke-width="1.5" />
	</svg>
{/if}

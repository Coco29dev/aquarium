<script lang="ts">
	// Mini-courbe façon Santé : trait arrondi de la couleur de la catégorie, dernier point marqué.
	interface Props {
		points: { t: number; v: number }[];
		min?: number | null;
		max?: number | null;
		color?: string;
		width?: number;
		height?: number;
	}
	let { points, min = null, max = null, color = 'var(--tint)', width = 84, height = 36 }: Props = $props();

	const pad = 4;
	const geo = $derived.by(() => {
		if (points.length < 2) return null;
		const vs = points.map((p) => p.v);
		let lo = Math.min(...vs);
		let hi = Math.max(...vs);
		if (max != null && hi > max) lo = Math.min(lo, max);
		if (min != null && lo < min) hi = Math.max(hi, min);
		if (hi === lo) {
			hi += 1;
			lo -= 1;
		}
		const t0 = points[0].t;
		const t1 = points[points.length - 1].t;
		const x = (t: number) => pad + ((t - t0) / (t1 - t0 || 1)) * (width - pad * 2);
		const y = (v: number) => pad + (1 - (v - lo) / (hi - lo)) * (height - pad * 2);
		const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
		const limit = max != null && max < hi && max > lo ? y(max) : null;
		const last = points[points.length - 1];
		return { d, limit, lx: x(last.t), ly: y(last.v) };
	});
</script>

{#if geo}
	<svg {width} {height} viewBox="0 0 {width} {height}" class="block shrink-0 overflow-visible" aria-hidden="true">
		{#if geo.limit != null}
			<line x1="0" x2={width} y1={geo.limit} y2={geo.limit} stroke="var(--label3)" stroke-width="1" stroke-dasharray="2 3" />
		{/if}
		<path d={geo.d} fill="none" stroke={color} stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
		<circle cx={geo.lx} cy={geo.ly} r="4" fill={color} stroke="var(--bg2)" stroke-width="2" />
	</svg>
{/if}

<script lang="ts">
	// Poisson-chirurgien : corps bleu roi, rayures blanches, contour encre, bulles.
	let { size = 48, class: cls = '' }: { size?: number; class?: string } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 64 64" class={cls} aria-hidden="true">
	<defs>
		<clipPath id="logo-body"><ellipse cx="38" cy="35" rx="22" ry="15" /></clipPath>
	</defs>
	<g stroke="var(--ink)" stroke-width="3" stroke-linejoin="round">
		<path d="M17 35L4 22Q8 35 4 48z" fill="var(--primary)" />
		<path d="M30 22Q37 9 47 22z" fill="var(--primary)" />
		<ellipse cx="38" cy="35" rx="22" ry="15" fill="var(--primary)" />
		<g clip-path="url(#logo-body)" stroke-width="2.5">
			<rect x="27" y="0" width="6" height="64" fill="#fff" />
			<rect x="42" y="0" width="5" height="64" fill="#fff" />
		</g>
		<ellipse cx="38" cy="35" rx="22" ry="15" fill="none" />
		<circle cx="52" cy="31" r="3.2" stroke="none" fill="var(--ink)" />
		<circle cx="55" cy="13" r="4.2" stroke-width="2.5" fill="var(--accent)" />
		<circle cx="48" cy="7" r="2.2" stroke-width="2" fill="var(--accent)" />
	</g>
	<circle cx="53" cy="30" r="1" fill="#fff" />
</svg>

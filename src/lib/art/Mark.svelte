<script lang="ts">
	import { FISH } from './fish';

	/**
	 * Marque de Biotope : une bulle devenue poisson, deux bulles qui montent devant sa bouche.
	 * Props : size (px, 29 par défaut), tile (pastille lagon, vrai par défaut), detail (nageoire dorsale,
	 * vrai dès 40 px), class.
	 * Sans tuile, le poisson se pose sur n'importe quel fond (dégradé adapté au thème) et les bulles
	 * prennent la couleur du texte (currentColor).
	 * Sert : accueil, connexion, À propos, en-têtes. Décor : aria-hidden, aucun mouvement.
	 */
	interface Props {
		size?: number;
		tile?: boolean;
		detail?: boolean;
		class?: string;
	}
	let { size = 29, tile = true, detail = size >= 40, class: cls = '' }: Props = $props();
	const uid = $props.id();
	// Sur la pastille (toujours sombre) : dégradé du logo. Posé sur la page : version adaptée au thème.
	const a = $derived(tile ? '#ffc178' : 'var(--art-fish-a, #ffb26b)');
	const b = $derived(tile ? '#ff6f61' : 'var(--art-fish-b, #f25c4e)');
	const ink = $derived(tile ? '#fff' : 'currentColor');
</script>

<svg width={size} height={size} viewBox="0 0 64 64" class="shrink-0 {cls}" aria-hidden="true">
	<defs>
		<linearGradient id="{uid}-f" gradientUnits="userSpaceOnUse" x1="8" y1="12" x2="48" y2="54">
			<stop offset="0" stop-color={a} />
			<stop offset="1" stop-color={b} />
		</linearGradient>
		{#if tile}
			<linearGradient id="{uid}-w" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#22c1d1" />
				<stop offset=".55" stop-color="#0b7f93" />
				<stop offset="1" stop-color="#06323f" />
			</linearGradient>
			<radialGradient id="{uid}-g" cx=".26" cy=".04" r=".9">
				<stop offset="0" stop-color="#fff" stop-opacity=".42" />
				<stop offset="1" stop-color="#fff" stop-opacity="0" />
			</radialGradient>
		{/if}
	</defs>

	{#if tile}
		<rect width="64" height="64" rx="14.4" fill="url(#{uid}-w)" />
		<rect width="64" height="64" rx="14.4" fill="url(#{uid}-g)" />
		<rect x=".5" y=".5" width="63" height="63" rx="13.9" fill="none" stroke="#fff" stroke-opacity=".22" />
	{/if}

	<g transform={tile ? 'translate(32.2 35.5) scale(.9) translate(-31.65 -33)' : 'translate(32 33) scale(1.02) translate(-31.65 -33)'}>
		<!-- queue : deux lobes aux pointes adoucies par le trait -->
		<path d={FISH.tail} fill="url(#{uid}-f)" stroke="url(#{uid}-f)" stroke-width="3" stroke-linejoin="round" />
		{#if detail}
			<path d={FISH.dorsal} fill={b} stroke={b} stroke-width="2" stroke-linejoin="round" />
		{/if}
		<!-- corps : une bulle étirée vers la queue -->
		<path d={FISH.body} fill="url(#{uid}-f)" />
		<path d={FISH.gill} fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2.6" stroke-linecap="round" />
		<circle cx={FISH.eye.x} cy={FISH.eye.y} r={FISH.eye.r} fill="#06323f" />
		<circle cx={FISH.glint.x} cy={FISH.glint.y} r={FISH.glint.r} fill="#fff" />
		<!-- bulles devant la bouche -->
		<circle cx="54.5" cy="18.5" r="4.3" fill="none" stroke={ink} stroke-width="2" />
		<circle cx="48" cy="10" r="2.1" fill={ink} fill-opacity=".92" />
	</g>
</svg>

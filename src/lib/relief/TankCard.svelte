<script lang="ts">
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import FeedChip from '$lib/ios/FeedChip.svelte';
	import { contextMenu } from '$lib/ios/contextMenu';
	import type { Snippet } from 'svelte';

	/**
	 * Carte de bac en hauteur : grand visuel (photo de couverture ou eau teintée qui ondule), valeur vedette
	 * en grand, repères secondaires en pastilles, puis un pied clair avec le nourrissage.
	 */
	interface Stat {
		label: string;
		value: string;
		unit?: string;
	}
	interface Props {
		href: string;
		name: string;
		subtitle: string;
		tone: string;
		icon: IconName;
		coverPhotoId?: number | null;
		/** Valeur vedette (température) et ses unités. */
		big?: { label: string; value: string; unit?: string } | null;
		stats?: Stat[];
		status: { text: string; level: 'ok' | 'warn' | 'bad' | 'cycle' | 'projet'; icon: IconName };
		/** Pied de carte : nourrissage d'un bac (id), ou contenu libre. */
		feedFor?: number;
		menu?: Parameters<typeof contextMenu>[1];
		footer?: Snippet;
		/** Pleine largeur (liste) au lieu d'une carte de carrousel. */
		wide?: boolean;
	}
	let { href, name, subtitle, tone, icon, coverPhotoId = null, big = null, stats = [], status, feedFor, menu, footer, wide = false }: Props = $props();

	let photoOk = $state(true);
	const dot = { ok: 'var(--green)', warn: 'var(--orange)', bad: 'var(--red)', cycle: 'var(--indigo)', projet: 'var(--orange)' } as const;
	const WAVE = 'M0 30 C 100 8 200 8 300 30 S 500 52 600 30 C 700 8 800 8 900 30 S 1100 52 1200 30 V80 H0 Z';
</script>

<a {href} class="pressable lifted relative flex shrink-0 flex-col overflow-hidden {wide ? 'w-full' : 'w-[72%] max-w-[17.5rem] snap-start'}" use:contextMenu={menu ?? { items: [] }}>
	<div class="relative isolate flex min-h-[15.5rem] flex-col p-4 text-white" style="--tone: {tone}; background: linear-gradient(165deg, color-mix(in srgb, {tone} 92%, white) 0%, color-mix(in srgb, {tone} 62%, black) 100%)">
		{#if coverPhotoId && photoOk}
			<img src="/api/photos/{coverPhotoId}" alt="" class="absolute inset-0 -z-10 h-full w-full object-cover" onerror={() => (photoOk = false)} loading="lazy" />
			<div class="absolute inset-0 -z-10" style="background: linear-gradient(180deg, rgb(0 0 0 / 0.28) 0%, rgb(0 0 0 / 0.05) 38%, rgb(0 0 0 / 0.72) 100%)"></div>
		{:else}
			<span class="pointer-events-none absolute -right-4 -top-3 -z-10 opacity-[0.14]" style="--cut: transparent"><Icon name={icon} size={130} filled weight={1.3} /></span>
			<svg class="ambient pointer-events-none absolute -bottom-px left-0 -z-10 h-14 w-[200%]" style="animation: wave-x 16s linear infinite" viewBox="0 0 1200 80" preserveAspectRatio="none" aria-hidden="true">
				<path d={WAVE} fill="rgb(255 255 255 / 0.14)" />
			</svg>
		{/if}

		<div class="flex items-start gap-2">
			<div class="min-w-0 flex-1">
				<p class="headline truncate drop-shadow-sm">{name}</p>
				<p class="footnote truncate text-white/80">{subtitle}</p>
			</div>
			<span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/20 backdrop-blur-md" style="--cut: transparent"><Icon name={icon} size={17} filled weight={1.7} /></span>
		</div>

		<div class="mt-auto pt-6">
			{#if big}
				<p class="caption1 font-semibold uppercase tracking-wide text-white/75">{big.label}</p>
				<p class="rounded-num leading-none drop-shadow-sm">
					<span class="text-[54px] font-bold tracking-tight">{big.value}</span>
					{#if big.unit}<span class="title3 font-semibold text-white/80">{big.unit}</span>{/if}
				</p>
			{/if}
			{#if stats.length}
				<div class="mt-3 flex flex-wrap gap-1.5">
					{#each stats as s (s.label)}
						<span class="rounded-full bg-white/20 px-2.5 py-1 backdrop-blur-md">
							<span class="caption2 font-semibold text-white/75">{s.label}</span>
							<span class="rounded-num footnote font-bold"> {s.value}{s.unit ? ` ${s.unit}` : ''}</span>
						</span>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<div class="bg-bg2 px-4 pb-3 pt-2.5">
		<p class="footnote flex items-center gap-1.5 font-semibold" style="color: {dot[status.level]}">
			<Icon name={status.icon} size={15} weight={2.6} />
			<span class="truncate">{status.text}</span>
		</p>
		{#if feedFor != null}
			<div class="mt-2 pt-2 shadow-[inset_0_0.5px_0_var(--sep)]"><FeedChip aquariumId={feedFor} compact /></div>
		{:else if footer}
			<div class="mt-2 pt-2 shadow-[inset_0_0.5px_0_var(--sep)]">{@render footer()}</div>
		{/if}
	</div>
</a>

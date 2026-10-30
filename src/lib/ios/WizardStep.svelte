<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';

	/**
	 * Une étape d'assistant : pastille d'icône colorée, grand titre, phrase d'explication, contenu.
	 * Le contenu glisse depuis la droite en avançant, depuis la gauche en revenant en arrière.
	 */
	interface Props {
		title: string;
		subtitle?: string;
		icon?: IconName;
		/** Couleur de la pastille d'icône (variable CSS). */
		tone?: string;
		direction?: 'forward' | 'back';
		children: Snippet;
	}
	let { title, subtitle, icon, tone = 'var(--blue)', direction = 'forward', children }: Props = $props();
</script>

<div class="wiz {direction}">
	<div class="mb-5">
		{#if icon}
			<span class="mb-3 grid h-14 w-14 place-items-center rounded-[16px] text-white" style="background: {tone}; --cut: {tone}">
				<Icon name={icon} size={30} filled weight={1.7} />
			</span>
		{/if}
		<h2 class="title1">{title}</h2>
		{#if subtitle}<p class="body mt-1.5 text-label2">{subtitle}</p>{/if}
	</div>
	{@render children()}
</div>

<style>
	.wiz {
		animation: wiz-forward 340ms cubic-bezier(0.32, 0.72, 0, 1) both;
	}
	.wiz.back {
		animation-name: wiz-back;
	}
	@keyframes wiz-forward {
		from {
			opacity: 0;
			transform: translateX(28px);
		}
	}
	@keyframes wiz-back {
		from {
			opacity: 0;
			transform: translateX(-28px);
		}
	}
</style>

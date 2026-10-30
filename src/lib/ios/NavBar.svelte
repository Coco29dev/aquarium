<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';

	/**
	 * Barre de navigation iOS : grand titre dans le contenu qui, au défilement, se replie
	 * en titre centré dans une barre de verre. Bouton retour « ‹ Précédent » en couleur d'accent.
	 */
	interface Props {
		title: string;
		/** Lien de retour et libellé (titre de l'écran précédent). */
		back?: { href: string; label: string };
		/** false : barre compacte uniquement (écrans de détail). */
		large?: boolean;
		leading?: Snippet;
		trailing?: Snippet;
		/** Sous le grand titre : recherche, contrôle segmenté… */
		children?: Snippet;
		/** Couleur de fond derrière le grand titre (bandeau d'un bac). */
		tone?: string;
		/** Petite ligne au-dessus du grand titre (date, contexte), façon Forme ou News. */
		kicker?: string;
	}
	let { title, back, large = true, leading, trailing, children, tone, kicker }: Props = $props();

	let heading = $state<HTMLElement>();
	let bar = $state<HTMLElement>();
	let scrolled = $state(false);
	let collapsed = $state(false);

	$effect(() => {
		const update = () => {
			scrolled = window.scrollY > 2;
			if (!large || !heading) {
				collapsed = true;
				return;
			}
			// Replié dès que le grand titre passe sous la barre.
			collapsed = heading.getBoundingClientRect().bottom < (bar?.getBoundingClientRect().bottom ?? 44);
		};
		update();
		addEventListener('scroll', update, { passive: true });
		return () => removeEventListener('scroll', update);
	});
</script>

<div
	bind:this={bar}
	class="sticky top-0 z-20 -mx-4 transition-[background-color,box-shadow] duration-200 {scrolled ? 'bar-material shadow-[0_0.5px_0_var(--sep)]' : ''}"
	style="padding-top: env(safe-area-inset-top); {tone && !scrolled ? `background: ${tone}` : ''}"
>
	<div class="grid h-11 grid-cols-[1fr_auto_1fr] items-center px-2">
		<div class="flex min-w-0 items-center">
			{#if back}
				<a href={back.href} data-nav="pop" class="btn-plain -ml-0.5 flex min-w-0 items-center gap-0.5 pr-2">
					<Icon name="back" size={26} weight={2.4} />
					<span class="truncate">{back.label}</span>
				</a>
			{/if}
			{#if leading}{@render leading()}{/if}
		</div>
		<p
			class="headline max-w-[56vw] truncate text-center transition-opacity duration-200 {collapsed || !large ? 'opacity-100' : 'opacity-0'}"
			aria-hidden={large}
		>
			{title}
		</p>
		<div class="flex items-center justify-end gap-1 pr-1">
			{#if trailing}{@render trailing()}{/if}
		</div>
	</div>
</div>

{#if large}
	<div class="-mx-4 px-4 pb-2 pt-0.5" style={tone ? `background: ${tone}` : ''}>
		{#if kicker}<p class="footnote font-semibold uppercase text-label2">{kicker}</p>{/if}
		<h1 bind:this={heading} class="large-title break-words">{title}</h1>
		{#if children}<div class="mt-2">{@render children()}</div>{/if}
	</div>
{:else if children}
	<div class="pb-2">{@render children()}</div>
{/if}

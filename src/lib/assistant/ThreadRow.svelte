<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import SwipeRow from '$lib/ios/SwipeRow.svelte';
	import { contextMenu } from '$lib/ios/contextMenu';
	import { threadLabel, threadWhen, type ThreadSummary } from '$lib/domain/assistant';
	import { WATER } from '$lib/art/fish';
	import type { Aquarium } from '$lib/types';

	/**
	 * Une conversation dans la liste : pastille aux couleurs de l'eau du bac, titre, début du premier message,
	 * bac · messages · photos, heure. Un glissement vers la gauche révèle Renommer et Supprimer (jusqu'au bout :
	 * suppression, comme Mail), un appui long ouvre le même choix dans un menu. En mode sélection, un rond
	 * remplace les gestes et toucher la ligne la coche. À placer dans un <Section>.
	 */
	interface Props {
		thread: ThreadSummary;
		tank?: Aquarium;
		current: boolean;
		selecting: boolean;
		selected: boolean;
		onopen: () => void;
		ontoggle: () => void;
		onrename: () => void;
		ondelete: () => void;
	}
	let { thread: t, tank, current, selecting, selected, onopen, ontoggle, onrename, ondelete }: Props = $props();

	const label = $derived(threadLabel(t));
	// Sans titre, le début du premier message sert déjà de titre : on ne le répète pas dessous.
	const preview = $derived(t.title?.trim() ? t.preview.trim() : '');
	// Eau du bac, assombrie vers le fond : l'icône blanche reste lisible sur le vert menthe comme sur le lagon.
	const color = $derived(tank ? WATER[tank.waterType] : 'var(--gray)');
	const fill = $derived(`linear-gradient(160deg, ${color}, color-mix(in srgb, ${color} 45%, var(--art-abysse, #06323f)))`);
	const meta = $derived(
		[
			tank?.name ?? 'Bac supprimé',
			`${t.messages} message${t.messages > 1 ? 's' : ''}`,
			t.images ? `${t.images} photo${t.images > 1 ? 's' : ''}` : null
		]
			.filter(Boolean)
			.join(' · ')
	);
	const menu = $derived({
		items: selecting
			? []
			: [
					{ label: 'Renommer', icon: 'edit' as const, onselect: onrename },
					{ label: 'Supprimer', icon: 'trash' as const, destructive: true, onselect: ondelete }
				]
	});
</script>

<SwipeRow
	trailing={selecting
		? []
		: [
				{ label: 'Supprimer', icon: 'trash', color: 'var(--red)', onaction: ondelete },
				{ label: 'Renommer', icon: 'edit', color: 'var(--indigo)', onaction: onrename }
			]}
>
	<button
		type="button"
		class="tappable flex w-full items-center gap-3 pl-4 text-left"
		onclick={selecting ? ontoggle : onopen}
		aria-current={current ? 'true' : undefined}
		aria-pressed={selecting ? selected : undefined}
		use:contextMenu={menu}
	>
		{#if selecting}
			<span
				class="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors duration-150 {selected ? 'border-tint bg-tint text-on-tint' : 'border-label3 text-transparent'}"
				aria-hidden="true"
			>
				<Icon name="check" size={14} weight={3.2} />
			</span>
		{/if}
		<span
			class="relative grid h-10 w-10 shrink-0 place-items-center self-start rounded-full text-white {current ? 'ring-2 ring-tint ring-offset-2 ring-offset-bg2' : ''}"
			style="background: {fill}; margin-top: 0.75rem"
			aria-hidden="true"
		>
			<Icon name="chat" size={20} filled weight={2} />
		</span>
		<span class="row-body flex min-w-0 flex-1 items-start gap-2 py-3 pr-4">
			<span class="min-w-0 flex-1">
				<span class="body block truncate font-semibold">{label}</span>
				{#if preview}<span class="subhead block truncate text-label2">{preview}</span>{/if}
				<span class="caption1 block truncate text-label2">{meta}</span>
			</span>
			<span class="footnote shrink-0 pt-0.5 {current ? 'font-semibold text-tint' : 'text-label2'}">{threadWhen(t.updatedAt)}</span>
		</span>
	</button>
</SwipeRow>

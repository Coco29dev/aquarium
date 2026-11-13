<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import Spinner from '$lib/ios/Spinner.svelte';
	import { MAX_IMAGES } from '$lib/domain/assistant';

	/**
	 * Zone de saisie de l'assistant, fixée en bas : photo, message, envoi. Capsule de verre qui s'agrandit avec
	 * le texte (six lignes au plus). Pendant qu'il répond, on peut déjà écrire la suite ; seul l'envoi attend.
	 * Props : draft (lié), attachments (photos jointes, id null = envoi en cours), working, ready, remaining,
	 * height (liée : hauteur mesurée, pour que la conversation laisse la place), onsend, onpick, onremove.
	 * Méthodes : focus(), openPicker().
	 */
	interface Attachment {
		key: string;
		preview: string;
		id: number | null;
	}
	interface Props {
		draft: string;
		attachments: Attachment[];
		working: boolean;
		ready: boolean;
		remaining: number | null;
		height?: number;
		onsend: () => void;
		onpick: (files: File[]) => void;
		onremove: (entry: Attachment) => void;
	}
	let { draft = $bindable(), attachments, working, ready, remaining, height = $bindable(0), onsend, onpick, onremove }: Props = $props();

	let input = $state<HTMLTextAreaElement>();
	let files = $state<HTMLInputElement>();

	export const focus = () => input?.focus();
	export const openPicker = () => files?.click();
	/** Remet la zone à sa hauteur d'une ligne (après un envoi). */
	export const reset = () => {
		if (input) input.style.height = '';
	};

	function grow() {
		if (!input) return;
		input.style.height = 'auto';
		input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
	}

	function onKey(event: KeyboardEvent) {
		// Entrée envoie sur ordinateur ; sur iPhone, Entrée reste un retour à la ligne.
		if (event.key === 'Enter' && !event.shiftKey && !/iPhone|iPad/.test(navigator.userAgent)) {
			event.preventDefault();
			if (ready) onsend();
		}
	}

	const nearLimit = $derived(draft.length > 3500);
</script>

<div class="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md px-3 pt-2" style="padding-bottom: max(env(safe-area-inset-bottom), 10px)" bind:clientHeight={height}>
	<!-- Voile de fondu : la conversation passe sous la zone de saisie sans être coupée net. -->
	<div class="pointer-events-none absolute inset-x-0 -top-6 bottom-0 -z-10" style="background: linear-gradient(to bottom, transparent, var(--bg) 38%)" aria-hidden="true"></div>

	{#if attachments.length}
		<div class="mb-2 flex gap-2 overflow-x-auto px-1 pt-2" aria-label="Photos jointes">
			{#each attachments as a (a.key)}
				<div class="relative h-16 w-16 shrink-0">
					<img src={a.preview} alt="Pièce jointe" class="h-16 w-16 rounded-[14px] object-cover {a.id === null ? 'opacity-50' : ''}" />
					{#if a.id === null}<span class="absolute inset-0 grid place-items-center" role="status" aria-label="Envoi de la photo"><Spinner spinning size={22} /></span>{/if}
					<button class="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-label2 text-bg2" onclick={() => onremove(a)} aria-label="Retirer la photo">
						<Icon name="close" size={13} weight={3} />
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<form
		class="glass flex items-end gap-1.5 rounded-[28px] p-1.5"
		onsubmit={(e) => {
			e.preventDefault();
			if (ready) onsend();
		}}
	>
		<input bind:this={files} type="file" accept="image/*" multiple class="hidden" onchange={(e) => {
			const target = e.currentTarget;
			onpick([...(target.files ?? [])]);
			target.value = '';
		}} />
		<button
			type="button"
			class="pressable grid h-10 w-10 shrink-0 place-items-center rounded-full text-tint disabled:opacity-40"
			onclick={() => files?.click()}
			disabled={attachments.length >= MAX_IMAGES}
			aria-label="Joindre une photo"
		>
			<Icon name="photo" size={24} />
		</button>
		<textarea
			bind:this={input}
			bind:value={draft}
			oninput={grow}
			onkeydown={onKey}
			rows="1"
			maxlength="4000"
			placeholder="Écris à l’assistant"
			aria-label="Message"
			enterkeyhint="send"
			class="body max-h-36 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 outline-none placeholder:text-label2"
		></textarea>
		<button
			type="submit"
			class="pressable grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors duration-200 {ready ? 'bg-tint text-on-tint' : 'bg-fill3 text-label3'}"
			disabled={!ready}
			aria-label={working ? 'Réponse en cours' : 'Envoyer'}
		>
			{#if working}
				<span class="busy" aria-hidden="true"><Spinner spinning size={22} /></span>
			{:else}
				<Icon name="up" size={21} weight={2.6} />
			{/if}
		</button>
	</form>
	{#if nearLimit}
		<p class="caption1 px-4 pt-1 text-right text-label2">{draft.length} / 4000</p>
	{:else if remaining !== null && remaining <= 10}
		<p class="caption1 px-4 pt-1 text-center text-label2">{remaining} message{remaining > 1 ? 's' : ''} restant{remaining > 1 ? 's' : ''} aujourd’hui</p>
	{/if}
</div>

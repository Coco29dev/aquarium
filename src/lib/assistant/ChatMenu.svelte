<script lang="ts">
	import Sheet from '$lib/ios/Sheet.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';

	/**
	 * Menu de la conversation affichée (bouton « … » de l'en-tête) : renommer, parcourir les autres, en
	 * commencer une nouvelle, ou la supprimer avec ses photos. `hasThread` est faux tant que rien n'a été
	 * envoyé : il n'y a alors rien à renommer ni à supprimer. `busy` : une réponse est en cours.
	 */
	interface Props {
		open: boolean;
		hasThread: boolean;
		busy: boolean;
		photos: number;
		onclose: () => void;
		onrename: () => void;
		onlist: () => void;
		onnew: () => void;
		ondelete: () => void;
	}
	let { open, hasThread, busy, photos, onclose, onrename, onlist, onnew, ondelete }: Props = $props();

	/** Referme la feuille puis lance l'action, une fois sa sortie commencée. */
	const run = (action: () => void) => () => {
		onclose();
		setTimeout(action, 80);
	};
</script>

<Sheet {open} title="Conversation" detent="medium" cancelLabel="Fermer" {onclose}>
	<Section>
		<Row icon="history" iconColor="var(--tint)" title="Toutes les conversations" onclick={run(onlist)} chevron />
		<Row icon="edit" iconColor="var(--blue)" title="Nouvelle conversation" onclick={run(onnew)} disabled={!hasThread || busy} />
		<Row icon="note" iconColor="var(--indigo)" title="Renommer" onclick={run(onrename)} disabled={!hasThread} />
	</Section>
	<Section
		footer={!hasThread
			? 'Envoie un premier message : la conversation pourra alors être renommée ou supprimée.'
			: busy
				? 'Une réponse est en cours : attends sa fin pour supprimer.'
				: photos
					? `La conversation et ses ${photos} photo${photos > 1 ? 's' : ''} seront supprimées définitivement.`
					: 'La conversation sera supprimée définitivement.'}
	>
		<Row icon="trash" iconColor="var(--red)" title="Supprimer la conversation" destructive onclick={run(ondelete)} disabled={!hasThread || busy} />
	</Section>
</Sheet>

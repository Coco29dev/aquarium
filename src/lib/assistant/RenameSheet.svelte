<script lang="ts">
	import Sheet from '$lib/ios/Sheet.svelte';
	import Section from '$lib/ios/Section.svelte';
	import { threads } from './threads.svelte';

	/**
	 * Feuille « Renommer » : un champ, « Enregistrer ». Un titre vidé redonne le titre automatique (le début
	 * du premier message). `target` est la conversation à renommer, ou null (feuille fermée).
	 */
	interface Props {
		target: { id: number; title: string | null } | null;
		onclose: () => void;
		onsaved?: (id: number, title: string) => void;
	}
	let { target, onclose, onsaved }: Props = $props();

	let value = $state('');
	let saving = $state(false);
	let field = $state<HTMLInputElement>();

	// À chaque ouverture, le champ repart du titre actuel, sélectionné pour être remplacé d'un geste.
	$effect(() => {
		if (!target) return;
		value = target.title ?? '';
		setTimeout(() => {
			field?.focus();
			field?.select();
		}, 340);
	});

	async function save() {
		const t = target;
		if (!t || saving) return;
		saving = true;
		const ok = await threads.rename(t.id, value);
		saving = false;
		if (!ok) return;
		onsaved?.(t.id, value.trim().slice(0, 80));
		onclose();
	}
</script>

<Sheet open={target !== null} title="Renommer" detent="medium" cancelLabel="Annuler" {onclose} action={{ label: 'Enregistrer', onclick: save, disabled: saving }}>
	<Section footer="Laisse le champ vide pour reprendre le titre automatique.">
		<li class="px-4">
			<form
				onsubmit={(e) => {
					e.preventDefault();
					void save();
				}}
			>
				<input
					bind:this={field}
					bind:value
					maxlength="80"
					enterkeyhint="done"
					placeholder="Titre de la conversation"
					aria-label="Titre de la conversation"
					class="body h-12 w-full bg-transparent outline-none placeholder:text-label3"
				/>
			</form>
		</li>
	</Section>
</Sheet>

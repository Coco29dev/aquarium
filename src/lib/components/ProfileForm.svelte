<script lang="ts">
	import Icon from './Icon.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { ACCENTS, INTERESTS, LEVELS } from '$lib/domain/profile';

	/**
	 * Quatre questions pour que Biotope te ressemble : prénom, niveau, centre d'intérêt, couleur.
	 * Chaque choix est enregistré tout de suite (aucun bouton « Valider »).
	 * `bare` : sans titres de section (l'écran d'accueil pose ses propres titres).
	 */
	interface Props {
		bare?: boolean;
	}
	let { bare = false }: Props = $props();

	let name = $state(ui.profile.name);
	let timer: ReturnType<typeof setTimeout> | undefined;
	function typing() {
		clearTimeout(timer);
		timer = setTimeout(() => void ui.setProfile({ name }), 500);
	}
	const label = 'footnote mb-2 mt-6 px-4 font-semibold uppercase tracking-wide text-label2';
</script>

<div>
	<h3 class={bare ? 'sr-only' : label} style={bare ? '' : 'margin-top: 0'}>Comment t’appeler ?</h3>
	<div class="group px-4">
		<input
			class="body w-full bg-transparent py-3 outline-none placeholder:text-label3"
			placeholder="Ton prénom"
			maxlength="30"
			autocomplete="given-name"
			aria-label="Ton prénom"
			bind:value={name}
			oninput={typing}
			onblur={() => ui.setProfile({ name })}
		/>
	</div>

	<h3 class={label}>Ton niveau</h3>
	<div class="group" role="radiogroup" aria-label="Ton niveau">
		{#each LEVELS as l, i (l.value)}
			{@const on = ui.profile.level === l.value}
			<button
				type="button"
				role="radio"
				aria-checked={on}
				class="tappable flex w-full items-center gap-3 px-4 py-3 text-left"
				style={i ? 'box-shadow: inset 0 0.5px 0 var(--sep)' : ''}
				onclick={() => ui.setProfile({ level: l.value })}
			>
				<span class="min-w-0 flex-1">
					<span class="body block">{l.label}</span>
					<span class="footnote block text-label2">{l.hint}</span>
				</span>
				{#if on}<span class="text-tint"><Icon name="check" size={20} weight={2.8} /></span>{/if}
			</button>
		{/each}
	</div>

	<h3 class={label}>Ce qui te passionne</h3>
	<div class="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Ce qui te passionne">
		{#each INTERESTS as it (it.value)}
			{@const on = ui.profile.interest === it.value}
			<button
				type="button"
				role="radio"
				aria-checked={on}
				class="pressable flex flex-col items-start gap-2 rounded-[18px] bg-bg2 p-3.5 text-left transition-shadow {on ? 'shadow-[inset_0_0_0_2px_var(--tint)]' : ''}"
				onclick={() => ui.setProfile({ interest: it.value })}
			>
				<span class={on ? 'text-tint' : 'text-label2'} style="--cut: var(--bg2)"><Icon name={it.icon} size={26} filled weight={1.7} /></span>
				<span class="subhead font-semibold">{it.label}</span>
			</button>
		{/each}
	</div>

	<h3 class={label}>Ta couleur</h3>
	<div class="flex items-center justify-between gap-2 rounded-[18px] bg-bg2 px-4 py-3.5" role="radiogroup" aria-label="Couleur d’accent">
		{#each ACCENTS as a (a.id)}
			{@const on = ui.profile.accent === a.id}
			<button
				type="button"
				role="radio"
				aria-checked={on}
				aria-label={a.label}
				class="flex flex-col items-center gap-1.5"
				onclick={() => ui.setProfile({ accent: a.id })}
			>
				<span
					class="grid h-10 w-10 place-items-center rounded-full text-white transition-transform duration-200 {on ? 'scale-110 shadow-[0_0_0_3px_var(--bg2),0_0_0_5px_var(--label3)]' : ''}"
					style="background: {a.swatch}"
				>
					{#if on}<Icon name="check" size={18} weight={3} />{/if}
				</span>
				<span class="caption2 {on ? 'font-semibold' : 'text-label2'}">{a.label}</span>
			</button>
		{/each}
	</div>
</div>

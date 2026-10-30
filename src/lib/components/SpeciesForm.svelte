<script lang="ts">
	import { api, toNumber, toText } from '$lib/client/api';
	import Section from '$lib/ios/Section.svelte';
	import InputRow from '$lib/ios/InputRow.svelte';
	import Switch from '$lib/ios/Switch.svelte';
	import { KIND_LABELS, type Species } from '$lib/types';

	// Formulaire d'espèce en listes groupées ; il s'envoie par le bouton de la feuille (formId).
	interface Props {
		species?: Species;
		formId: string;
		onsaved: (id: number) => void;
		onbusy?: (busy: boolean) => void;
	}
	let { species, formId, onsaved, onbusy }: Props = $props();

	const isNew = $derived(!species);
	const editable = $derived(isNew || species?.source === 'maison');
	let message = $state('');

	const est = (key: string) => species?.estimated.includes(key);
	const str = (v: number | string | null | undefined) => (v == null ? '' : String(v).replace('.', ','));

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const f = new FormData(event.currentTarget as HTMLFormElement);
		const reef = String(f.get('reefSafe'));
		const body: Record<string, unknown> = {
			nameFr: toText(f.get('nameFr')),
			nameEn: toText(f.get('nameEn')),
			maxLengthCm: toNumber(f.get('maxLengthCm')),
			tempMin: toNumber(f.get('tempMin')),
			tempMax: toNumber(f.get('tempMax')),
			phMin: toNumber(f.get('phMin')),
			phMax: toNumber(f.get('phMax')),
			minTankL: toNumber(f.get('minTankL')),
			temperament: toText(f.get('temperament')),
			diet: toText(f.get('diet')),
			zone: toText(f.get('zone')),
			groupMin: toNumber(f.get('groupMin')),
			reefSafe: reef === 'oui' ? true : reef === 'non' ? false : null,
			bioloadG: toNumber(f.get('bioloadG')),
			notes: toText(f.get('notes')),
			description: toText(f.get('description'))
		};
		if (editable) {
			Object.assign(body, {
				scientificName: toText(f.get('scientificName')),
				kind: String(f.get('kind')),
				fresh: f.get('fresh') === 'on',
				brackish: f.get('brackish') === 'on',
				salt: f.get('salt') === 'on',
				lifespanYears: toNumber(f.get('lifespanYears'))
			});
		}
		onbusy?.(true);
		message = '';
		try {
			if (species) {
				await api('PATCH', `/api/species/${species.id}`, body);
				onsaved(species.id);
			} else {
				const { id } = await api<{ id: number }>('POST', '/api/species', body);
				onsaved(id);
			}
		} catch (e) {
			message = (e as Error).message;
		} finally {
			onbusy?.(false);
		}
	}
</script>

{#snippet select(label: string, name: string, current: string, options: [string, string][], hint?: boolean)}
	<li>
		<label class="flex min-h-11 items-center gap-3 pl-4">
			<span class="row-body flex min-h-11 min-w-0 flex-1 items-center gap-2 py-1.5 pr-4">
				<span class="body min-w-0 flex-1 truncate">{label}{#if hint}<span class="footnote ml-1.5 text-orange">estimé</span>{/if}</span>
				<select {name} class="body max-w-[55%] appearance-none bg-transparent text-right text-label2 outline-none">
					{#each options as [value, text] (value)}<option {value} selected={current === value}>{text}</option>{/each}
				</select>
				<svg class="shrink-0 text-label3" width="9" height="14" viewBox="0 0 9 14" aria-hidden="true"><path d="M1.5 5L4.5 2l3 3M1.5 9l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
			</span>
		</label>
	</li>
{/snippet}

{#snippet toggle(label: string, name: string, checked: boolean)}
	<li>
		<label class="flex min-h-11 items-center gap-3 pl-4">
			<span class="row-body flex min-h-11 min-w-0 flex-1 items-center gap-2 py-1.5 pr-4">
				<span class="body min-w-0 flex-1">{label}</span>
				<Switch {name} {checked} label={label} />
			</span>
		</label>
	</li>
{/snippet}

<form id={formId} onsubmit={submit} class="species-form">
	{#if message}<p class="subhead mb-4 rounded-2xl bg-red/12 px-4 py-3 text-red" role="alert">{message}</p>{/if}

	<Section header="Identité">
		{#if editable}
			<InputRow label="Nom scientifique" name="scientificName" value={species?.scientificName ?? ''} required wide italic />
		{/if}
		<InputRow label="Nom français" name="nameFr" value={species?.nameFr ?? ''} placeholder="Facultatif" />
		<InputRow label="Nom anglais" name="nameEn" value={species?.nameEn ?? ''} placeholder="Facultatif" />
		{#if editable}
			{@render select('Type', 'kind', species?.kind ?? 'poisson', Object.entries(KIND_LABELS))}
			<InputRow label="Durée de vie" name="lifespanYears" value={str(species?.lifespanYears)} inputmode="decimal" unit="ans" />
		{/if}
	</Section>

	{#if editable}
		<Section header="Eau">
			{@render toggle('Eau douce', 'fresh', species?.fresh ?? true)}
			{@render toggle('Eau saumâtre', 'brackish', species?.brackish ?? false)}
			{@render toggle('Eau de mer', 'salt', species?.salt ?? false)}
		</Section>
	{/if}

	<Section header="Conditions">
		<InputRow label="Température min." name="tempMin" value={str(species?.tempMin)} inputmode="decimal" unit="°C" />
		<InputRow label="Température max." name="tempMax" value={str(species?.tempMax)} inputmode="decimal" unit="°C" />
		<InputRow label="pH min." name="phMin" value={str(species?.phMin)} inputmode="decimal" />
		<InputRow label="pH max." name="phMax" value={str(species?.phMax)} inputmode="decimal" />
		<InputRow label="Taille adulte" name="maxLengthCm" value={str(species?.maxLengthCm)} inputmode="decimal" unit="cm" />
		<InputRow label="Bac minimum" name="minTankL" value={str(species?.minTankL)} inputmode="numeric" unit="L" />
		<InputRow label="Groupe minimum{est('groupMin') ? ' (estimé)' : ''}" name="groupMin" value={str(species?.groupMin)} inputmode="numeric" />
	</Section>

	<Section header="Comportement" footer="Charge biologique : poids adulte en grammes. Vide, elle est estimée d’après la taille.">
		{@render select('Tempérament', 'temperament', species?.temperament ?? '', [['', 'À renseigner'], ['paisible', 'Paisible'], ['semi-agressif', 'Semi-agressif'], ['agressif', 'Agressif']])}
		{@render select('Régime', 'diet', species?.diet ?? '', [['', 'À renseigner'], ['carnivore', 'Carnivore'], ['omnivore', 'Omnivore'], ['herbivore', 'Herbivore'], ['filtreur', 'Filtreur'], ['autre', 'Autre']], est('diet'))}
		{@render select('Zone du bac', 'zone', species?.zone ?? '', [['', 'À renseigner'], ['haut', 'Haut'], ['milieu', 'Milieu'], ['bas', 'Bas'], ['tous', 'Partout']], est('zone'))}
		{@render select('Compatible récif', 'reefSafe', species?.reefSafe === true ? 'oui' : species?.reefSafe === false ? 'non' : '', [['', 'Inconnu'], ['oui', 'Oui'], ['non', 'Non']])}
		<InputRow label="Charge biologique" name="bioloadG" value={str(species?.bioloadG)} inputmode="decimal" unit="g" />
	</Section>

	<Section header="Description">
		<li class="px-4 py-2.5">
			<textarea name="description" rows="4" maxlength="2000" placeholder="Ce qu’il faut savoir sur l’espèce" class="body w-full resize-none bg-transparent outline-none placeholder:text-label3">{species?.description ?? ''}</textarea>
		</li>
	</Section>
	<Section header="Notes d’élevage">
		<li class="px-4 py-2.5">
			<textarea name="notes" rows="3" maxlength="2000" placeholder="Tes observations" class="body w-full resize-none bg-transparent outline-none placeholder:text-label3">{species?.notes ?? ''}</textarea>
		</li>
	</Section>
</form>

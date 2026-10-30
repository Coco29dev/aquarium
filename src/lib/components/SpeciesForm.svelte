<script lang="ts">
	import { api, toNumber, toText } from '$lib/client/api';
	import { KIND_LABELS, type Species } from '$lib/types';

	interface Props {
		species?: Species;
		onsaved: (id: number) => void;
		oncancel?: () => void;
	}
	let { species, onsaved, oncancel }: Props = $props();

	const isNew = $derived(!species);
	const editable = $derived(isNew || species?.source === 'maison');
	let message = $state('');
	let busy = $state(false);

	const est = (key: string) => species?.estimated.includes(key);

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
		busy = true;
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
			busy = false;
		}
	}

	const field = 'w-full rounded-lg border border-cyan-900 bg-slate-950 px-3 py-2 text-sm';
	const label = 'flex flex-col gap-1 text-xs text-slate-400';
</script>

<form onsubmit={submit} class="grid grid-cols-6 gap-2">
	{#if editable}
		<label class="{label} col-span-6">Nom scientifique<input name="scientificName" required value={species?.scientificName ?? ''} class={field} /></label>
		<label class="{label} col-span-3">Type
			<select name="kind" class={field}>
				{#each Object.entries(KIND_LABELS) as [value, text] (value)}<option {value} selected={(species?.kind ?? 'poisson') === value}>{text}</option>{/each}
			</select>
		</label>
		<label class="{label} col-span-3">Durée de vie (ans)<input name="lifespanYears" inputmode="decimal" value={species?.lifespanYears ?? ''} class={field} /></label>
		<fieldset class="col-span-6 flex gap-4 text-sm">
			<label class="flex items-center gap-2"><input type="checkbox" name="fresh" checked={species?.fresh ?? true} class="accent-cyan-500" /> Eau douce</label>
			<label class="flex items-center gap-2"><input type="checkbox" name="brackish" checked={species?.brackish ?? false} class="accent-cyan-500" /> Saumâtre</label>
			<label class="flex items-center gap-2"><input type="checkbox" name="salt" checked={species?.salt ?? false} class="accent-cyan-500" /> Mer</label>
		</fieldset>
	{/if}
	<label class="{label} col-span-3">Nom français<input name="nameFr" value={species?.nameFr ?? ''} class={field} /></label>
	<label class="{label} col-span-3">Nom anglais<input name="nameEn" value={species?.nameEn ?? ''} class={field} /></label>
	<label class="{label} col-span-2">Taille adulte (cm)<input name="maxLengthCm" inputmode="decimal" value={species?.maxLengthCm ?? ''} class={field} /></label>
	<label class="{label} col-span-2">Volume min. (L)<input name="minTankL" inputmode="numeric" value={species?.minTankL ?? ''} class={field} /></label>
	<label class="{label} col-span-2">Groupe min.{#if est('groupMin')}<em class="text-amber-300 not-italic"> estimé</em>{/if}<input name="groupMin" inputmode="numeric" value={species?.groupMin ?? ''} class={field} /></label>
	<label class="{label} col-span-3">Température min (°C)<input name="tempMin" inputmode="decimal" value={species?.tempMin ?? ''} class={field} /></label>
	<label class="{label} col-span-3">Température max (°C)<input name="tempMax" inputmode="decimal" value={species?.tempMax ?? ''} class={field} /></label>
	<label class="{label} col-span-3">pH min<input name="phMin" inputmode="decimal" value={species?.phMin ?? ''} class={field} /></label>
	<label class="{label} col-span-3">pH max<input name="phMax" inputmode="decimal" value={species?.phMax ?? ''} class={field} /></label>
	<label class="{label} col-span-3">Tempérament
		<select name="temperament" class={field}>
			<option value="">À renseigner</option>
			{#each ['paisible', 'semi-agressif', 'agressif'] as v (v)}<option value={v} selected={species?.temperament === v}>{v}</option>{/each}
		</select>
	</label>
	<label class="{label} col-span-3">Régime{#if est('diet')}<em class="text-amber-300 not-italic"> estimé</em>{/if}
		<select name="diet" class={field}>
			<option value="">À renseigner</option>
			{#each ['carnivore', 'omnivore', 'herbivore', 'filtreur', 'autre'] as v (v)}<option value={v} selected={species?.diet === v}>{v}</option>{/each}
		</select>
	</label>
	<label class="{label} col-span-3">Zone du bac{#if est('zone')}<em class="text-amber-300 not-italic"> estimé</em>{/if}
		<select name="zone" class={field}>
			<option value="">À renseigner</option>
			{#each ['haut', 'milieu', 'bas', 'tous'] as v (v)}<option value={v} selected={species?.zone === v}>{v}</option>{/each}
		</select>
	</label>
	<label class="{label} col-span-3">Compatible récif
		<select name="reefSafe" class={field}>
			<option value="">Inconnu</option>
			<option value="oui" selected={species?.reefSafe === true}>Oui</option>
			<option value="non" selected={species?.reefSafe === false}>Non</option>
		</select>
	</label>
	<label class="{label} col-span-6">Charge biologique adulte (g, sinon estimée d'après la taille)<input name="bioloadG" inputmode="decimal" value={species?.bioloadG ?? ''} class={field} /></label>
	<label class="{label} col-span-6">Description<textarea name="description" rows="4" maxlength="2000" class={field}>{species?.description ?? ''}</textarea></label>
	<label class="{label} col-span-6">Notes d'élevage<textarea name="notes" rows="3" maxlength="2000" class={field}>{species?.notes ?? ''}</textarea></label>
	{#if message}<p class="col-span-6 text-sm text-red-300" role="alert">{message}</p>{/if}
	<button disabled={busy} class="col-span-3 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium active:bg-cyan-800 disabled:opacity-40">Enregistrer</button>
	{#if oncancel}<button type="button" onclick={oncancel} class="col-span-3 rounded-lg border border-slate-700 px-4 py-2 text-sm">Annuler</button>{/if}
</form>

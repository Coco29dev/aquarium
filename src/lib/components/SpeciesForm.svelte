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

	const field = 'field text-sm';
	const label = 'flex min-w-0 flex-col gap-1 text-xs font-bold text-muted';
	const group = 'card-flat grid grid-cols-6 gap-2.5 p-4';
	const legend = 'col-span-6 mb-0.5 text-[11px] font-bold uppercase tracking-wider text-muted';
	const box = 'flex items-center gap-2 rounded-full border-2 border-edge bg-surface px-3 py-1.5 text-sm font-bold has-[:checked]:bg-ink has-[:checked]:text-on-ink';
</script>

<form onsubmit={submit} class="flex flex-col gap-4">
	<fieldset class={group}>
		<legend class="sr-only">Identité</legend>
		<p class={legend}>Identité</p>
		{#if editable}
			<label class="{label} col-span-6">Nom scientifique<input name="scientificName" required value={species?.scientificName ?? ''} class="{field} italic" /></label>
		{/if}
		<label class="{label} col-span-3">Nom français<input name="nameFr" value={species?.nameFr ?? ''} class={field} /></label>
		<label class="{label} col-span-3">Nom anglais<input name="nameEn" value={species?.nameEn ?? ''} class={field} /></label>
		{#if editable}
			<label class="{label} col-span-3">Type
				<select name="kind" class={field}>
					{#each Object.entries(KIND_LABELS) as [value, text] (value)}<option {value} selected={(species?.kind ?? 'poisson') === value}>{text}</option>{/each}
				</select>
			</label>
			<label class="{label} col-span-3">Durée de vie (ans)<input name="lifespanYears" inputmode="decimal" value={species?.lifespanYears ?? ''} class="{field} num" /></label>
			<div class="col-span-6 flex flex-wrap gap-2 pt-1">
				<label class={box}><input type="checkbox" name="fresh" checked={species?.fresh ?? true} class="sr-only" />Eau douce</label>
				<label class={box}><input type="checkbox" name="brackish" checked={species?.brackish ?? false} class="sr-only" />Saumâtre</label>
				<label class={box}><input type="checkbox" name="salt" checked={species?.salt ?? false} class="sr-only" />Mer</label>
			</div>
		{/if}
	</fieldset>

	<fieldset class={group}>
		<legend class="sr-only">Conditions</legend>
		<p class={legend}>Conditions</p>
		<label class="{label} col-span-3">Température min (°C)<input name="tempMin" inputmode="decimal" value={species?.tempMin ?? ''} class="{field} num" /></label>
		<label class="{label} col-span-3">Température max (°C)<input name="tempMax" inputmode="decimal" value={species?.tempMax ?? ''} class="{field} num" /></label>
		<label class="{label} col-span-3">pH min<input name="phMin" inputmode="decimal" value={species?.phMin ?? ''} class="{field} num" /></label>
		<label class="{label} col-span-3">pH max<input name="phMax" inputmode="decimal" value={species?.phMax ?? ''} class="{field} num" /></label>
		<label class="{label} col-span-2">Taille (cm)<input name="maxLengthCm" inputmode="decimal" value={species?.maxLengthCm ?? ''} class="{field} num" /></label>
		<label class="{label} col-span-2">Bac min. (L)<input name="minTankL" inputmode="numeric" value={species?.minTankL ?? ''} class="{field} num" /></label>
		<label class="{label} col-span-2">Groupe min.{#if est('groupMin')}<em class="not-italic text-warn"> estimé</em>{/if}<input name="groupMin" inputmode="numeric" value={species?.groupMin ?? ''} class="{field} num" /></label>
	</fieldset>

	<fieldset class={group}>
		<legend class="sr-only">Comportement</legend>
		<p class={legend}>Comportement</p>
		<label class="{label} col-span-3">Tempérament
			<select name="temperament" class={field}>
				<option value="">À renseigner</option>
				{#each ['paisible', 'semi-agressif', 'agressif'] as v (v)}<option value={v} selected={species?.temperament === v}>{v}</option>{/each}
			</select>
		</label>
		<label class="{label} col-span-3">Régime{#if est('diet')}<em class="not-italic text-warn"> estimé</em>{/if}
			<select name="diet" class={field}>
				<option value="">À renseigner</option>
				{#each ['carnivore', 'omnivore', 'herbivore', 'filtreur', 'autre'] as v (v)}<option value={v} selected={species?.diet === v}>{v}</option>{/each}
			</select>
		</label>
		<label class="{label} col-span-3">Zone du bac{#if est('zone')}<em class="not-italic text-warn"> estimé</em>{/if}
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
		<label class="{label} col-span-6">Charge biologique adulte (g, sinon estimée d'après la taille)<input name="bioloadG" inputmode="decimal" value={species?.bioloadG ?? ''} class="{field} num" /></label>
	</fieldset>

	<fieldset class={group}>
		<legend class="sr-only">Textes</legend>
		<p class={legend}>Textes</p>
		<label class="{label} col-span-6">Description<textarea name="description" rows="4" maxlength="2000" class={field}>{species?.description ?? ''}</textarea></label>
		<label class="{label} col-span-6">Notes d'élevage<textarea name="notes" rows="3" maxlength="2000" class={field}>{species?.notes ?? ''}</textarea></label>
	</fieldset>

	{#if message}<p class="rounded-lg border-2 border-bad bg-bad-soft p-3 text-sm font-bold text-bad" role="alert">{message}</p>{/if}
	<div class="grid grid-cols-2 gap-3">
		<button disabled={busy} class="btn {oncancel ? '' : 'col-span-2'}">Enregistrer</button>
		{#if oncancel}<button type="button" onclick={oncancel} class="btn-ghost">Annuler</button>{/if}
	</div>
</form>

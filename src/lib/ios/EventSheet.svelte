<script lang="ts">
	import { untrack } from 'svelte';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { DEPARTURE_CAUSES, DOSE_UNITS, EVENT_KINDS, EVENT_META, validateEventPayload } from '$lib/domain/events';
	import { fmt } from '$lib/ui';
	import Section from './Section.svelte';
	import Row from './Row.svelte';
	import Sheet from './Sheet.svelte';
	import InputRow from './InputRow.svelte';
	import SelectRow from './SelectRow.svelte';
	import Segmented from './Segmented.svelte';
	import Switch from './Switch.svelte';
	import type { AquariumEvent, EventKind, WaterType } from '$lib/types';

	/**
	 * Feuille de saisie d'un événement du bac.
	 * - création : `kind` absent → choix du type d'abord ; `kind` donné → formulaire direct (`prefill` pour reprendre
	 *   les valeurs de la dernière fois) ;
	 * - modification : `event` (déjà envoyé au serveur) → formulaire rempli, date modifiable.
	 * `volumeL` relie le pourcentage et les litres d'un changement d'eau.
	 */
	interface Props {
		open: boolean;
		aquariumId: number;
		volumeL?: number | null;
		waterType?: WaterType;
		event?: AquariumEvent | null;
		kind?: EventKind | null;
		prefill?: Record<string, unknown>;
		onclose: () => void;
		onsaved?: () => void;
	}
	let { open, aquariumId, volumeL = null, waterType = 'douce', event = null, kind = null, prefill, onclose, onsaved }: Props = $props();

	const pad = (n: number) => String(n).padStart(2, '0');
	function toLocal(iso: string | number): string {
		const d = new Date(iso);
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}
	const nowLocal = () => toLocal(Date.now());
	const text = (v: unknown) => (v === undefined || v === null ? '' : String(v).replace('.', ','));

	let chosen = $state<EventKind | null>(null);
	let at = $state(nowLocal());
	let note = $state('');
	let attempted = $state(false);
	let saving = $state(false);

	// Champs, tous en texte : le type de payload est reconstruit à l'enregistrement.
	let percent = $state('');
	let litres = $state('');
	let source = $state('robinet');
	let tempDiff = $state('');
	let conditioner = $state(false);
	let product = $state('');
	let amount = $state('');
	let unit = $state<string>('mL');
	let photoperiod = $state('');
	let startTime = $state('');
	let endTime = $state('');
	let intensity = $state('');
	let bubbles = $state('');
	let onTime = $state('');
	let offTime = $state('');
	let what = $state('');
	let species = $state('');
	let quantity = $state('1');
	let cause = $state('');
	let label = $state('');

	const salt = $derived(waterType === 'mer' || waterType === 'recif');

	function load(p: Record<string, unknown>) {
		percent = text(p.percent);
		litres = text(p.litres);
		source = typeof p.source === 'string' ? p.source : salt ? 'mer' : 'robinet';
		tempDiff = text(p.tempDiffC);
		conditioner = p.conditioner === true;
		product = typeof p.product === 'string' ? p.product : '';
		amount = text(p.amount);
		unit = typeof p.unit === 'string' ? p.unit : 'mL';
		photoperiod = text(p.photoperiodH);
		startTime = typeof p.startTime === 'string' ? p.startTime : '';
		endTime = typeof p.endTime === 'string' ? p.endTime : '';
		intensity = text(p.intensityPct);
		bubbles = text(p.bubblesPerSecond);
		onTime = typeof p.onTime === 'string' ? p.onTime : '';
		offTime = typeof p.offTime === 'string' ? p.offTime : '';
		what = typeof p.what === 'string' ? p.what : '';
		species = typeof p.species === 'string' ? p.species : '';
		quantity = p.quantity === undefined ? '1' : text(p.quantity);
		cause = typeof p.cause === 'string' ? p.cause : '';
		label = typeof p.label === 'string' ? p.label : '';
	}

	function init() {
		attempted = false;
		saving = false;
		if (event) {
			chosen = event.kind;
			at = toLocal(event.at);
			note = event.note ?? '';
			load(event.payload ?? {});
		} else {
			chosen = kind;
			at = nowLocal();
			note = '';
			load(prefill ?? {});
		}
	}

	let wasOpen = false;
	$effect(() => {
		if (open && !wasOpen) untrack(init);
		wasOpen = open;
	});

	const parse = (s: string): number | undefined => {
		const t = s.trim().replace(',', '.');
		if (t === '') return undefined;
		const v = Number(t);
		return Number.isFinite(v) ? v : Number.NaN;
	};
	const round1 = (v: number) => Math.round(v * 10) / 10;

	// Pourcentage et litres restent liés quand le volume du bac est connu.
	function fromPercent(value: string) {
		const p = parse(value);
		if (volumeL && p !== undefined && Number.isFinite(p)) litres = text(round1((volumeL * p) / 100));
		else if (value.trim() === '') litres = '';
	}
	function fromLitres(value: string) {
		const l = parse(value);
		if (volumeL && l !== undefined && Number.isFinite(l)) percent = text(round1((l / volumeL) * 100));
		else if (value.trim() === '') percent = '';
	}

	function build(): Record<string, unknown> {
		const out: Record<string, unknown> = {};
		const put = (key: string, value: unknown) => {
			if (value !== undefined && value !== '') out[key] = value;
		};
		switch (chosen) {
			case 'changement_eau':
				put('percent', parse(percent));
				put('litres', parse(litres));
				put('source', source);
				put('tempDiffC', parse(tempDiff));
				if (conditioner) out.conditioner = true;
				break;
			case 'appoint':
				put('litres', parse(litres));
				break;
			case 'dosage':
				put('product', product.trim());
				put('amount', parse(amount));
				put('unit', unit);
				break;
			case 'eclairage': {
				let h = parse(photoperiod);
				if (h === undefined && startTime && endTime) {
					const [a, b] = [startTime, endTime].map((t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)));
					h = round1((((b - a) % 1440) + 1440) % 1440 / 60);
				}
				put('photoperiodH', h);
				put('startTime', startTime);
				put('endTime', endTime);
				put('intensityPct', parse(intensity));
				break;
			}
			case 'co2':
				put('bubblesPerSecond', parse(bubbles));
				put('onTime', onTime);
				put('offTime', offTime);
				break;
			case 'maintenance':
				put('what', what.trim());
				break;
			case 'habitant_ajout':
				put('species', species.trim());
				put('quantity', parse(quantity));
				break;
			case 'habitant_depart':
				put('species', species.trim());
				put('quantity', parse(quantity));
				put('cause', cause);
				break;
			case 'etape':
				put('label', label.trim());
				break;
		}
		return out;
	}

	const problem = $derived.by(() => {
		if (!chosen) return null;
		if (chosen === 'note' && !note.trim()) return 'Écris ta note.';
		return validateEventPayload(chosen, build());
	});
	const atIso = $derived(at ? new Date(at).toISOString() : null);

	async function save() {
		attempted = true;
		if (!chosen || problem || !atIso || saving) return;
		saving = true;
		try {
			if (event?.id != null) {
				await store.updateEvent(event.id, { at: atIso, payload: build(), note: note.trim() || null });
				ui.show('Événement modifié', undefined, 'check');
			} else {
				await store.addEvent(aquariumId, chosen, build(), { note: note.trim() || undefined, at: atIso });
				ui.show(`${EVENT_META[chosen].label} ajouté`, undefined, 'check');
			}
			onsaved?.();
			onclose();
		} catch (e) {
			ui.show((e as Error).message);
		} finally {
			saving = false;
		}
	}

	const title = $derived(chosen ? EVENT_META[chosen].label : 'Nouvel événement');
	const sourceOptions = $derived(
		salt
			? [
					{ value: 'mer', label: 'Eau de mer' },
					{ value: 'osmose', label: 'Osmose' }
				]
			: [
					{ value: 'robinet', label: 'Robinet' },
					{ value: 'osmose', label: 'Osmose' },
					{ value: 'melange', label: 'Mélange' }
				]
	);
	const CAUSE_LABELS: Record<(typeof DEPARTURE_CAUSES)[number], string> = {
		mort: 'Mort',
		don: 'Don',
		vente: 'Vente',
		deplacement: 'Déplacé',
		autre: 'Autre'
	};
	const causeOptions = [{ value: '', label: 'Non précisée' }, ...DEPARTURE_CAUSES.map((c) => ({ value: c, label: CAUSE_LABELS[c] }))];
	const maintenanceIdeas = ['Nettoyage du filtre', 'Vitres', 'Sol', 'Pompe de brassage', 'Écumeur', 'Taille des plantes'];
	const pickable = EVENT_KINDS.filter((k) => k !== 'etape');
	const hint = $derived(
		chosen === 'changement_eau' && volumeL && percent.trim() && Number.isFinite(parse(percent) ?? Number.NaN)
			? `Environ ${fmt(round1((volumeL * (parse(percent) as number)) / 100), 1)} L pour un bac de ${fmt(volumeL, 0)} L.`
			: chosen === 'changement_eau' && !volumeL
				? 'Renseigne le volume du bac pour relier pourcentage et litres.'
				: undefined
	);
</script>

<Sheet
	{open}
	{title}
	{onclose}
	action={chosen ? { label: event ? 'OK' : 'Ajouter', onclick: save, disabled: saving } : undefined}
>
	{#if !chosen}
		<Section footer="Les changements d’eau, les arrivées et les départs sont aussi notés tout seuls quand tu coches une tâche ou modifies tes vivants.">
			{#each pickable as k (k)}
				<Row
					icon={EVENT_META[k].icon}
					iconColor={EVENT_META[k].color}
					title={EVENT_META[k].label}
					chevron
					onclick={() => (chosen = k)}
				/>
			{/each}
		</Section>
	{:else}
		{#if chosen === 'changement_eau'}
			<Section header="Eau changée" footer={hint}>
				<InputRow label="Pourcentage" bind:value={percent} unit="%" inputmode="decimal" placeholder="30" oninput={fromPercent} />
				<InputRow label="Volume" bind:value={litres} unit="L" inputmode="decimal" placeholder="72" oninput={fromLitres} />
				<li class="px-4 py-2.5"><Segmented label="Origine de l’eau" options={sourceOptions} bind:value={source} /></li>
			</Section>
			<Section header="Détails" footer="Un écart de plus de 2 °C avec l’eau du bac peut stresser les animaux.">
				<InputRow label="Écart de température" bind:value={tempDiff} unit="°C" inputmode="decimal" placeholder="0" />
				<Row title="Conditionneur ajouté">
					{#snippet trailing()}<Switch bind:checked={conditioner} label="Conditionneur ajouté" />{/snippet}
				</Row>
			</Section>
		{:else if chosen === 'appoint'}
			<Section header="Appoint" footer="Eau douce ajoutée pour compenser l’évaporation.">
				<InputRow label="Volume" bind:value={litres} unit="L" inputmode="decimal" placeholder="2" />
			</Section>
		{:else if chosen === 'dosage'}
			<Section header="Produit">
				<InputRow label="Produit" bind:value={product} wide placeholder="Produit (calcium, engrais NPK…)" />
				<InputRow label="Dose" bind:value={amount} inputmode="decimal" placeholder="5" />
				<li class="px-4 py-2.5"><Segmented label="Unité" options={DOSE_UNITS.map((u) => ({ value: u, label: u }))} bind:value={unit} /></li>
			</Section>
		{:else if chosen === 'eclairage'}
			<Section header="Réglages" footer="Renseigne ce qui a changé. La photopériode se calcule depuis les heures si tu la laisses vide.">
				<InputRow label="Photopériode" bind:value={photoperiod} unit="h" inputmode="decimal" placeholder="8" />
				<InputRow label="Allumage" bind:value={startTime} type="time" />
				<InputRow label="Extinction" bind:value={endTime} type="time" />
				<InputRow label="Intensité" bind:value={intensity} unit="%" inputmode="decimal" placeholder="70" />
			</Section>
		{:else if chosen === 'co2'}
			<Section header="Réglages" footer="Renseigne ce qui a changé.">
				<InputRow label="Bulles par seconde" bind:value={bubbles} inputmode="decimal" placeholder="2" />
				<InputRow label="Mise en route" bind:value={onTime} type="time" />
				<InputRow label="Arrêt" bind:value={offTime} type="time" />
			</Section>
		{:else if chosen === 'maintenance'}
			<Section header="Intervention">
				<InputRow label="Intervention" bind:value={what} wide placeholder="Ce que tu as fait" />
				<li class="flex flex-wrap gap-2 px-4 py-3">
					{#each maintenanceIdeas as idea (idea)}
						<button type="button" class="subhead rounded-full bg-fill3 px-3 py-1.5 active:opacity-60" onclick={() => (what = idea)}>{idea}</button>
					{/each}
				</li>
			</Section>
		{:else if chosen === 'habitant_ajout' || chosen === 'habitant_depart'}
			<Section header={chosen === 'habitant_ajout' ? 'Arrivée' : 'Départ'}>
				<InputRow label="Espèce" bind:value={species} wide placeholder="Espèce (ex. Néon cardinal)" />
				<InputRow label="Quantité" bind:value={quantity} inputmode="numeric" placeholder="1" />
				{#if chosen === 'habitant_depart'}
					<SelectRow label="Cause" bind:value={cause} options={causeOptions} />
				{/if}
			</Section>
		{:else if chosen === 'etape'}
			<Section header="Étape">
				<InputRow label="Étape" bind:value={label} wide placeholder="Ex. Fin de quarantaine" />
			</Section>
		{/if}

		<Section header="Quand">
			<li class="pl-4">
				<div class="row-body flex min-h-11 items-center gap-3 py-1.5 pr-4">
					<label for="event-at" class="body flex-1">Date</label>
					<input id="event-at" type="datetime-local" bind:value={at} max={nowLocal()} class="body rounded-lg bg-fill3 px-2.5 py-1 text-right outline-none" />
				</div>
			</li>
		</Section>

		<Section header={chosen === 'note' ? 'Note' : 'Note (facultatif)'} footer={attempted && problem ? problem : undefined}>
			{#if chosen === 'note'}
				<li class="p-1">
					<textarea
						bind:value={note}
						rows="4"
						class="body w-full resize-none bg-transparent p-3 outline-none placeholder:text-label3"
						placeholder="Ce que tu as observé ou changé…"
						aria-label="Texte de la note"
					></textarea>
				</li>
			{:else}
				<InputRow label="Note" bind:value={note} wide placeholder="Un mot pour t’en souvenir" />
			{/if}
		</Section>

		{#if event?.id != null}
			<Section>
				<Row
					title="Supprimer l’événement"
					destructive
					onclick={async () => {
						const ok = await ui.confirm({ title: 'Supprimer cet événement ?', confirmLabel: 'Supprimer', destructive: true });
						if (!ok || event?.id == null) return;
						try {
							await store.deleteEvent(event.id);
							ui.show('Événement supprimé');
							onsaved?.();
							onclose();
						} catch (e) {
							ui.show((e as Error).message);
						}
					}}
				/>
			</Section>
		{/if}
	{/if}
</Sheet>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { createResource } from '$lib/client/api';
	import { WATER_TYPE_LABELS, type AquariumStage, type Species, type WaterType } from '$lib/types';
	import { PARAMETER_TEMPLATES, suggestedTasks, type SuggestedTask } from '$lib/templates';
	import { PROJECT_CHECK_ITEMS } from '$lib/domain/journey';
	import { speciesName } from '$lib/domain/species';
	import { addDays, dayInParis } from '$lib/domain/dates';
	import { TANK_ICON, TANK_TONE, fmt } from '$lib/ui';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import SpeciesPicker from '$lib/components/SpeciesPicker.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Segmented from '$lib/ios/Segmented.svelte';
	import Stepper from '$lib/ios/Stepper.svelte';
	import Switch from '$lib/ios/Switch.svelte';
	import WizardStep from '$lib/ios/WizardStep.svelte';

	// Assistant de création : trois parcours selon l'état réel du bac.
	// 0 = choix de la situation ; ensuite les étapes de FLOWS[stage].
	type StepKey = 'base' | 'taille' | 'habitants' | 'mesures' | 'eau' | 'routine' | 'source' | 'materiel' | 'especes' | 'recap';
	const FLOWS: Record<AquariumStage, StepKey[]> = {
		actif: ['base', 'taille', 'habitants', 'mesures', 'eau', 'routine', 'recap'],
		cyclage: ['base', 'taille', 'source', 'mesures', 'routine', 'recap'],
		projet: ['base', 'taille', 'materiel', 'especes', 'recap']
	};

	const today = dayInParis();

	const SOURCES = [
		{ value: 'ammoniaque', label: 'Ammoniaque pure' },
		{ value: 'nourriture', label: 'Nourriture qui se décompose' },
		{ value: 'bacteries', label: 'Bactéries en flacon' },
		{ value: 'bac-mature', label: 'Matériau d’un bac mature' },
		{ value: 'inconnue', label: 'Je ne sais pas encore' }
	] as const;

	// Matériel à prévoir, selon le type d'eau (tout est décoché au départ).
	const BASE_EQUIPMENT = ['Aquarium et meuble', 'Filtre', 'Chauffage et thermomètre', 'Éclairage', 'Substrat et décor', 'Kit de tests', 'Conditionneur d’eau'];
	const EQUIPMENT: Record<WaterType, string[]> = {
		douce: BASE_EQUIPMENT,
		plantee: [...BASE_EQUIPMENT, 'Diffuseur de CO₂', 'Engrais', 'Sol nutritif'],
		mer: ['Aquarium et meuble', 'Filtre ou décantation', 'Chauffage et thermomètre', 'Éclairage', 'Roche et sable', 'Pompe de brassage', 'Osmoseur', 'Sel marin', 'Réfractomètre', 'Kit de tests'],
		recif: ['Aquarium et meuble', 'Décantation ou filtre', 'Écumeur', 'Chauffage et thermomètre', 'Éclairage récifal', 'Roche vivante et sable', 'Pompes de brassage', 'Osmoseur', 'Sel récifal', 'Réfractomètre', 'Kit calcium, KH, magnésium', 'Osmolateur']
	};

	const types: { value: WaterType; hint: string }[] = [
		{ value: 'douce', hint: 'Poissons et plantes faciles' },
		{ value: 'plantee', hint: 'Aquascape, CO₂, engrais' },
		{ value: 'mer', hint: 'Poissons marins, roches' },
		{ value: 'recif', hint: 'Coraux, calcium, KH' }
	];

	interface Choice {
		stage: AquariumStage;
		title: string;
		text: string;
		icon: IconName;
		tone: string;
	}
	const CHOICES: Choice[] = [
		{ stage: 'actif', title: 'Déjà en eau, avec des habitants', text: 'Ton bac tourne déjà. Je reprends son histoire : habitants, premières mesures, dernier changement d’eau.', icon: 'fish', tone: 'var(--green)' },
		{ stage: 'cyclage', title: 'En cours de cyclage', text: 'L’eau est lancée, les poissons pas encore. Je suis l’ammoniac, les nitrites et les nitrates jusqu’au feu vert.', icon: 'cycle', tone: 'var(--indigo)' },
		{ stage: 'projet', title: 'Je réfléchis à un projet', text: 'Pas encore d’eau. Liste le matériel, chiffre le budget, choisis des espèces et prépare la mise en eau.', icon: 'outils', tone: 'var(--orange)' }
	];

	let uid = 0;
	interface Habitant { key: number; kind: 'faune' | 'flore'; species: string; scientific: string | null; speciesId: number | null; quantity: number }
	interface Wish { key: number; species: Species }
	interface TaskDraft extends SuggestedTask { on: boolean }
	interface CustomItem { key: number; label: string; amount: string }

	// Toutes les cases de matériel existent dès le départ (pas d'écriture d'état pendant l'affichage).
	const ALL_EQUIPMENT = [...new Set(Object.values(EQUIPMENT).flat())];

	const d = $state({
		stage: null as AquariumStage | null,
		name: '',
		waterType: 'douce' as WaterType,
		volume: '',
		// En eau : date connue ou estimée.
		dateMode: 'known' as 'known' | 'unknown',
		startedOn: '',
		months: 6,
		// Cyclage
		cycleStart: today,
		source: 'inconnue' as (typeof SOURCES)[number]['value'],
		// Habitants
		habitants: [] as Habitant[],
		manualKind: 'faune' as 'faune' | 'flore',
		manualName: '',
		// Mesures (valeur saisie par clé de paramètre)
		meas: {} as Record<string, string>,
		lastWaterChange: '',
		tasks: [] as TaskDraft[],
		tasksFor: '',
		// Projet
		equip: Object.fromEntries(ALL_EQUIPMENT.map((label) => [label, { on: false, amount: '' }])) as Record<string, { on: boolean; amount: string }>,
		custom: [] as CustomItem[],
		customLabel: '',
		customAmount: '',
		budget: '',
		wishes: [] as Wish[]
	});

	let stepIdx = $state(0);
	let direction = $state<'forward' | 'back'>('forward');
	let busy = $state(false);
	let message = $state('');

	const flow = $derived(d.stage ? FLOWS[d.stage] : []);
	const current = $derived<StepKey | null>(stepIdx > 0 ? (flow[stepIdx - 1] ?? null) : null);
	const progress = $derived(d.stage ? stepIdx / flow.length : 0);
	const template = $derived(PARAMETER_TEMPLATES[d.waterType]);
	const speciesWater = $derived<'douce' | 'mer'>(d.waterType === 'mer' || d.waterType === 'recif' ? 'mer' : 'douce');

	const num = (s: string): number | null => {
		const t = s.trim().replace(',', '.');
		if (t === '') return null;
		const n = Number(t);
		return Number.isFinite(n) ? n : NaN;
	};

	// Mise en eau effective d'un bac déjà en eau.
	const effectiveStart = $derived.by(() => {
		if (d.stage === 'cyclage') return d.cycleStart;
		if (d.dateMode === 'unknown') return addDays(today, -Math.round(d.months * 30.44));
		return d.startedOn;
	});

	// --- Validation douce, étape par étape ----------------------------------
	const volumeNum = $derived(num(d.volume));
	const volumeOk = $derived(volumeNum === null || (!Number.isNaN(volumeNum) && volumeNum > 0));
	const startOk = $derived(d.stage === 'projet' || effectiveStart === '' || effectiveStart <= today);
	const measErrors = $derived(
		template.filter((p) => {
			const n = num(d.meas[p.key ?? ''] ?? '');
			return n !== null && Number.isNaN(n);
		})
	);
	const stepError = $derived.by((): string => {
		switch (current) {
			case 'base':
				return d.name.trim() === '' ? 'Donne un nom à ton bac pour continuer.' : '';
			case 'taille':
				if (!volumeOk) return 'Le volume doit être un nombre supérieur à 0.';
				if (!startOk) return 'La date ne peut pas être dans le futur.';
				return '';
			case 'mesures':
				return measErrors.length ? `Valeur invalide : ${measErrors.map((p) => p.name).join(', ')}.` : '';
			case 'eau':
				return d.lastWaterChange > today ? 'La date ne peut pas être dans le futur.' : '';
			default:
				return '';
		}
	});

	/** Étape facultative laissée vide : le bouton devient « Passer ». */
	const skippable = $derived.by(() => {
		switch (current) {
			case 'habitants':
				return d.habitants.length === 0;
			case 'mesures':
				return template.every((p) => (d.meas[p.key ?? ''] ?? '').trim() === '');
			case 'eau':
				return d.lastWaterChange === '';
			case 'especes':
				return d.wishes.length === 0;
			case 'materiel':
				return !equipChosen && d.custom.length === 0 && d.budget.trim() === '';
			default:
				return false;
		}
	});

	// --- Mesures ---------------------------------------------------------
	const measTemplate = $derived(d.stage === 'cyclage' ? template.filter((p) => ['nh3', 'no2', 'no3'].includes(p.key ?? '')) : template);
	function outOfRange(p: (typeof template)[number]): 'bas' | 'haut' | null {
		const n = num(d.meas[p.key ?? ''] ?? '');
		if (n === null || Number.isNaN(n)) return null;
		if (p.max != null && n > p.max) return 'haut';
		if (p.min != null && n < p.min) return 'bas';
		return null;
	}
	const outList = $derived(measTemplate.filter((p) => outOfRange(p) !== null));

	// --- Tâches suggérées ---------------------------------------------------
	function ensureTasks() {
		if (!d.stage) return;
		const key = `${d.waterType}/${d.stage}`;
		if (d.tasksFor === key) return;
		d.tasks = suggestedTasks(d.waterType, d.stage).map((t) => ({ ...t, on: true }));
		d.tasksFor = key;
	}

	// --- Habitants ---------------------------------------------------------
	function addSpecies(s: Species) {
		const found = d.habitants.find((h) => h.speciesId === s.id);
		if (found) {
			found.quantity += 1;
			return;
		}
		d.habitants.push({ key: ++uid, kind: s.kind === 'plante' ? 'flore' : 'faune', species: speciesName(s), scientific: s.scientificName, speciesId: s.id, quantity: 1 });
	}
	function addManual() {
		const name = d.manualName.trim();
		if (!name) return;
		d.habitants.push({ key: ++uid, kind: d.manualKind, species: name, scientific: null, speciesId: null, quantity: 1 });
		d.manualName = '';
	}

	// --- Projet ------------------------------------------------------------
	const suggestions = $derived(EQUIPMENT[d.waterType]);
	const equipChosen = $derived(suggestions.some((label) => d.equip[label]?.on));
	const total = $derived.by(() => {
		let sum = 0;
		for (const label of suggestions) {
			const e = d.equip[label];
			if (e?.on) sum += Math.max(0, num(e.amount) || 0);
		}
		for (const c of d.custom) sum += Math.max(0, num(c.amount) || 0);
		return sum;
	});
	function addCustom() {
		const label = d.customLabel.trim();
		if (!label) return;
		d.custom.push({ key: ++uid, label, amount: d.customAmount });
		d.customLabel = '';
		d.customAmount = '';
	}
	function addWish(s: Species) {
		if (d.wishes.some((w) => w.species.id === s.id)) return;
		d.wishes.push({ key: ++uid, species: s });
	}

	// --- Navigation -----------------------------------------------------------
	function choose(stage: AquariumStage) {
		d.stage = stage;
		direction = 'forward';
		stepIdx = 1;
	}
	function next() {
		if (stepError || busy) return;
		direction = 'forward';
		if (stepIdx < flow.length) {
			stepIdx += 1;
			if (flow[stepIdx - 1] === 'routine') ensureTasks();
		}
	}
	function back() {
		direction = 'back';
		message = '';
		stepIdx = Math.max(0, stepIdx - 1);
	}

	const dirty = $derived(d.stage !== null && (d.name.trim() !== '' || d.habitants.length > 0 || d.wishes.length > 0 || d.custom.length > 0 || equipChosen));
	function leave() {
		if (history.length > 1) history.back();
		else void goto('/aquariums', { replaceState: true });
	}
	async function cancel() {
		if (dirty) {
			const ok = await ui.confirm({ title: 'Abandonner ce bac ?', message: 'Ce que tu as saisi sera perdu.', confirmLabel: 'Abandonner', cancelLabel: 'Continuer', destructive: true });
			if (!ok) return;
		}
		leave();
	}

	onMount(() => {
		const preset = page.url.searchParams.get('stage');
		if (preset === 'actif' || preset === 'cyclage' || preset === 'projet') choose(preset);
	});

	// --- Envoi ------------------------------------------------------------
	function projectItems() {
		const items: { kind: string; label: string; done?: boolean; amount?: number | null; speciesId?: number | null }[] = [];
		for (const label of suggestions) {
			const e = d.equip[label];
			if (e?.on) items.push({ kind: 'equipement', label, amount: num(e.amount) || null });
		}
		for (const c of d.custom) items.push({ kind: 'equipement', label: c.label, amount: num(c.amount) || null });
		const budget = num(d.budget);
		if (budget && !Number.isNaN(budget) && budget > 0) items.push({ kind: 'budget', label: 'Budget visé', amount: budget });
		for (const w of d.wishes) items.push({ kind: 'espece', label: speciesName(w.species), speciesId: w.species.id });
		items.push({ kind: 'etape', label: PROJECT_CHECK_ITEMS.compatibility, done: false });
		items.push({ kind: 'etape', label: PROJECT_CHECK_ITEMS.planning, done: false });
		return items;
	}

	async function submit() {
		if (!d.stage || busy) return;
		busy = true;
		message = '';
		try {
			const stage = d.stage;
			const body: Record<string, unknown> = {
				name: d.name.trim(),
				waterType: d.waterType,
				volumeL: volumeNum && !Number.isNaN(volumeNum) ? volumeNum : null,
				stage
			};
			if (stage !== 'projet') {
				body.startedOn = effectiveStart || null;
				body.tasks = d.tasks.filter((t) => t.on).map((t) => ({ title: t.title, kind: t.kind, everyDays: t.everyDays }));
				body.measurements = measTemplate
					.map((p) => ({ parameterKey: p.key, value: num(d.meas[p.key ?? ''] ?? '') }))
					.filter((m): m is { parameterKey: string; value: number } => m.value !== null && !Number.isNaN(m.value));
			}
			if (stage === 'actif') {
				body.inhabitants = d.habitants.map((h) => ({
					kind: h.kind,
					species: h.species,
					...(h.speciesId != null ? { speciesId: h.speciesId } : {}),
					quantity: h.quantity
				}));
				if (d.lastWaterChange) body.lastWaterChangeOn = d.lastWaterChange;
			}
			if (stage === 'projet') body.projectItems = projectItems();

			const response = await store.mutate('POST', '/api/aquariums', body);
			const { id } = (await response.json()) as { id: number };
			if (stage === 'cyclage' && d.source !== 'inconnue') {
				// Information sans champ dédié : elle part dans les notes du bac.
				const label = SOURCES.find((s) => s.value === d.source)?.label ?? '';
				await createResource('notes', id, { body: `Cyclage lancé avec : ${label.toLowerCase()}.` }).catch(() => {});
			}
			await goto(stage === 'projet' ? `/aquariums/${id}/projet` : `/aquariums/${id}`, { replaceState: true });
		} catch (error) {
			message = (error as Error).message;
		} finally {
			busy = false;
		}
	}

	const fmtDate = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
	const euro = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`;
	const stageTone = $derived(d.stage ? CHOICES.find((c) => c.stage === d.stage)!.tone : 'var(--blue)');
	const quick = (offset: number) => addDays(today, -offset);
</script>

<svelte:head><title>Nouveau bac · Aquarium</title></svelte:head>

<NavBar title="Nouveau bac" large={false}>
	{#snippet leading()}
		<button class="btn-plain pl-2" onclick={cancel}>Annuler</button>
	{/snippet}
	{#snippet children()}
		{#if d.stage}
			<div class="h-1 overflow-hidden rounded-full bg-fill" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress * 100)} aria-label="Avancement">
				<div class="h-full rounded-full transition-[width] duration-300" style="width: {Math.max(4, progress * 100)}%; background: {stageTone}"></div>
			</div>
		{/if}
	{/snippet}
</NavBar>

<div class="flex min-h-[calc(100dvh-7rem)] flex-col">
	<div class="flex-1 pt-4">
		{#if message}<p class="subhead mb-4 rounded-2xl bg-red/10 px-4 py-3 text-red" role="alert">{message}</p>{/if}

		{#if stepIdx === 0}
			<WizardStep title="Où en est ton bac ?" subtitle="Je m’adapte : les étapes et les suggestions changent selon ta situation." {direction}>
				<div class="flex flex-col gap-3">
					{#each CHOICES as c (c.stage)}
						<button type="button" class="pressable flex items-center gap-4 rounded-[22px] bg-bg2 p-4 text-left" onclick={() => choose(c.stage)}>
							<span class="grid h-14 w-14 shrink-0 place-items-center rounded-[16px] text-white" style="background: {c.tone}; --cut: {c.tone}">
								<Icon name={c.icon} size={30} filled weight={1.7} />
							</span>
							<span class="min-w-0 flex-1">
								<span class="headline block">{c.title}</span>
								<span class="subhead mt-0.5 block text-label2">{c.text}</span>
							</span>
							<span class="text-label3"><Icon name="next" size={18} weight={2.4} /></span>
						</button>
					{/each}
				</div>
			</WizardStep>
		{:else if current === 'base'}
			<WizardStep
				title={d.stage === 'projet' ? 'Ton projet' : 'Ton bac'}
				subtitle={d.stage === 'projet' ? 'Un nom provisoire suffit, tu pourras le changer.' : 'Un nom et un type d’eau : le reste en découle.'}
				icon={TANK_ICON[d.waterType]}
				tone={TANK_TONE[d.waterType]}
				{direction}
			>
				<Section>
					<li class="flex min-h-11 items-center pl-4 pr-4">
						<input bind:value={d.name} maxlength="60" placeholder="Nom (ex. Salon)" aria-label="Nom du bac" enterkeyhint="next" class="body h-11 w-full bg-transparent outline-none placeholder:text-label3" />
					</li>
				</Section>
				<Section header="Type d’eau">
					{#each types as t (t.value)}
						<Row icon={TANK_ICON[t.value]} iconColor={TANK_TONE[t.value]} title={WATER_TYPE_LABELS[t.value]} subtitle={t.hint} onclick={() => (d.waterType = t.value)}>
							{#snippet trailing()}
								{#if d.waterType === t.value}<span class="text-tint"><Icon name="check" size={20} weight={2.6} /></span>{/if}
							{/snippet}
						</Row>
					{/each}
				</Section>
			</WizardStep>
		{:else if current === 'taille'}
			<WizardStep
				title={d.stage === 'projet' ? 'Quel volume vises-tu ?' : d.stage === 'cyclage' ? 'Taille et début du cyclage' : 'Taille et âge du bac'}
				subtitle={d.stage === 'projet' ? 'Le volume décide des espèces possibles et du matériel.' : 'Le volume sert aux calculateurs ; la date sert au suivi de l’âge et du cyclage.'}
				icon="chart"
				tone={stageTone}
				{direction}
			>
				<Section footer={d.stage === 'projet' ? 'Volume d’eau réel, décor déduit : un 60 × 30 × 36 cm contient environ 55 L.' : undefined}>
					<li class="pl-4"><div class="row-body flex min-h-11 items-center gap-3 pr-4">
						<label for="volume" class="body shrink-0">Volume</label>
						<input id="volume" bind:value={d.volume} inputmode="decimal" placeholder="0" class="body rounded-num h-11 min-w-0 flex-1 bg-transparent text-right text-label2 outline-none placeholder:text-label3 focus:text-label" />
						<span class="body text-label2">L</span>
					</div></li>
				</Section>

				{#if d.stage === 'cyclage'}
					<Section header="Début du cyclage" footer="Le jour 0 est celui où l’eau a été mise et l’ammoniac ajouté.">
						<li class="pl-4"><div class="row-body flex min-h-11 items-center gap-3 pr-4">
							<label for="cycle-start" class="body flex-1">Premier jour</label>
							<input id="cycle-start" type="date" max={today} bind:value={d.cycleStart} class="body rounded-lg bg-fill3 px-2.5 py-1 text-right outline-none" />
						</div></li>
					</Section>
				{:else if d.stage === 'actif'}
					<div class="mb-2"><Segmented options={[{ value: 'known', label: 'Je connais la date' }, { value: 'unknown', label: 'Je ne sais plus' }]} bind:value={d.dateMode} label="Date de mise en eau" /></div>
					{#if d.dateMode === 'known'}
						<Section header="Mise en eau" footer="Laisse vide si tu préfères ne pas la renseigner.">
							<li class="pl-4"><div class="row-body flex min-h-11 items-center gap-3 pr-4">
								<label for="started" class="body flex-1">Date</label>
								<input id="started" type="date" max={today} bind:value={d.startedOn} class="body rounded-lg bg-fill3 px-2.5 py-1 text-right outline-none" />
							</div></li>
						</Section>
					{:else}
						<Section header="Âge approximatif" footer={`Je compterai à partir du ${fmtDate(effectiveStart)}.`}>
							<li class="pl-4"><div class="row-body flex min-h-11 items-center gap-3 pr-4">
								<span class="body flex-1">Environ {d.months} mois</span>
								<Stepper bind:value={d.months} min={1} max={240} label="Mois" />
							</div></li>
						</Section>
					{/if}
				{/if}
			</WizardStep>
		{:else if current === 'habitants'}
			<WizardStep title="Qui vit dans ce bac ?" subtitle="Ajoute les habitants actuels, tu pourras en ajouter d’autres plus tard. Tu peux aussi passer cette étape." icon="fish" tone="var(--green)" {direction}>
				{#if d.habitants.length}
					<Section header="Habitants ({d.habitants.reduce((s, h) => s + h.quantity, 0)})">
						{#each d.habitants as h (h.key)}
							<li class="pl-4">
								<div class="row-body flex min-h-14 items-center gap-3 py-2 pr-4">
									<span class="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px] text-white" style="background: {h.kind === 'flore' ? 'var(--green)' : 'var(--orange)'}; --cut: {h.kind === 'flore' ? 'var(--green)' : 'var(--orange)'}">
										<Icon name={h.kind === 'flore' ? 'leaf' : 'fish'} size={19} filled weight={2} />
									</span>
									<span class="min-w-0 flex-1">
										<span class="body block truncate">{h.species}</span>
										{#if h.scientific}<span class="footnote block truncate italic text-label2">{h.scientific}</span>{/if}
									</span>
									<span class="rounded-num body w-6 text-right text-label2">{h.quantity}</span>
									<Stepper bind:value={h.quantity} min={1} max={500} label="Quantité de {h.species}" />
									<button type="button" class="text-red active:opacity-40" aria-label="Retirer {h.species}" onclick={() => (d.habitants = d.habitants.filter((x) => x.key !== h.key))}>
										<Icon name="close" size={20} weight={2.4} />
									</button>
								</div>
							</li>
						{/each}
					</Section>
				{/if}
				<div class="mb-6"><SpeciesPicker onpick={addSpecies} water={speciesWater} placeholder="Chercher une espèce" /></div>
				<Section header="Une espèce introuvable ?" footer="Saisie à la main : elle ne sera pas reliée à la base d’espèces.">
					<li class="px-4 pt-3"><Segmented options={[{ value: 'faune', label: 'Animal' }, { value: 'flore', label: 'Plante' }]} bind:value={d.manualKind} label="Type" /></li>
					<li class="pl-4"><div class="row-body flex min-h-11 items-center gap-3 pr-4">
						<input bind:value={d.manualName} placeholder="Nom de l’espèce" aria-label="Nom de l’espèce" onkeydown={(e) => e.key === 'Enter' && addManual()} class="body h-11 min-w-0 flex-1 bg-transparent outline-none placeholder:text-label3" />
						<button type="button" class="btn-plain font-semibold" disabled={d.manualName.trim() === ''} onclick={addManual}>Ajouter</button>
					</div></li>
				</Section>
			</WizardStep>
		{:else if current === 'source'}
			<WizardStep title="Comment as-tu lancé le cyclage ?" subtitle="Cette information part dans les notes du bac : elle aide à interpréter les premiers tests." icon="cycle" tone="var(--indigo)" {direction}>
				<Section footer="Sans poissons, une source d’ammoniac nourrit les bactéries. Je te dirai quand le bac pourra accueillir ses premiers habitants.">
					{#each SOURCES as s (s.value)}
						<Row title={s.label} onclick={() => (d.source = s.value)}>
							{#snippet trailing()}
								{#if d.source === s.value}<span class="text-tint"><Icon name="check" size={20} weight={2.6} /></span>{/if}
							{/snippet}
						</Row>
					{/each}
				</Section>
			</WizardStep>
		{:else if current === 'mesures'}
			<WizardStep
				title={d.stage === 'cyclage' ? 'Tes derniers tests' : 'Premières mesures'}
				subtitle={d.stage === 'cyclage' ? 'Ammoniac, nitrites, nitrates : renseigne ce que tu as déjà mesuré, ou passe.' : 'Les valeurs d’aujourd’hui servent de point de départ aux graphes. Tout est facultatif.'}
				icon="drop"
				tone="var(--cyan)"
				{direction}
			>
				<Section
					header={d.stage === 'cyclage' ? 'Tests du cyclage' : 'Paramètres'}
					footer={outList.length ? `Hors plage : ${outList.map((p) => p.name).join(', ')}. Tu pourras ajuster les plages dans les réglages du bac.` : 'Les plages sont un point de départ, modifiables ensuite.'}
				>
					{#each measTemplate as p (p.key ?? p.name)}
						{@const out = outOfRange(p)}
						<li class="pl-4"><div class="row-body flex min-h-11 items-center gap-3 pr-4">
							<label for="m-{p.key}" class="body min-w-0 flex-1">
								<span class="block truncate">{p.name}</span>
								{#if p.min != null || p.max != null}
									<span class="footnote block text-label2">Plage {p.min == null ? '…' : fmt(p.min, p.decimals)} – {p.max == null ? '…' : fmt(p.max, p.decimals)}</span>
								{/if}
							</label>
							<input
								id="m-{p.key}"
								bind:value={d.meas[p.key ?? '']}
								inputmode="decimal"
								placeholder="–"
								class="body rounded-num h-11 w-24 bg-transparent text-right outline-none placeholder:text-label3 {out ? 'font-semibold text-red' : 'text-label2 focus:text-label'}"
							/>
							<span class="body w-12 shrink-0 text-label2">{p.unit}</span>
						</div></li>
					{/each}
				</Section>
			</WizardStep>
		{:else if current === 'eau'}
			<WizardStep title="Dernier changement d’eau" subtitle="Ça permet de planifier le prochain au bon moment. Laisse vide si tu ne sais pas." icon="drop" tone="var(--blue)" {direction}>
				<Section>
					<li class="pl-4"><div class="row-body flex min-h-11 items-center gap-3 pr-4">
						<label for="wc" class="body flex-1">Date</label>
						<input id="wc" type="date" max={today} bind:value={d.lastWaterChange} class="body rounded-lg bg-fill3 px-2.5 py-1 text-right outline-none" />
					</div></li>
				</Section>
				<div class="flex flex-wrap gap-2">
					{#each [{ label: 'Aujourd’hui', off: 0 }, { label: 'Hier', off: 1 }, { label: 'Il y a 3 jours', off: 3 }, { label: 'Il y a une semaine', off: 7 }] as q (q.off)}
						<button type="button" class="btn-tinted min-h-9 px-3.5 text-[15px]" onclick={() => (d.lastWaterChange = quick(q.off))}>{q.label}</button>
					{/each}
				</div>
			</WizardStep>
		{:else if current === 'routine'}
			<WizardStep
				title="Ta routine"
				subtitle={d.stage === 'cyclage' ? 'Pendant le cyclage, des tests rapprochés suffisent : pas de changement d’eau ni d’entretien pour l’instant.' : 'Je te propose des rappels adaptés à ce type de bac. Active ceux qui te servent, règle la fréquence.'}
				icon="calendar"
				tone="var(--orange)"
				{direction}
			>
				<Section footer="Tu pourras modifier, ajouter ou supprimer des tâches à tout moment depuis l’onglet Tâches du bac.">
					{#each d.tasks as t, i (t.title)}
						<li class="pl-4">
							<div class="row-body py-2.5 pr-4">
								<div class="flex min-h-9 items-center gap-3">
									<span class="body min-w-0 flex-1">{t.title}</span>
									<Switch bind:checked={d.tasks[i].on} label={t.title} />
								</div>
								{#if t.on}
									<div class="mt-1 flex items-center gap-3">
										<span class="subhead flex-1 text-label2">{t.everyDays === 1 ? 'Tous les jours' : `Tous les ${t.everyDays} jours`}</span>
										<Stepper bind:value={d.tasks[i].everyDays} min={1} max={365} label="Fréquence de {t.title}" />
									</div>
								{/if}
							</div>
						</li>
					{/each}
				</Section>
			</WizardStep>
		{:else if current === 'materiel'}
			<WizardStep title="Matériel à prévoir" subtitle="Active ce qu’il te faut, ajoute un prix estimé si tu veux chiffrer. Tout est modifiable ensuite." icon="box" tone="var(--brown)" {direction}>
				<Section header="Suggestions pour {WATER_TYPE_LABELS[d.waterType].toLowerCase()}">
					{#each suggestions as label (label)}
						<li class="pl-4">
							<div class="row-body flex min-h-11 items-center gap-3 py-1.5 pr-4">
								<span class="body min-w-0 flex-1 truncate">{label}</span>
								{#if d.equip[label].on}
									<input bind:value={d.equip[label].amount} inputmode="decimal" placeholder="Prix" aria-label="Prix de {label}" class="body rounded-num h-9 w-16 rounded-lg bg-fill3 px-2 text-right outline-none placeholder:text-label3" />
									<span class="body text-label2">€</span>
								{/if}
								<Switch bind:checked={d.equip[label].on} label={label} />
							</div>
						</li>
					{/each}
				</Section>
				<Section header="Autre matériel">
					{#each d.custom as c (c.key)}
						<li class="pl-4">
							<div class="row-body flex min-h-11 items-center gap-3 py-1.5 pr-4">
								<span class="body min-w-0 flex-1 truncate">{c.label}</span>
								<input bind:value={c.amount} inputmode="decimal" placeholder="Prix" aria-label="Prix de {c.label}" class="body rounded-num h-9 w-16 rounded-lg bg-fill3 px-2 text-right outline-none placeholder:text-label3" />
								<span class="body text-label2">€</span>
								<button type="button" class="text-red active:opacity-40" aria-label="Retirer {c.label}" onclick={() => (d.custom = d.custom.filter((x) => x.key !== c.key))}><Icon name="close" size={20} weight={2.4} /></button>
							</div>
						</li>
					{/each}
					<li class="pl-4"><div class="row-body flex min-h-11 items-center gap-2 pr-4">
						<input bind:value={d.customLabel} placeholder="Ajouter…" aria-label="Nom du matériel" onkeydown={(e) => e.key === 'Enter' && addCustom()} class="body h-11 min-w-0 flex-1 bg-transparent outline-none placeholder:text-label3" />
						<input bind:value={d.customAmount} inputmode="decimal" placeholder="Prix" aria-label="Prix" class="body rounded-num h-9 w-16 rounded-lg bg-fill3 px-2 text-right outline-none placeholder:text-label3" />
						<button type="button" class="btn-plain font-semibold" disabled={d.customLabel.trim() === ''} onclick={addCustom}>Ajouter</button>
					</div></li>
				</Section>
				<Section header="Budget" footer={total > 0 ? `Total estimé du matériel : ${euro(total)}.` : 'Optionnel : un budget visé permet de suivre l’écart avec le total estimé.'}>
					<li class="pl-4"><div class="row-body flex min-h-11 items-center gap-3 pr-4">
						<label for="budget" class="body flex-1">Budget visé</label>
						<input id="budget" bind:value={d.budget} inputmode="decimal" placeholder="0" class="body rounded-num h-11 w-24 bg-transparent text-right text-label2 outline-none placeholder:text-label3 focus:text-label" />
						<span class="body text-label2">€</span>
					</div></li>
				</Section>
			</WizardStep>
		{:else if current === 'especes'}
			<WizardStep title="Quelles espèces te font envie ?" subtitle="Ta liste de souhaits : tu la testeras ensuite dans le simulateur de peuplement. Tu peux aussi passer." icon="fish" tone="var(--green)" {direction}>
				{#if d.wishes.length}
					<Section header="Souhaits ({d.wishes.length})">
						{#each d.wishes as w (w.key)}
							<li class="pl-4">
								<div class="row-body flex min-h-14 items-center gap-3 py-2 pr-4">
									<span class="min-w-0 flex-1">
										<span class="body block truncate">{speciesName(w.species)}</span>
										<span class="footnote block truncate italic text-label2">{w.species.scientificName}</span>
									</span>
									<button type="button" class="text-red active:opacity-40" aria-label="Retirer {speciesName(w.species)}" onclick={() => (d.wishes = d.wishes.filter((x) => x.key !== w.key))}><Icon name="close" size={20} weight={2.4} /></button>
								</div>
							</li>
						{/each}
					</Section>
				{/if}
				<SpeciesPicker onpick={addWish} water={speciesWater} placeholder="Chercher une espèce" />
			</WizardStep>
		{:else if current === 'recap'}
			<WizardStep
				title={d.stage === 'projet' ? 'Ton projet est prêt' : 'Tout est bon ?'}
				subtitle={d.stage === 'projet'
					? 'Je crée la fiche projet. Quand tout sera prêt, un bouton lancera la mise en eau.'
					: d.stage === 'cyclage'
						? 'Je suivrai ton cyclage : je te dirai quand tu pourras ajouter des poissons.'
						: 'Voici ce que je vais créer. Tout reste modifiable depuis le bac.'}
				icon="check"
				tone="var(--green)"
				{direction}
			>
				<Section>
					<Row title="Nom" value={d.name.trim()} />
					<Row title="Type d’eau" value={WATER_TYPE_LABELS[d.waterType]} />
					{#if volumeNum && !Number.isNaN(volumeNum)}<Row title="Volume" value="{fmt(volumeNum, 0)} L" />{/if}
					{#if d.stage === 'actif' && effectiveStart}<Row title="Mise en eau" value={d.dateMode === 'unknown' ? `≈ ${d.months} mois` : fmtDate(effectiveStart)} />{/if}
					{#if d.stage === 'cyclage'}<Row title="Début du cyclage" value={fmtDate(d.cycleStart)} />{/if}
				</Section>
				{#if d.stage === 'actif'}
					<Section>
						<Row title="Habitants" value={d.habitants.length ? `${d.habitants.reduce((s, h) => s + h.quantity, 0)}` : 'Aucun'} />
						<Row title="Mesures" value={measTemplate.filter((p) => (d.meas[p.key ?? ''] ?? '').trim() !== '').length ? `${measTemplate.filter((p) => (d.meas[p.key ?? ''] ?? '').trim() !== '').length} valeur(s)` : 'Aucune'} />
						<Row title="Dernier changement d’eau" value={d.lastWaterChange ? fmtDate(d.lastWaterChange) : 'Non renseigné'} />
					</Section>
				{/if}
				{#if d.stage === 'cyclage'}
					<Section>
						<Row title="Source d’ammoniac" value={SOURCES.find((s) => s.value === d.source)?.label} />
						<Row title="Tests saisis" value={measTemplate.filter((p) => (d.meas[p.key ?? ''] ?? '').trim() !== '').length ? `${measTemplate.filter((p) => (d.meas[p.key ?? ''] ?? '').trim() !== '').length} valeur(s)` : 'Aucun'} />
					</Section>
				{/if}
				{#if d.stage !== 'projet'}
					<Section header="Tâches créées" footer="Modifiables dans l’onglet Tâches du bac.">
						{#each d.tasks.filter((t) => t.on) as t (t.title)}
							<Row title={t.title} value={t.everyDays === 1 ? 'Chaque jour' : `Tous les ${t.everyDays} j`} />
						{:else}
							<Row title="Aucune tâche" />
						{/each}
					</Section>
				{:else}
					<Section header="Dans le projet">
						<Row title="Matériel" value={equipChosen || d.custom.length ? `${suggestions.filter((l) => d.equip[l]?.on).length + d.custom.length} élément(s)${total > 0 ? ` · ${euro(total)}` : ''}` : 'Aucun'} />
						<Row title="Espèces souhaitées" value={d.wishes.length ? `${d.wishes.length}` : 'Aucune'} />
						<Row title="Étapes à cocher" value="2" />
					</Section>
				{/if}
			</WizardStep>
		{/if}
	</div>

	{#if stepIdx > 0}
		<div class="bar-material sticky bottom-0 -mx-4 mt-6 flex gap-3 px-4 pt-3" style="padding-bottom: max(12px, env(safe-area-inset-bottom))">
			{#if stepError}<p class="sr-only" role="alert">{stepError}</p>{/if}
			<button type="button" class="btn-tinted min-w-24" onclick={back} disabled={busy}>Retour</button>
			{#if current === 'recap'}
				<button type="button" class="btn-filled flex-1" onclick={submit} disabled={busy}>
					{busy ? 'Création…' : d.stage === 'projet' ? 'Créer le projet' : 'Créer le bac'}
				</button>
			{:else}
				<button type="button" class="{skippable ? 'btn-tinted' : 'btn-filled'} flex-1" onclick={next} disabled={Boolean(stepError)}>
					{skippable ? 'Passer' : 'Continuer'}
				</button>
			{/if}
		</div>
		{#if stepError}<p class="footnote -mt-1 mb-2 text-center text-red">{stepError}</p>{/if}
	{/if}
</div>

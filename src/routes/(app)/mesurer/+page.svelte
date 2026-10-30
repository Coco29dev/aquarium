<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { dayInParis } from '$lib/domain/dates';
	import { tankHealth } from '$lib/tank';
	import { TANK_TONE, fmt, relativeDay } from '$lib/ui';
	import Icon from '$lib/components/Icon.svelte';
	import Section from '$lib/ios/Section.svelte';
	import Row from '$lib/ios/Row.svelte';
	import Segmented from '$lib/ios/Segmented.svelte';
	import StepButtons from '$lib/ios/StepButtons.svelte';
	import Switch from '$lib/ios/Switch.svelte';
	import type { Aquarium, Parameter } from '$lib/types';

	// Feuille modale « Ajouter des données », façon Santé.
	const view = $derived(store.view);
	const aquariums = $derived(view?.aquariums ?? []);

	// Dernière mesure de chaque bac, pour présélectionner celui qui attend le plus.
	function lastMeasuredAt(a: Aquarium): string {
		let latest = '';
		for (const m of view?.measurements ?? []) if (m.aquariumId === a.id && m.measuredAt > latest) latest = m.measuredAt;
		return latest;
	}
	const preferred = $derived.by(() => {
		const asked = Number(page.url.searchParams.get('bac'));
		if (aquariums.some((a) => a.id === asked)) return asked;
		const sorted = [...aquariums].sort((a, b) => lastMeasuredAt(a).localeCompare(lastMeasuredAt(b)));
		return sorted[0]?.id ?? null;
	});
	let chosen = $state<number | null>(null);
	const tankId = $derived(chosen ?? preferred);
	const tank = $derived(aquariums.find((a) => a.id === tankId));

	const parameters = $derived((view?.parameters ?? []).filter((p) => p.aquariumId === tankId));
	const cycling = $derived(view && tank ? Boolean(tankHealth(view, tank).coach) : false);
	const CYCLE_KEYS = ['nh3', 'no2', 'no3'];
	let cycleOnly = $state<boolean | null>(null);
	const onlyCycle = $derived(cycleOnly ?? cycling);
	const hasCycleParams = $derived(parameters.some((p) => p.key && CYCLE_KEYS.includes(p.key)));
	const shown = $derived(onlyCycle && hasCycleParams ? parameters.filter((p) => p.key && CYCLE_KEYS.includes(p.key)) : parameters);

	const lastOf = (p: Parameter) => {
		const list = (view?.measurements ?? []).filter((m) => m.parameterId === p.id);
		return list.length ? list[list.length - 1] : null;
	};

	// Brouillon : texte saisi et confirmation. Seules les valeurs confirmées (en noir) sont ajoutées.
	let drafts = $state<Record<number, string>>({});
	let confirmed = $state<Record<number, boolean>>({});

	function selectTank(id: number) {
		chosen = id;
		cycleOnly = null;
		drafts = {};
		confirmed = {};
	}

	const parse = (text: string): number | null => {
		const v = Number(text.trim().replace(',', '.'));
		return text.trim() === '' || !Number.isFinite(v) ? null : v;
	};
	const plain = (v: number, p: Parameter) => fmt(v, p.decimals).replace(/\s/g, '');
	function shownText(p: Parameter): string {
		if (drafts[p.id] !== undefined) return drafts[p.id];
		const last = lastOf(p);
		return last ? plain(last.value, p) : '';
	}
	const valueOf = (p: Parameter) => parse(shownText(p));

	function set(p: Parameter, text: string) {
		drafts[p.id] = text;
		confirmed[p.id] = parse(text) != null;
	}
	function nudge(p: Parameter, direction: 1 | -1) {
		const base = valueOf(p) ?? p.min ?? 0;
		const next = Math.max(0, Math.round((base + direction * p.step) * 1e6) / 1e6);
		set(p, plain(next, p));
	}
	/** Toucher une valeur grise la reprend telle quelle. */
	function focusValue(p: Parameter, input: HTMLInputElement) {
		if (!confirmed[p.id] && valueOf(p) != null) confirmed[p.id] = true;
		input.select();
	}
	function allSame() {
		for (const p of shown) {
			const last = lastOf(p);
			if (last) set(p, plain(last.value, p));
		}
	}

	const outOfRange = (p: Parameter, v: number | null) =>
		v != null && ((p.max != null && v > p.max) || (p.min != null && v < p.min));
	const range = (p: Parameter) => {
		const unit = p.unit ? ` ${p.unit}` : '';
		if (p.min != null && p.max != null) return `${fmt(p.min, p.decimals)} – ${fmt(p.max, p.decimals)}${unit}`;
		if (p.max != null) return `≤ ${fmt(p.max, p.decimals)}${unit}`;
		if (p.min != null) return `≥ ${fmt(p.min, p.decimals)}${unit}`;
		return '';
	};

	const ready = $derived(parameters.filter((p) => confirmed[p.id] && valueOf(p) != null));
	const warnings = $derived(
		ready
			.filter((p) => outOfRange(p, valueOf(p)))
			.map((p) => {
				const v = valueOf(p)!;
				return p.max != null && v > p.max
					? `${p.name} au-dessus de la plage (max ${fmt(p.max, p.decimals)}).`
					: `${p.name} en dessous de la plage (min ${fmt(p.min ?? 0, p.decimals)}).`;
			})
	);

	const today = dayInParis();
	const ago = (iso: string) => {
		const r = relativeDay(dayInParis(iso), today);
		return r === "aujourd'hui" ? `auj. ${new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : r;
	};

	// Date de la mesure : maintenant par défaut, ou choisie (test fait plus tôt).
	let whenLocal = $state('');
	let pickingDate = $state(false);
	const pad = (n: number) => String(n).padStart(2, '0');
	const toLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	const nowLocal = () => toLocal(new Date());
	const whenLabel = $derived.by(() => {
		if (!whenLocal) return 'Maintenant';
		const d = new Date(whenLocal);
		const day = relativeDay(dayInParis(d), today);
		const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
		if (day === "aujourd'hui") return `Aujourd’hui, ${time}`;
		if (day === 'hier') return `Hier, ${time}`;
		return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}, ${time}`;
	});

	let saving = $state(false);
	function close() {
		if (history.length > 1) history.back();
		else void goto('/');
	}
	async function cancel() {
		if (
			ready.length &&
			!(await ui.confirm({
				title: 'Abandonner ces mesures ?',
				message: `${ready.length} valeur${ready.length > 1 ? 's' : ''} ne ser${ready.length > 1 ? 'ont' : 'a'} pas ajoutée${ready.length > 1 ? 's' : ''}.`,
				confirmLabel: 'Abandonner',
				cancelLabel: 'Continuer',
				destructive: true
			}))
		)
			return;
		close();
	}
	async function save() {
		if (!tank || !ready.length || saving) return;
		saving = true;
		const values = ready.map((p) => ({ parameterId: p.id, value: valueOf(p)! }));
		try {
			await store.addMeasurements(tank.id, values, whenLocal ? new Date(whenLocal).toISOString() : undefined);
			ui.show(`${values.length} mesure${values.length > 1 ? 's' : ''} ajoutée${values.length > 1 ? 's' : ''} · ${tank.name}`, undefined, 'check');
			drafts = {};
			confirmed = {};
			close();
		} catch (e) {
			ui.show((e as Error).message);
		} finally {
			saving = false;
		}
	}

	let scrolled = $state(false);
	$effect(() => {
		const update = () => (scrolled = window.scrollY > 2);
		addEventListener('scroll', update, { passive: true });
		return () => removeEventListener('scroll', update);
	});
</script>

<svelte:head><title>Mesures · Aquarium</title></svelte:head>

<div
	class="sticky top-0 z-20 -mx-4 transition-[background-color,box-shadow] duration-200 {scrolled ? 'bar-material shadow-[0_0.5px_0_var(--sep)]' : 'bg-bg'}"
	style="padding-top: env(safe-area-inset-top)"
>
	<div class="grid h-14 grid-cols-[1fr_auto_1fr] items-center px-4">
		<button class="btn-plain justify-self-start" onclick={cancel}>Annuler</button>
		<h1 class="headline">Mesures</h1>
		<button class="btn-plain justify-self-end font-semibold" disabled={!ready.length || saving} onclick={save}>
			Ajouter{ready.length > 1 ? ` (${ready.length})` : ''}
		</button>
	</div>
</div>

{#if aquariums.length === 0}
	<div class="mt-20 flex flex-col items-center px-6 text-center">
		<span class="mb-3 text-label3"><Icon name="drop" size={56} weight={1.4} /></span>
		<h2 class="title3">Aucun bac</h2>
		<p class="subhead mt-1 text-label2">Ajoute d’abord un aquarium pour y noter des mesures.</p>
		<a href="/aquariums/nouveau" class="btn-tinted mt-5">Ajouter un bac</a>
	</div>
{:else if tank}
	<div class="mb-6 mt-2">
		{#if aquariums.length <= 3}
			<Segmented
				label="Bac"
				options={aquariums.map((a) => ({ value: a.id, label: a.name }))}
				value={tank.id}
				onchange={(v) => selectTank(v)}
			/>
		{:else}
			<label class="group flex min-h-11 items-center gap-3 px-4">
				<span class="body flex-1">Bac</span>
				<select class="body bg-transparent text-right text-label2 outline-none" value={tank.id} onchange={(e) => selectTank(Number(e.currentTarget.value))}>
					{#each aquariums as a (a.id)}<option value={a.id}>{a.name}</option>{/each}
				</select>
			</label>
		{/if}
	</div>

	<Section>
		<!-- Le lien remplace l'entrée d'historique : à la fin du pas à pas, on revient d'où l'on venait. -->
		<li>
			<a href="/mesurer/pas-a-pas?bac={tank.id}" data-sveltekit-replacestate class="tappable flex items-center gap-3 pl-4">
				<span class="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px] text-white" style="background: var(--indigo); --cut: var(--indigo)">
					<Icon name="flask" size={19} filled weight={2} />
				</span>
				<div class="row-body flex min-h-11 min-w-0 flex-1 items-center gap-3 py-2.5 pr-4">
					<div class="min-w-0 flex-1 text-left">
						<p class="body truncate">Pas à pas</p>
						<p class="subhead truncate text-label2">Un test à la fois, avec minuteur</p>
					</div>
					<span class="-mr-1 shrink-0 text-label3"><Icon name="next" size={18} weight={2.4} /></span>
				</div>
			</a>
		</li>
		<Row icon="calendar" title="Date" onclick={() => (pickingDate = !pickingDate)} chevron={false}>
			{#snippet trailing()}
				<span class="body {whenLocal ? 'text-tint' : 'text-label2'}">{whenLabel}</span>
			{/snippet}
		</Row>
		{#if pickingDate}
			<li class="pl-4">
				<div class="row-body flex min-h-11 flex-wrap items-center justify-end gap-2 py-2 pr-4">
					<input
						type="datetime-local"
						aria-label="Date et heure de la mesure"
						class="body rounded-lg bg-fill3 px-2.5 py-1 text-right outline-none"
						max={nowLocal()}
						value={whenLocal || nowLocal()}
						onchange={(e) => {
							const v = e.currentTarget.value;
							whenLocal = v && new Date(v).getTime() < Date.now() - 60_000 ? v : '';
						}}
					/>
					{#if whenLocal}
						<button class="btn-plain subhead" onclick={() => (whenLocal = '')}>Maintenant</button>
					{/if}
				</div>
			</li>
		{/if}
		<Row icon="undo" title="Reprendre les dernières valeurs" action onclick={allSame} />
		{#if hasCycleParams}
			<Row icon="cycle" title="Tests du cyclage seulement">
				{#snippet trailing()}
					<Switch checked={onlyCycle} label="Tests du cyclage seulement" onchange={(e) => (cycleOnly = e.currentTarget.checked)} />
				{/snippet}
			</Row>
		{/if}
	</Section>

	<section class="mb-8">
		<h2 class="footnote flex items-center gap-1.5 px-4 pb-1.5 uppercase text-label2">
			<span class="h-2 w-2 rounded-full" style="background: {TANK_TONE[tank.waterType]}"></span>
			{tank.name}
		</h2>
		{#if shown.length === 0}
			<p class="group subhead px-4 py-3 text-label2">Aucun paramètre suivi pour ce bac.</p>
		{:else}
			<ul class="group measure-list">
				{#each shown as p (p.id)}
					{@const v = valueOf(p)}
					{@const last = lastOf(p)}
					{@const isSet = Boolean(confirmed[p.id])}
					{@const out = isSet && outOfRange(p, v)}
					<li class="pl-4">
						<div class="row-body flex flex-col gap-1 py-2.5 pr-3">
							<div class="flex items-baseline gap-2">
								<p class="body min-w-0 flex-1 truncate">{p.name}</p>
								<label class="flex shrink-0 items-baseline gap-1">
									<input
										class="rounded-num w-24 bg-transparent text-right text-[22px] font-semibold outline-none placeholder:text-label3 {out ? 'text-red' : isSet ? 'text-label' : 'text-label3'}"
										inputmode="decimal"
										enterkeyhint="next"
										placeholder="–"
										value={shownText(p)}
										onfocus={(e) => focusValue(p, e.currentTarget)}
										oninput={(e) => set(p, e.currentTarget.value)}
										aria-label="{p.name}{p.unit ? ` en ${p.unit}` : ''}"
									/>
									<span class="footnote w-10 truncate text-label2">{p.unit}</span>
								</label>
							</div>
							<div class="flex items-center gap-2">
								<p class="footnote min-w-0 flex-1 truncate text-label2">
									{#if range(p)}Plage {range(p)}{/if}{#if last}{range(p) ? ' · ' : ''}{ago(last.measuredAt)}{/if}
								</p>
								<StepButtons label={p.name} onminus={() => nudge(p, -1)} onplus={() => nudge(p, 1)} minusDisabled={(v ?? 0) <= 0} />
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
		{#if warnings.length}
			<p class="footnote px-4 pt-1.5 text-red">{warnings.join(' ')}</p>
		{:else}
			<p class="footnote px-4 pt-1.5 text-label2">
				Les valeurs en gris sont les dernières mesures : touche-en une pour la reprendre, ou change-la. Seules les valeurs en noir seront ajoutées.
			</p>
		{/if}
	</section>
{/if}

<style>
	.measure-list > li + li .row-body {
		box-shadow: inset 0 0.5px 0 var(--sep);
	}
</style>

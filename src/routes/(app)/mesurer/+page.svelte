<script lang="ts">
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { dayInParis } from '$lib/domain/dates';
	import { tankHealth } from '$lib/tank';
	import { SHORT_WATER, TANK_TONE, fmt, relativeDay } from '$lib/ui';
	import Icon from '$lib/components/Icon.svelte';
	import RangeBar from '$lib/components/RangeBar.svelte';
	import type { Aquarium, Parameter } from '$lib/types';

	const view = $derived(store.view);
	const aquariums = $derived(view?.aquariums ?? []);

	// Dernière mesure (toutes valeurs confondues) de chaque bac, pour présélectionner le plus en retard.
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
	let filter = $state<'tous' | 'cyclage' | null>(null);
	const mode = $derived(filter ?? (cycling ? 'cyclage' : 'tous'));
	const shown = $derived(
		mode === 'cyclage' ? parameters.filter((p) => p.key && CYCLE_KEYS.includes(p.key)) : parameters
	);

	const lastOf = (p: Parameter) => {
		const list = (view?.measurements ?? []).filter((m) => m.parameterId === p.id);
		return list.length ? list[list.length - 1] : null;
	};

	// Brouillon par paramètre : texte affiché et confirmation (seules les valeurs confirmées sont enregistrées).
	let drafts = $state<Record<number, string>>({});
	let confirmed = $state<Record<number, boolean>>({});

	function selectTank(id: number) {
		chosen = id;
		filter = null;
		drafts = {};
		confirmed = {};
		receipt = null;
	}

	const parse = (text: string): number | null => {
		const v = Number(text.trim().replace(',', '.'));
		return text.trim() === '' || !Number.isFinite(v) ? null : v;
	};
	function shownText(p: Parameter): string {
		if (drafts[p.id] !== undefined) return drafts[p.id];
		const last = lastOf(p);
		return last ? fmt(last.value, p.decimals).replace(/\s/g, '') : '';
	}
	const valueOf = (p: Parameter) => parse(shownText(p));

	function set(p: Parameter, text: string) {
		drafts[p.id] = text;
		confirmed[p.id] = parse(text) != null;
	}
	function nudge(p: Parameter, direction: 1 | -1) {
		const base = valueOf(p) ?? p.min ?? 0;
		const next = Math.max(0, Math.round((base + direction * p.step) * 1e6) / 1e6);
		set(p, fmt(next, p.decimals).replace(/\s/g, ''));
	}
	function same(p: Parameter) {
		const last = lastOf(p);
		if (last) set(p, fmt(last.value, p.decimals).replace(/\s/g, ''));
	}
	function toggle(p: Parameter) {
		if (confirmed[p.id]) confirmed[p.id] = false;
		else if (valueOf(p) != null) confirmed[p.id] = true;
	}
	function allSame() {
		for (const p of shown) if (lastOf(p)) same(p);
	}

	function verdict(p: Parameter, v: number | null): { text: string; cls: string } | null {
		if (v == null) return null;
		const unit = p.unit ? ` ${p.unit}` : '';
		if (p.max != null && v > p.max) return { text: `Au-dessus de la plage (max ${fmt(p.max, p.decimals)}${unit})`, cls: 'text-bad' };
		if (p.min != null && v < p.min) return { text: `En dessous de la plage (min ${fmt(p.min, p.decimals)}${unit})`, cls: 'text-bad' };
		if (p.min != null || p.max != null) return { text: 'Dans la plage', cls: 'text-ok' };
		return null;
	}

	const ready = $derived(parameters.filter((p) => confirmed[p.id] && valueOf(p) != null));

	interface Receipt {
		tankId: number;
		at: string;
		lines: { name: string; value: string; out: boolean }[];
	}
	let receipt = $state<Receipt | null>(null);
	let saving = $state(false);

	async function save() {
		if (!tank || !ready.length || saving) return;
		saving = true;
		const values = ready.map((p) => ({ parameterId: p.id, value: valueOf(p)! }));
		const lines = ready.map((p) => {
			const v = valueOf(p)!;
			const out = (p.max != null && v > p.max) || (p.min != null && v < p.min);
			return { name: p.name, value: `${fmt(v, p.decimals)}${p.unit ? ` ${p.unit}` : ''}`, out };
		});
		try {
			await store.addMeasurements(tank.id, values);
			receipt = { tankId: tank.id, at: new Date().toISOString(), lines };
			drafts = {};
			confirmed = {};
			ui.show(`${values.length} mesure${values.length > 1 ? 's' : ''} enregistrée${values.length > 1 ? 's' : ''}`);
			scrollTo({ top: 0, behavior: 'smooth' });
		} finally {
			saving = false;
		}
	}

	const receiptTank = $derived(receipt ? aquariums.find((a) => a.id === receipt!.tankId) : undefined);
	const outCount = $derived(receipt?.lines.filter((l) => l.out).length ?? 0);
	const today = dayInParis();
	const ago = (iso: string) => {
		const r = relativeDay(dayInParis(iso), today);
		return r === "aujourd'hui" ? `aujourd'hui à ${new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : r;
	};
</script>

<svelte:head><title>Mesurer · Bulle</title></svelte:head>

<header class="rise mb-5">
	<p class="num mb-1.5 text-xs uppercase tracking-wider text-muted">Saisie des tests</p>
	<h1 class="display text-[2.6rem]">Mesurer</h1>
	<p class="hand mt-2 text-xl leading-snug text-muted">
		{#if ready.length}{ready.length} valeur{ready.length > 1 ? 's' : ''} prête{ready.length > 1 ? 's' : ''} à noter.{:else}Les dernières valeurs sont déjà là : touche ce qui a changé.{/if}
	</p>
</header>

{#if aquariums.length === 0}
	<section class="card flex flex-col items-start gap-3 p-5">
		<p class="hand text-lg text-muted">Il faut d'abord un bac pour noter des mesures.</p>
		<a href="/aquariums/nouveau" class="btn">Créer un bac</a>
	</section>
{:else}
	<!-- Choix du bac -->
	<div class="rise -mx-5 mb-5 flex gap-2 overflow-x-auto px-5 pb-1 pt-1" style="scrollbar-width: none; animation-delay: 40ms" role="tablist" aria-label="Bac">
		{#each aquariums as a (a.id)}
			{@const on = a.id === tankId}
			<button
				role="tab"
				aria-selected={on}
				onclick={() => selectTank(a.id)}
				class="press flex shrink-0 items-center gap-2 rounded-xl border-2 border-edge px-3.5 py-2 text-sm font-bold {on ? 'shadow-[3px_3px_0_var(--shadow)]' : 'bg-surface text-muted'}"
				style={on ? `background: ${TANK_TONE[a.waterType]}` : ''}
			>
				<span class="h-3 w-3 rounded-full border-[1.5px] border-edge" style="background: {TANK_TONE[a.waterType]}"></span>
				{a.name}
			</button>
		{/each}
	</div>

	{#if receipt && receiptTank}
		<!-- Ticket de la saisie qui vient d'être faite -->
		<section class="card rise relative mb-6 overflow-hidden" aria-live="polite">
			<div class="flex items-center justify-between border-b-2 border-dashed border-edge px-4 py-3" style="background: {TANK_TONE[receiptTank.waterType]}">
				<p class="display text-lg">Noté pour {receiptTank.name}</p>
				<span class="num text-xs">{new Date(receipt.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
			</div>
			<ul class="flex flex-col gap-1 px-4 py-3">
				{#each receipt.lines as line (line.name)}
					<li class="flex items-baseline justify-between gap-3 text-sm">
						<span class="truncate {line.out ? 'font-bold text-bad' : 'text-muted'}">{line.name}</span>
						<span class="num {line.out ? 'text-bad' : ''}">{line.value}</span>
					</li>
				{/each}
			</ul>
			{#if outCount}
				<p class="mx-4 mb-3 flex items-center gap-2 rounded-lg bg-bad-soft px-3 py-2 text-sm font-bold text-bad">
					<Icon name="alert" size={16} />{outCount} valeur{outCount > 1 ? 's' : ''} hors plage
				</p>
			{:else}
				<p class="hand mx-4 mb-3 text-lg text-ok">Tout est dans la plage.</p>
			{/if}
			<div class="grid grid-cols-2 border-t-2 border-edge">
				<a href="/aquariums/{receipt.tankId}" class="flex items-center justify-center gap-1.5 border-r-2 border-edge py-3 text-sm font-bold active:bg-surface2">
					<Icon name="chart" size={16} />Voir le suivi
				</a>
				<button onclick={() => (receipt = null)} class="flex items-center justify-center gap-1.5 py-3 text-sm font-bold active:bg-surface2">
					<Icon name="close" size={16} />Fermer
				</button>
			</div>
		</section>
	{/if}

	{#if tank}
		<!-- Raccourcis -->
		<div class="rise mb-4 flex flex-wrap items-center gap-2" style="animation-delay: 80ms">
			{#if parameters.some((p) => p.key && CYCLE_KEYS.includes(p.key))}
				<div class="flex rounded-xl border-2 border-edge bg-surface p-0.5 text-sm font-bold" role="group" aria-label="Paramètres affichés">
					<button class="rounded-lg px-3 py-1.5 {mode === 'tous' ? 'bg-ink text-on-ink' : 'text-muted'}" aria-pressed={mode === 'tous'} onclick={() => (filter = 'tous')}>Tous</button>
					<button class="rounded-lg px-3 py-1.5 {mode === 'cyclage' ? 'bg-ink text-on-ink' : 'text-muted'}" aria-pressed={mode === 'cyclage'} onclick={() => (filter = 'cyclage')}>Tests du cyclage</button>
				</div>
			{/if}
			<button class="btn-ghost min-h-0 px-3 py-1.5 text-sm" onclick={allSame}>
				<Icon name="undo" size={16} />Tout pareil que la dernière fois
			</button>
		</div>

		{#if shown.length === 0}
			<p class="hand text-lg text-muted">Aucun paramètre suivi pour ce bac. Ajoute-en dans ses réglages.</p>
		{/if}

		<ul class="flex flex-col gap-3.5">
			{#each shown as p, i (p.id)}
				{@const last = lastOf(p)}
				{@const v = valueOf(p)}
				{@const on = Boolean(confirmed[p.id])}
				{@const verdictNow = on ? verdict(p, v) : null}
				{@const out = verdictNow?.cls === 'text-bad'}
				<li
					class="rise {on ? 'card' : 'card-flat border-dashed'} {out ? 'border-bad!' : ''} overflow-hidden transition-shadow"
					style="animation-delay: {Math.min(i, 8) * 30 + 100}ms"
				>
					<div class="flex items-start justify-between gap-3 px-4 pt-3">
						<div class="min-w-0">
							<p class="font-bold leading-tight">{p.name}</p>
							<p class="text-xs text-muted">
								{#if last}Dernière : <span class="num">{fmt(last.value, p.decimals)}</span> · {ago(last.measuredAt)}{:else}Jamais mesuré{/if}
							</p>
						</div>
						<button
							onclick={() => toggle(p)}
							class="chip shrink-0 {on ? 'border-edge bg-ink text-on-ink' : 'text-muted'}"
							aria-pressed={on}
							aria-label="{on ? 'Ne pas enregistrer' : 'Enregistrer'} {p.name}"
						>
							{#if on}<Icon name="check" size={12} />À noter{:else}Non saisi{/if}
						</button>
					</div>

					<div class="flex items-center gap-3 px-4 py-2">
						<button
							onclick={() => nudge(p, -1)}
							class="press grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-edge bg-surface text-2xl font-bold shadow-[2px_2px_0_var(--shadow)]"
							aria-label="Diminuer {p.name} de {p.step}"
						>−</button>
						<label class="flex min-w-0 flex-1 flex-col items-center">
							<span class="sr-only">Valeur de {p.name}</span>
							<input
								value={shownText(p)}
								oninput={(e) => set(p, e.currentTarget.value)}
								onfocus={(e) => e.currentTarget.select()}
								inputmode="decimal"
								enterkeyhint="next"
								placeholder="—"
								class="num w-full bg-transparent text-center text-[2.3rem] leading-none outline-none"
								style="color: {on ? (out ? 'var(--bad)' : 'var(--ink)') : 'color-mix(in srgb, var(--muted) 65%, transparent)'}"
							/>
							<span class="num text-xs text-muted">{p.unit || ' '}</span>
						</label>
						<button
							onclick={() => nudge(p, 1)}
							class="press grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-edge bg-surface text-2xl font-bold shadow-[2px_2px_0_var(--shadow)]"
							aria-label="Augmenter {p.name} de {p.step}"
						>+</button>
					</div>

					<div class="flex flex-col gap-2 px-4 pb-3">
						<RangeBar value={v} min={p.min} max={p.max} />
						<div class="flex items-center justify-between gap-2 text-xs">
							{#if verdictNow}
								<span class="font-bold {verdictNow.cls}">{verdictNow.text}</span>
							{:else if p.min != null || p.max != null}
								<span class="text-muted">Plage {fmt(p.min, p.decimals)} – {fmt(p.max, p.decimals)} {p.unit}</span>
							{:else}
								<span></span>
							{/if}
							{#if last && !on}
								<button onclick={() => same(p)} class="press shrink-0 rounded-lg border-2 border-edge bg-sun px-2.5 py-1 font-bold text-[#16202e]">
									= Pareil
								</button>
							{/if}
						</div>
					</div>
				</li>
			{/each}
		</ul>

		<p class="hand mt-6 text-center text-base text-muted">
			{SHORT_WATER[tank.waterType]} · les saisies hors connexion partent à la prochaine ouverture.
		</p>
	{/if}

	{#if ready.length}
		<div
			class="rise fixed inset-x-0 z-20 px-4"
			style="bottom: calc(max(0.75rem, env(safe-area-inset-bottom)) + 5.75rem)"
		>
			<button onclick={save} disabled={saving} class="btn mx-auto flex w-full max-w-md text-base">
				<Icon name="check" size={20} />
				Enregistrer {ready.length} mesure{ready.length > 1 ? 's' : ''}
			</button>
		</div>
	{/if}
{/if}

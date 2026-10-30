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
	import StepFlow from '$lib/ios/StepFlow.svelte';
	import TestTimer from '$lib/ios/TestTimer.svelte';
	import type { Aquarium, Parameter } from '$lib/types';

	// Saisie « pas à pas » : un paramètre par écran, pavé numérique, minuteur du réactif.
	const view = $derived(store.view);
	const aquariums = $derived((view?.aquariums ?? []).filter((a) => (a.stage ?? 'actif') !== 'projet'));

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

	// Ordre des écrans : les tests du cyclage d'abord quand le bac cycle.
	const CYCLE_KEYS = ['nh3', 'no2', 'no3'];
	const cycling = $derived(view && tank ? Boolean(tankHealth(view, tank).coach) || tank.stage === 'cyclage' : false);
	const steps = $derived.by(() => {
		const all = (view?.parameters ?? []).filter((p) => p.aquariumId === tankId);
		if (!cycling) return all;
		const first = CYCLE_KEYS.map((k) => all.find((p) => p.key === k)).filter((p): p is Parameter => Boolean(p));
		return [...first, ...all.filter((p) => !first.includes(p))];
	});
	const count = $derived(steps.length + 1); // + récapitulatif
	let index = $state(0);
	const onRecap = $derived(index >= steps.length);
	// Chaque écran commence en haut : titre, valeur et pavé d'un seul regard.
	$effect(() => {
		void index;
		window.scrollTo({ top: 0 });
	});

	const lastOf = (p: Parameter) => {
		const list = (view?.measurements ?? []).filter((m) => m.parameterId === p.id);
		return list.length ? list[list.length - 1] : null;
	};

	// --- Valeurs : brouillon texte + confirmation (une valeur grise n'est jamais enregistrée).
	let drafts = $state<Record<number, string>>({});
	let confirmed = $state<Record<number, boolean>>({});

	const parse = (text: string): number | null => {
		const v = Number(text.trim().replace(',', '.'));
		return text.trim() === '' || text.trim() === '-' || !Number.isFinite(v) ? null : v;
	};
	const plain = (v: number, p: Parameter) => fmt(v, p.decimals).replace(/\s/g, '');
	function shownText(p: Parameter): string {
		if (drafts[p.id] !== undefined) return drafts[p.id];
		const last = lastOf(p);
		return last ? plain(last.value, p) : '';
	}
	const valueOf = (p: Parameter) => parse(shownText(p));
	const isSet = (p: Parameter) => Boolean(confirmed[p.id]) && valueOf(p) != null;

	function set(p: Parameter, text: string) {
		drafts[p.id] = text;
		confirmed[p.id] = parse(text) != null;
	}
	function press(p: Parameter, key: string) {
		const live = confirmed[p.id] ? (drafts[p.id] ?? '') : '';
		let text = live;
		if (key === 'back') {
			if (!confirmed[p.id]) return;
			text = live.slice(0, -1);
			if (text === '' || text === '-') {
				delete drafts[p.id];
				confirmed[p.id] = false;
				return;
			}
			return set(p, text);
		}
		if (key === ',') {
			if (text.includes(',')) return;
			text = text === '' || text === '-' ? `${text}0,` : `${text},`;
		} else {
			if (text.replace(/[-,]/g, '').length >= 7) return;
			text = text === '0' ? key : text + key;
		}
		set(p, text);
	}
	function negate(p: Parameter) {
		let text = shownText(p).trim() || '0';
		text = text.startsWith('-') ? text.slice(1) : `-${text}`;
		set(p, text);
	}
	function nudge(p: Parameter, dir: 1 | -1) {
		const base = valueOf(p) ?? p.min ?? 0;
		let next = Math.round((base + dir * p.step) * 1e6) / 1e6;
		if (base >= 0) next = Math.max(0, next);
		set(p, plain(next, p));
	}
	function same(p: Parameter) {
		const last = lastOf(p);
		if (last) set(p, plain(last.value, p));
	}
	function skip(p: Parameter) {
		delete drafts[p.id];
		confirmed[p.id] = false;
		next();
	}
	function next() {
		index = Math.min(count - 1, index + 1);
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
	const verdict = (p: Parameter): { text: string; tone: 'red' | 'green' | 'gray' } | null => {
		const v = valueOf(p);
		if (!isSet(p) || v == null) return null;
		if (p.max != null && v > p.max) return { text: `Au-dessus de la plage (max ${fmt(p.max, p.decimals)})`, tone: 'red' };
		if (p.min != null && v < p.min) return { text: `En dessous de la plage (min ${fmt(p.min, p.decimals)})`, tone: 'red' };
		if (p.min != null || p.max != null) return { text: 'Dans la plage', tone: 'green' };
		return null;
	};

	const today = dayInParis();
	const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
	const ago = (iso: string) => {
		const r = relativeDay(dayInParis(iso), today);
		return r === "aujourd'hui" ? `aujourd’hui à ${hhmm(iso)}` : r;
	};

	// --- Minuteurs de réaction : un par paramètre, décompte basé sur l'horloge (Date.now).
	interface Timer {
		endsAt: number;
		total: number;
		name: string;
		serverId?: number;
		notifyFailed?: boolean;
		done?: boolean;
		serverCancelled?: boolean;
	}
	let timers = $state<Record<number, Timer>>({});
	let now = $state(Date.now());

	let audio: AudioContext | null = null;
	function primeAudio() {
		try {
			const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
			if (Ctor) audio ??= new Ctor();
			void audio?.resume();
		} catch {
			// Son indisponible : le visuel suffit.
		}
	}
	function beep() {
		try {
			if (!audio) return;
			for (let k = 0; k < 3; k++) {
				const osc = audio.createOscillator();
				const gain = audio.createGain();
				osc.frequency.value = 880;
				gain.gain.value = 0.15;
				osc.connect(gain);
				gain.connect(audio.destination);
				const t = audio.currentTime + k * 0.3;
				osc.start(t);
				osc.stop(t + 0.15);
			}
		} catch {
			// Idem.
		}
	}

	let lock: WakeLockSentinel | null = null;
	async function syncWakeLock() {
		const running = Object.values(timers).some((t) => !t.done);
		try {
			if (running && !lock && document.visibilityState === 'visible' && 'wakeLock' in navigator) {
				lock = await navigator.wakeLock.request('screen');
				lock.addEventListener('release', () => (lock = null));
			} else if (!running && lock) {
				await lock.release();
				lock = null;
			}
		} catch {
			// L'écran peut s'éteindre : le push prend le relais.
		}
	}

	function checkTimers() {
		for (const t of Object.values(timers)) {
			if (t.done) continue;
			const left = t.endsAt - now;
			// En avant-plan, on annule le push serveur pour ne pas doubler le signal local.
			if (left <= 1500 && t.serverId != null && !t.serverCancelled && document.visibilityState === 'visible') {
				t.serverCancelled = true;
				void store.cancelTimer(t.serverId).catch(() => {});
			}
			if (left <= 0) {
				t.done = true;
				beep();
				ui.show(`${t.name} : le test est prêt`, undefined, 'check');
				void syncWakeLock();
			}
		}
	}

	$effect(() => {
		const tick = () => {
			now = Date.now();
			checkTimers();
		};
		const interval = setInterval(tick, 250);
		const visible = () => {
			tick();
			void syncWakeLock();
		};
		document.addEventListener('visibilitychange', visible);
		return () => {
			clearInterval(interval);
			document.removeEventListener('visibilitychange', visible);
			void lock?.release().catch(() => {});
			lock = null;
		};
	});

	async function startTimer(p: Parameter) {
		if (!tank || !p.testWaitSeconds) return;
		primeAudio();
		const seconds = p.testWaitSeconds;
		timers[p.id] = { endsAt: Date.now() + seconds * 1000, total: seconds, name: p.name };
		void syncWakeLock();
		// Le serveur n'accepte pas moins de 10 s : en dessous, le décompte local suffit.
		if (seconds < 10) return;
		try {
			const r = await store.startTimer(seconds, `${p.name} (${tank.name})`, `/mesurer/pas-a-pas?bac=${tank.id}`);
			if (timers[p.id]) timers[p.id].serverId = r.id;
			else void store.cancelTimer(r.id).catch(() => {});
		} catch {
			if (timers[p.id]) timers[p.id].notifyFailed = true;
		}
	}
	function cancelTimer(p: Parameter) {
		const t = timers[p.id];
		if (!t) return;
		delete timers[p.id];
		if (t.serverId != null && !t.serverCancelled) void store.cancelTimer(t.serverId).catch(() => {});
		void syncWakeLock();
	}
	const timerState = (p: Parameter) => (!timers[p.id] ? 'idle' : timers[p.id].done ? 'done' : 'running');
	const otherTimers = $derived(
		steps
			.map((p, i) => ({ p, i }))
			.filter(({ p, i }) => i !== index && timers[p.id])
	);

	// --- Date de la mesure (comme dans « Mesures »).
	let whenLocal = $state('');
	let pickingDate = $state(false);
	const pad = (n: number) => String(n).padStart(2, '0');
	const nowLocal = () => {
		const d = new Date();
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	};
	const whenLabel = $derived.by(() => {
		if (!whenLocal) return 'Maintenant';
		const d = new Date(whenLocal);
		const day = relativeDay(dayInParis(d), today);
		const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
		if (day === "aujourd'hui") return `Aujourd’hui, ${time}`;
		if (day === 'hier') return `Hier, ${time}`;
		return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}, ${time}`;
	});

	// --- Reprise : la progression survit à un retour à l'accueil ou à un rechargement.
	const STORE_KEY = 'aquarium:pas-a-pas';
	let restored = false;
	$effect(() => {
		if (restored || tankId == null || !view) return;
		restored = true;
		try {
			const raw = sessionStorage.getItem(STORE_KEY);
			if (!raw) return;
			const s = JSON.parse(raw);
			if (s.tankId !== tankId || Date.now() - s.at > 3 * 3600_000) return;
			drafts = s.drafts ?? {};
			confirmed = s.confirmed ?? {};
			whenLocal = s.whenLocal ?? '';
			timers = s.timers ?? {};
			index = Math.min(Math.max(0, Number(s.index) || 0), steps.length);
			void syncWakeLock();
		} catch {
			// Stockage indisponible ou corrompu : on repart de zéro.
		}
	});
	$effect(() => {
		if (!restored || tankId == null) return;
		const snapshot = { tankId, drafts: { ...drafts }, confirmed: { ...confirmed }, whenLocal, index, timers: { ...timers }, at: Date.now() };
		try {
			sessionStorage.setItem(STORE_KEY, JSON.stringify(snapshot));
		} catch {
			// Idem.
		}
	});

	const ready = $derived(steps.filter(isSet));
	const warnings = $derived(ready.filter((p) => outOfRange(p, valueOf(p))));

	async function selectTank(id: number) {
		if (id === tankId) return;
		if (
			ready.length &&
			!(await ui.confirm({ title: 'Changer de bac ?', message: 'Les valeurs saisies pour ce bac seront abandonnées.', confirmLabel: 'Changer', destructive: true }))
		)
			return;
		chosen = id;
		drafts = {};
		confirmed = {};
		index = 0;
		whenLocal = '';
	}

	let saving = $state(false);
	function close() {
		if (history.length > 1) history.back();
		else void goto('/');
	}
	function clearStored() {
		try {
			sessionStorage.removeItem(STORE_KEY);
		} catch {
			// Idem.
		}
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
		if (ready.length === 0) clearStored();
		close();
	}
	async function save() {
		if (!tank || !ready.length || saving) return;
		saving = true;
		const values = ready.map((p) => ({ parameterId: p.id, value: valueOf(p)! }));
		try {
			await store.addMeasurements(tank.id, values, whenLocal ? new Date(whenLocal).toISOString() : undefined);
			ui.show(`${values.length} mesure${values.length > 1 ? 's' : ''} ajoutée${values.length > 1 ? 's' : ''} · ${tank.name}`, undefined, 'check');
			clearStored();
			drafts = {};
			confirmed = {};
			close();
		} catch (e) {
			ui.show((e as Error).message);
		} finally {
			saving = false;
		}
	}

	// Grille 4 colonnes : chiffres à gauche, fonctions (effacer, signe, « Pareil ») à droite.
	const PAD = ['1', '2', '3', 'back', '4', '5', '6', 'sign', '7', '8', '9', 'same', ',', '0', 'next'];
	const FUNCTION_KEYS = ['back', 'sign', 'same'];
</script>

<svelte:head><title>Pas à pas · Aquarium</title></svelte:head>

<div class="sticky top-0 z-20 -mx-4 bg-bg" style="padding-top: env(safe-area-inset-top)">
	<div class="grid h-14 grid-cols-[1fr_auto_1fr] items-center px-4">
		<button class="btn-plain justify-self-start" onclick={cancel}>Annuler</button>
		<h1 class="headline">Pas à pas</h1>
		<button class="btn-plain justify-self-end font-semibold" disabled={onRecap || steps.length === 0} onclick={() => (index = steps.length)}>
			Récap
		</button>
	</div>
</div>

{#if aquariums.length === 0}
	<div class="mt-20 flex flex-col items-center px-6 text-center">
		<span class="mb-3 text-label3"><Icon name="drop" size={56} weight={1.4} /></span>
		<h2 class="title3">Aucun bac à mesurer</h2>
		<p class="subhead mt-1 text-label2">Ajoute d’abord un aquarium (un bac en projet n’a pas de mesures).</p>
	</div>
{:else if tank}
	<div class="mb-3 mt-1 flex items-center gap-2">
		{#if aquariums.length > 1}
			<label class="flex items-center gap-2 rounded-full bg-fill3 py-1.5 pl-3 pr-2.5">
				<span class="h-2.5 w-2.5 rounded-full" style="background: {TANK_TONE[tank.waterType]}"></span>
				<select
					class="subhead bg-transparent font-semibold outline-none"
					value={tank.id}
					onchange={(e) => void selectTank(Number(e.currentTarget.value))}
					aria-label="Bac"
				>
					{#each aquariums as a (a.id)}<option value={a.id}>{a.name}</option>{/each}
				</select>
			</label>
		{:else}
			<span class="subhead flex items-center gap-2 font-semibold">
				<span class="h-2.5 w-2.5 rounded-full" style="background: {TANK_TONE[tank.waterType]}"></span>{tank.name}
			</span>
		{/if}
		<span class="subhead ml-auto text-label2">
			{#if onRecap}Récapitulatif{:else}{index + 1} sur {steps.length}{/if}
		</span>
	</div>

	<!-- Avancement : un segment par paramètre, touchable -->
	<div class="mb-4 flex gap-1" role="tablist" aria-label="Avancement">
		{#each steps as p, i (p.id)}
			<button
				role="tab"
				aria-selected={i === index}
				aria-label={p.name}
				class="h-6 flex-1 py-[9px]"
				onclick={() => (index = i)}
			>
				<span class="block h-1.5 rounded-full transition-colors {i === index ? 'bg-label' : isSet(p) ? 'bg-tint' : 'bg-fill'}"></span>
			</button>
		{/each}
		<button role="tab" aria-selected={onRecap} aria-label="Récapitulatif" class="h-6 w-6 shrink-0 py-[9px]" onclick={() => (index = steps.length)}>
			<span class="block h-1.5 rounded-full transition-colors {onRecap ? 'bg-label' : 'bg-fill'}"></span>
		</button>
	</div>

	{#if otherTimers.length}
		<div class="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4" style="scrollbar-width: none" aria-label="Autres minuteurs">
			{#each otherTimers as { p, i } (p.id)}
				<TestTimer
					variant="chip"
					label={p.name}
					total={timers[p.id].total}
					state={timerState(p)}
					remaining={timers[p.id].endsAt - now}
					onopen={() => (index = i)}
				/>
			{/each}
		</div>
	{/if}

	{#if steps.length === 0}
		<p class="group subhead px-4 py-3 text-label2">Aucun paramètre suivi pour ce bac.</p>
	{:else}
		<StepFlow {count} bind:index>
			{#snippet step(i)}
				{#if i < steps.length}
					{@const p = steps[i]}
					{@const v = valueOf(p)}
					{@const set_ = isSet(p)}
					{@const out = set_ && outOfRange(p, v)}
					{@const last = lastOf(p)}
					{@const verdictNow = verdict(p)}
					<div class="flex flex-col gap-3 pb-4">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<h2 class="title1 truncate">{p.name}</h2>
								<p class="subhead mt-0.5 text-label2">
									{#if range(p)}Plage {range(p)}{/if}
									{#if last}<br />Dernière : <span class="rounded-num">{plain(last.value, p)}</span>{p.unit ? ` ${p.unit}` : ''}, {ago(last.measuredAt)}{/if}
									{#if !range(p) && !last}Première mesure de ce paramètre.{/if}
								</p>
							</div>
							<button type="button" class="btn-plain subhead shrink-0 pt-1.5" onclick={() => skip(p)}>Passer</button>
						</div>

						<!-- Valeur en cours -->
						<div class="flex items-center justify-between gap-2">
							<button
								type="button"
								class="pressable grid h-12 w-12 shrink-0 place-items-center rounded-full bg-fill3 text-[28px] leading-none"
								onclick={() => nudge(p, -1)}
								aria-label="Diminuer de {fmt(p.step, p.decimals)}">−</button
							>
							<div class="min-w-0 text-center">
								<p
									class="rounded-num truncate text-[60px] font-semibold leading-[1.05] {out ? 'text-red' : set_ ? 'text-label' : 'text-label3'}"
									aria-label="{p.name} : {shownText(p) || 'pas de valeur'}"
								>
									{shownText(p) || '–'}
								</p>
								<p class="subhead -mt-0.5 font-semibold text-label2">{p.unit || ' '}</p>
							</div>
							<button
								type="button"
								class="pressable grid h-12 w-12 shrink-0 place-items-center rounded-full bg-fill3 text-[28px] leading-none"
								onclick={() => nudge(p, 1)}
								aria-label="Augmenter de {fmt(p.step, p.decimals)}">+</button
							>
						</div>

						<p class="subhead flex min-h-5 items-center justify-center gap-1.5 text-center font-semibold {verdictNow?.tone === 'red' ? 'text-red' : verdictNow?.tone === 'green' ? 'text-green' : 'text-label2'}">
							{#if verdictNow}
								<Icon name={verdictNow.tone === 'green' ? 'check' : 'alert'} size={15} weight={2.6} />{verdictNow.text}
							{:else if !set_ && last}
								<span class="font-normal">Valeur grise : celle de la dernière fois</span>
							{/if}
						</p>

						{#if p.testWaitSeconds}
							<TestTimer
								label={p.name}
								total={p.testWaitSeconds}
								state={timerState(p)}
								remaining={timers[p.id] ? timers[p.id].endsAt - now : 0}
								notifyFailed={timers[p.id]?.notifyFailed}
								onstart={() => void startTimer(p)}
								oncancel={() => cancelTimer(p)}
							/>
						{/if}

						<!-- Pavé numérique façon Calculette : chiffres, fonctions à droite, « Suivant » en bas -->
						<div class="grid grid-cols-4 gap-2.5" role="group" aria-label="Pavé numérique">
							{#each PAD as key (key)}
								{#if key === 'next'}
									<button type="button" class="btn-filled col-span-2 !min-h-[52px] !rounded-2xl" disabled={!set_} onclick={next}>
										{i === steps.length - 1 ? 'Récapitulatif' : 'Suivant'}
									</button>
								{:else}
									<button
										type="button"
										class="rounded-num grid h-[52px] place-items-center rounded-2xl text-[26px] font-medium transition-colors disabled:opacity-40 {FUNCTION_KEYS.includes(key) ? 'bg-fill3 text-tint active:bg-fill' : 'bg-bg2 shadow-[0_0.5px_0_var(--sep)] active:bg-fill'}"
										disabled={key === 'same' && !last}
										onclick={() => (key === 'same' ? same(p) : key === 'sign' ? negate(p) : press(p, key))}
										aria-label={key === 'back' ? 'Effacer' : key === ',' ? 'Virgule' : key === 'sign' ? 'Changer le signe' : key === 'same' ? 'Pareil que la dernière fois' : key}
									>
										{#if key === 'back'}
											<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
												<path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7z" /><path d="M12.5 9.5l5 5M17.5 9.5l-5 5" />
											</svg>
										{:else if key === 'same'}
											<span class="flex flex-col items-center leading-none">
												<Icon name="undo" size={22} weight={2} />
												<span class="mt-0.5 text-[10px] font-semibold tracking-normal">Pareil</span>
											</span>
										{:else if key === 'sign'}
											<span class="text-[22px] font-semibold">±</span>
										{:else}{key}{/if}
									</button>
								{/if}
							{/each}
						</div>
					</div>
				{:else}
					<!-- Récapitulatif -->
					<div class="flex flex-col gap-1 pb-4">
						<h2 class="title1 mb-3">Récapitulatif</h2>
						<Section footer={ready.length ? 'Touche une ligne pour modifier sa valeur.' : 'Aucune valeur confirmée. Reviens en arrière pour en saisir.'}>
							{#each steps as p, k (p.id)}
								{@const v = valueOf(p)}
								{@const sel = isSet(p)}
								<Row onclick={() => (index = k)} chevron>
									{#snippet children()}
										<p class="body truncate">{p.name}</p>
										{#if sel && outOfRange(p, v)}<p class="subhead text-red">Hors plage</p>{/if}
									{/snippet}
									{#snippet trailing()}
										<span class="rounded-num body {sel ? (outOfRange(p, v) ? 'text-red' : 'text-label') : 'text-label3'}">
											{sel ? `${shownText(p)} ${p.unit}` : 'Non saisi'}
										</span>
									{/snippet}
								</Row>
							{/each}
						</Section>

						<Section>
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
												const val = e.currentTarget.value;
												whenLocal = val && new Date(val).getTime() < Date.now() - 60_000 ? val : '';
											}}
										/>
										{#if whenLocal}<button class="btn-plain subhead" onclick={() => (whenLocal = '')}>Maintenant</button>{/if}
									</div>
								</li>
							{/if}
						</Section>

						{#if warnings.length}
							<p class="footnote mb-4 px-4 text-red">
								Hors plage : {warnings.map((p) => p.name).join(', ')}.
							</p>
						{/if}
						<button class="btn-filled w-full" disabled={!ready.length || saving} onclick={save}>
							Enregistrer {ready.length} mesure{ready.length > 1 ? 's' : ''}
						</button>
					</div>
				{/if}
			{/snippet}
		</StepFlow>
	{/if}
{/if}

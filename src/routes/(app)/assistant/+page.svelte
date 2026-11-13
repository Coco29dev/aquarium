<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { clock } from '$lib/client/clock.svelte';
	import { api } from '$lib/client/api';
	import { streamAssistant, uploadChatImage } from '$lib/client/assistant';
	import { frenchSpaces, renderMarkdown } from '$lib/domain/markdown';
	import { MAX_IMAGES, suggestPrompts, threadLabel, withTimeMarks, type AssistantEvent, type DisplayItem, type PendingAction, type ThreadSummary } from '$lib/domain/assistant';
	import { tankHealth } from '$lib/tank';
	import { plainName, welcome } from '$lib/voice';
	import { haptic } from '$lib/motion/haptic';
	import Icon from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Segmented from '$lib/ios/Segmented.svelte';
	import Spinner from '$lib/ios/Spinner.svelte';
	import Avatar from '$lib/assistant/Avatar.svelte';
	import ActionCard from '$lib/assistant/ActionCard.svelte';
	import Composer from '$lib/assistant/Composer.svelte';
	import Welcome from '$lib/assistant/Welcome.svelte';
	import ThreadSheet from '$lib/assistant/ThreadSheet.svelte';
	import RenameSheet from '$lib/assistant/RenameSheet.svelte';
	import ChatMenu from '$lib/assistant/ChatMenu.svelte';
	import PhotoViewer from '$lib/assistant/PhotoViewer.svelte';
	import { threads } from '$lib/assistant/threads.svelte';

	interface ChatState {
		threadId: number;
		aquariumId: number;
		title: string | null;
		configured: boolean;
		busy: boolean;
		items: DisplayItem[];
		pending: PendingAction[];
		remaining: number;
	}
	interface Attachment {
		key: string;
		preview: string;
		id: number | null;
	}

	/** Une conversation reprise si elle date de moins de 12 h ; sinon, on en commence une nouvelle. */
	const RESUME_MS = 12 * 3600_000;
	const LAST_TANK = 'assistant.bac';

	const tanks = $derived(store.view?.aquariums ?? []);
	let aquariumId = $state<number | null>(null);
	let threadId = $state<number | null>(null);
	let title = $state<string | null>(null);
	const tank = $derived(tanks.find((t) => t.id === aquariumId) ?? null);

	let items = $state<DisplayItem[]>([]);
	let pending = $state<PendingAction[]>([]);
	let decisions = $state<Record<string, boolean>>({});
	let remaining = $state<number | null>(null);
	let loading = $state(true);
	let working = $state(false);
	/** Ce que fait l'assistant pendant un outil de lecture (« Je relis l'historique… »). */
	let status = $state('');
	let draft = $state('');
	let failure = $state('');
	let attachments = $state<Attachment[]>([]);
	let viewing = $state<number | null>(null);
	let composer = $state<ReturnType<typeof Composer>>();
	let barH = $state(80);
	let listOpen = $state(false);
	let menuOpen = $state(false);
	let renaming = $state<{ id: number; title: string | null } | null>(null);
	let atBottom = $state(true);
	let poll: ReturnType<typeof setTimeout> | undefined;
	let started = false;

	/** Incrémenté à chaque changement de conversation : un flux ou une lecture d'avant n'écrit plus rien à l'écran. */
	let epoch = 0;
	let controller: AbortController | undefined;
	/** Lignes déjà affichées : seules les nouvelles s'animent (pas le remplacement du flux par l'état du serveur). */
	const seen = new Set<string>();

	const uploading = $derived(attachments.some((a) => a.id === null));
	const ready = $derived((draft.trim() !== '' || attachments.length > 0) && !uploading && !working && pending.length === 0);
	const entries = $derived(withTimeMarks(items));
	// Les points (et l'état « Je relis… ») montrent qu'il travaille : tant qu'aucun texte n'arrive, et pendant un outil de lecture.
	const waiting = $derived(working && pending.length === 0 && (status !== '' || items[items.length - 1]?.kind !== 'assistant'));
	const photos = $derived(items.reduce((sum, i) => sum + (i.kind === 'user' ? i.images.length : 0), 0));
	const firstQuestion = $derived(items.find((i) => i.kind === 'user')?.text ?? '');
	// Une conversation pas encore commencée s'appelle simplement « Assistant » : le titre tient dans la barre.
	const headerTitle = $derived(title?.trim() || (firstQuestion ? threadLabel({ title: null, preview: firstQuestion }) : 'Assistant'));

	const back = $derived(aquariumId !== null && page.url.searchParams.has('bac') ? { href: `/aquariums/${aquariumId}`, label: 'Bac' } : { href: '/reglages', label: 'Plus' });

	// L'état du bac au moment d'ouvrir une conversation vide : de quoi proposer de bonnes premières questions.
	const health = $derived(tank && store.view ? tankHealth(store.view, tank) : null);
	const suggestions = $derived(
		suggestPrompts({
			alerts: (health?.alerts ?? []).map((a) => plainName(store.view?.parameters.find((p) => p.id === a.parameterId)?.name ?? '')).filter(Boolean),
			due: health?.due.length ?? 0,
			cycling: health?.level === 'cycle',
			measured: Boolean(health?.lastMeasuredAt)
		})
	);
	const hello = $derived(welcome({ hour: clock.hour, name: ui.profile.name, away: clock.away }));
	const recents = $derived(threads.list.filter((t) => t.aquariumId === aquariumId && t.id !== threadId).slice(0, 3));

	const lastTank = (): number | null => {
		try {
			return Number(localStorage.getItem(LAST_TANK)) || null;
		} catch {
			return null;
		}
	};
	const rememberTank = (id: number) => {
		try {
			localStorage.setItem(LAST_TANK, String(id));
		} catch {
			// Stockage indisponible : le bac n'est simplement pas mémorisé.
		}
	};

	/** Fait défiler vers le bas ; sans `force`, seulement si on était déjà près du bas (lecture en cours préservée). */
	async function scrollDown(force = false) {
		const el = document.documentElement;
		const near = el.scrollHeight - window.scrollY - window.innerHeight < 220;
		await tick();
		if (force || near) window.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
	}

	/** Remplace les lignes affichées ; `quiet` : elles viennent du serveur, sans animation d'arrivée. */
	function setItems(next: DisplayItem[], quiet = true) {
		if (quiet) for (const item of next) seen.add(item.key);
		items = next;
	}

	/** Quitte la réponse en cours d'écoute : le serveur la termine et l'écrit, on la retrouvera à la réouverture. */
	function leave() {
		epoch++;
		controller?.abort();
		controller = undefined;
		clearTimeout(poll);
		working = false;
		status = '';
	}

	function reset(id: number) {
		leave();
		aquariumId = id;
		threadId = null;
		title = null;
		setItems([]);
		pending = [];
		decisions = {};
		attachments.forEach((a) => URL.revokeObjectURL(a.preview));
		attachments = [];
		failure = '';
		loading = false;
		rememberTank(id);
		window.scrollTo({ top: 0 });
	}

	async function openThread(id: number): Promise<boolean> {
		leave();
		const mine = epoch;
		loading = true;
		try {
			const state = await api<ChatState>('GET', `/api/assistant/threads/${id}`);
			if (epoch !== mine) return true;
			aquariumId = state.aquariumId;
			threadId = state.threadId;
			title = state.title;
			setItems(state.items);
			pending = state.pending;
			decisions = {};
			remaining = state.remaining;
			failure = '';
			rememberTank(state.aquariumId);
			// Une réponse en cours côté serveur (écran quitté puis rouvert) : on attend sa fin.
			if (state.busy) {
				working = true;
				poll = setTimeout(() => void openThread(id), 2000);
			}
			return true;
		} catch (e) {
			if (epoch !== mine) return true;
			failure = e instanceof Error ? e.message : 'Chargement impossible';
			return false;
		} finally {
			if (epoch === mine) {
				loading = false;
				void scrollDown(true);
			}
		}
	}

	/** Reprend la conversation récente du bac, ou prépare une nouvelle. */
	async function resume(id: number, allowResume = true) {
		reset(id);
		if (!allowResume) return;
		const mine = epoch;
		loading = true;
		try {
			const [latest] = await api<ThreadSummary[]>('GET', `/api/assistant/threads?aquarium=${id}`);
			if (epoch !== mine) return;
			if (latest && Date.now() - new Date(latest.updatedAt).getTime() < RESUME_MS) return void (await openThread(latest.id));
		} catch {
			// Historique indisponible : on commence une conversation vierge.
		}
		if (epoch === mine) loading = false;
	}

	function newConversation() {
		if (aquariumId === null) return;
		reset(aquariumId);
		replaceState('/assistant', {});
		void threads.load();
		void tick().then(() => composer?.focus());
	}

	/** Ouvre une conversation choisie dans la liste ou dans « Reprendre ». */
	async function switchTo(id: number) {
		listOpen = false;
		if (id === threadId) return;
		replaceState(`/assistant?c=${id}`, {});
		await openThread(id);
	}

	/** Une conversation a été supprimée (liste ou menu) : si c'était celle-ci, retour à un écran vierge. */
	function removed(ids: number[]) {
		if (threadId !== null && ids.includes(threadId) && aquariumId !== null) {
			reset(aquariumId);
			replaceState('/assistant', {});
		}
		void threads.load();
	}

	async function deleteCurrent() {
		if (threadId === null || aquariumId === null) return;
		const summary: ThreadSummary = {
			id: threadId,
			aquariumId,
			title,
			preview: firstQuestion,
			updatedAt: new Date().toISOString(),
			messages: items.filter((i) => i.kind === 'user').length,
			images: photos
		};
		removed(await threads.confirmRemove([summary]));
	}

	// Ouverture : conversation précise (?c=), sinon bac demandé (?bac=), sinon dernier bac utilisé.
	$effect(() => {
		if (started || !tanks.length) return;
		started = true;
		const params = page.url.searchParams;
		const bac = Number(params.get('bac'));
		const fallback = tanks.find((t) => t.id === bac)?.id ?? tanks.find((t) => t.id === lastTank())?.id ?? tanks[0].id;
		const c = Number(params.get('c'));
		if (c) {
			// Une conversation supprimée entre-temps (lien ancien) : on retombe sur un écran vierge plutôt qu'une erreur.
			void openThread(c).then((ok) => {
				if (!ok) {
					replaceState('/assistant', {});
					void resume(fallback, false);
				}
			});
			return;
		}
		void resume(fallback, !params.has('new'));
	});

	onMount(() => {
		if (!tanks.length) loading = false;
		void threads.load();
		const onScroll = () => {
			const el = document.documentElement;
			atBottom = el.scrollHeight - window.scrollY - window.innerHeight < 160;
		};
		addEventListener('scroll', onScroll, { passive: true });
		return () => {
			removeEventListener('scroll', onScroll);
			clearTimeout(poll);
			controller?.abort();
		};
	});

	/** Applique un événement du flux à l'écran. */
	function apply(event: AssistantEvent, state: { acted: boolean }) {
		if (event.type === 'thread') {
			threadId = event.id;
			replaceState(`/assistant?c=${event.id}`, {});
		} else if (event.type === 'status') {
			status = event.text;
		} else if (event.type === 'text') {
			const last = items[items.length - 1];
			const live = last?.kind === 'assistant' && last.key === 'live';
			// Un simple saut de ligne (entre deux tours de l'assistant) ne dit rien : ni bulle vide, ni fin de l'attente.
			if (!event.text.trim()) {
				if (live) last.text += event.text;
				return;
			}
			status = '';
			if (live) last.text += event.text;
			else items.push({ kind: 'assistant', key: 'live', text: event.text });
			void scrollDown();
		} else if (event.type === 'action') {
			if (event.status === 'done') state.acted = true;
			const known = items.find((i) => i.kind === 'action' && i.id === event.id);
			if (known && known.kind === 'action') {
				known.status = event.status;
				known.detail = event.detail;
			}
		} else if (event.type === 'pending') {
			status = '';
			pending = event.actions;
			decisions = {};
			for (const a of event.actions) items.push({ kind: 'action', key: `a${a.id}`, id: a.id, name: a.name, label: a.label, status: 'pending', detail: '' });
			haptic('tick');
			void scrollDown(true);
		} else if (event.type === 'error') {
			failure = event.message;
		}
	}

	/** Envoie une requête qui répond en flux. Renvoie vrai si le flux a démarré (le serveur a pris la demande). */
	async function run(url: string, body: unknown): Promise<boolean> {
		if (working) return false;
		working = true;
		failure = '';
		status = '';
		const mine = ++epoch;
		controller = new AbortController();
		const state = { acted: false };
		let begun = false;
		try {
			await streamAssistant(
				url,
				body,
				(event) => {
					begun = true;
					if (epoch === mine) apply(event, state);
				},
				controller.signal
			);
		} catch (e) {
			// Écran quitté pour une autre conversation : rien à dire.
			if (epoch !== mine) return begun;
			failure = e instanceof Error ? e.message : 'Envoi impossible';
		}
		if (epoch !== mine) return begun;
		// L'état du serveur fait foi : on remplace ce qui a été affiché pendant le flux.
		if (threadId !== null && begun) await refresh(threadId);
		if (epoch !== mine) return begun;
		working = false;
		status = '';
		controller = undefined;
		if (state.acted) void store.sync();
		if (begun) {
			// Le titre est proposé en arrière-plan après le premier échange : on le relit un peu plus tard.
			if (threadId !== null && !title) {
				const id = threadId;
				setTimeout(
					() =>
						void api<ChatState>('GET', `/api/assistant/threads/${id}`)
							.then((s) => {
								if (threadId === id && s.title) title = s.title;
								threads.patch(id, { title: s.title });
							})
							.catch(() => {}),
					4000
				);
			}
			void threads.load();
		}
		return begun;
	}

	/** Relit la conversation sans l'écran de chargement. */
	async function refresh(id: number) {
		try {
			const state = await api<ChatState>('GET', `/api/assistant/threads/${id}`);
			if (threadId !== id) return;
			title = state.title;
			setItems(state.items);
			pending = state.pending;
			decisions = {};
			remaining = state.remaining;
		} catch (e) {
			failure = e instanceof Error ? e.message : 'Chargement impossible';
		}
		void scrollDown();
	}

	async function send(text = draft) {
		const message = text.trim();
		if (aquariumId === null || working || pending.length || uploading) return;
		if (!message && !attachments.length) return;
		const sent = attachments;
		const imageIds = sent.map((a) => a.id!);
		const key = `u${Date.now()}`;
		draft = '';
		attachments = [];
		composer?.reset();
		items.push({ kind: 'user', key, text: message || 'Voici une photo.', images: imageIds });
		void scrollDown(true);
		const begun = await run('/api/assistant', { ...(threadId !== null ? { threadId } : { aquariumId }), message, imageIds });
		if (begun) {
			sent.forEach((a) => URL.revokeObjectURL(a.preview));
		} else {
			// Refusé avant d'avoir commencé (hors ligne, assistant non configuré, limite du jour) : rien n'est parti,
			// le message et ses photos reviennent dans la zone de saisie pour être renvoyés tels quels.
			items = items.filter((i) => i.key !== key);
			if (!draft) draft = message;
			attachments = [...sent, ...attachments];
			haptic('warn');
		}
	}

	function decide(id: string, approve: boolean) {
		decisions[id] = approve;
		// Dernière décision prise : on envoie le tout.
		if (pending.every((a) => a.id in decisions) && threadId !== null) {
			const id = threadId;
			const body = { threadId: id, decisions: { ...decisions } };
			pending = [];
			// Refusé avant d'avoir commencé (hors ligne, conversation occupée) : on relit l'état pour redonner les boutons.
			void run('/api/assistant/confirm', body).then((begun) => {
				if (!begun && threadId === id) void refresh(id);
			});
		}
	}

	async function pick(files: File[]) {
		if (aquariumId === null) return;
		const tankId = aquariumId;
		const room = MAX_IMAGES - attachments.length;
		if (files.length > room) failure = `${MAX_IMAGES} photos au plus par message.`;
		for (const file of files.slice(0, room)) {
			const entry: Attachment = { key: crypto.randomUUID(), preview: URL.createObjectURL(file), id: null };
			attachments.push(entry);
			try {
				const id = await uploadChatImage(tankId, file);
				const live = attachments.find((a) => a.key === entry.key);
				if (live) live.id = id;
			} catch (e) {
				URL.revokeObjectURL(entry.preview);
				attachments = attachments.filter((a) => a.key !== entry.key);
				failure = e instanceof Error ? e.message : 'Envoi de la photo impossible';
			}
		}
	}

	function unpick(entry: Attachment) {
		URL.revokeObjectURL(entry.preview);
		attachments = attachments.filter((a) => a.key !== entry.key);
		if (entry.id !== null) void api('DELETE', `/api/assistant/images/${entry.id}`).catch(() => {});
	}

	async function toGallery(id: number) {
		try {
			await api('POST', `/api/assistant/images/${id}/gallery`);
			ui.show('Ajoutée aux photos du bac', undefined, 'check');
		} catch (e) {
			ui.fail(e, 'Ajout impossible.');
		}
	}
</script>

<svelte:head><title>{threadId ? headerTitle : 'Assistant'} · Biotope</title></svelte:head>

<NavBar title={headerTitle} {back} large={false}>
	{#snippet center()}
		<!-- Le titre est aussi un bouton : il ouvre la liste des conversations, avec le bac concerné dessous. -->
		<button
			type="button"
			class="pressable -my-1 flex max-w-[44vw] flex-col items-center rounded-[14px] px-2.5 py-0.5"
			onclick={() => (listOpen = true)}
			aria-label="Conversations. {headerTitle}{tank ? `, ${tank.name}` : ''}"
			aria-haspopup="dialog"
		>
			<span class="subhead max-w-full truncate font-semibold">{headerTitle}</span>
			<span class="caption1 flex max-w-full items-center gap-0.5 text-label2">
				<span class="truncate">{tank?.name ?? 'Assistant'}</span>
				<Icon name="down" size={11} weight={3.2} />
			</span>
		</button>
	{/snippet}
	{#snippet trailing()}
		<div class="flex items-center pr-1">
			<button class="btn-plain grid h-11 w-11 place-items-center disabled:opacity-40" onclick={newConversation} disabled={!threadId && !items.length} aria-label="Nouvelle conversation">
				<Icon name="edit" size={22} />
			</button>
			<button class="btn-plain grid h-11 w-11 place-items-center" onclick={() => (menuOpen = true)} aria-label="Options de la conversation" aria-haspopup="dialog">
				<Icon name="ellipsis" size={24} />
			</button>
		</div>
	{/snippet}
</NavBar>

<!-- La zone de saisie est fixée en bas ; la liste laisse la place de sa hauteur mesurée. -->
<div class="flex flex-col gap-1.5 pt-2" style="min-height: calc(100dvh - 5rem); padding-bottom: {barH + 16}px" role="log" aria-live="polite" aria-label="Conversation avec l'assistant">
	{#if !tank && !loading}
		<p class="subhead mt-10 text-center text-label2">Crée d’abord un aquarium pour discuter avec l’assistant.</p>
	{:else if loading}
		<div class="mt-16 grid place-items-center" role="status" aria-label="Chargement"><Spinner spinning size={32} /></div>
	{:else if !items.length && tank}
		{#if tanks.length > 1}
			<div class="mx-auto mb-2 w-full max-w-sm">
				<Segmented
					options={tanks.map((t) => ({ value: t.id, label: t.name }))}
					value={tank.id}
					label="Bac de la conversation"
					onchange={(id) => {
						if (id === aquariumId) return;
						replaceState('/assistant', {});
						void resume(id);
					}}
				/>
			</div>
		{/if}
		<Welcome
			{tank}
			{hello}
			health={health ? { label: health.label, level: health.level } : null}
			{suggestions}
			{recents}
			total={threads.list.length}
			onask={(prompt) => send(prompt)}
			onphoto={() => composer?.openPicker()}
			onresume={switchTo}
			onall={() => (listOpen = true)}
		/>
	{:else}
		{#each entries as entry, i (entry.key)}
			{@const fresh = !seen.has(entry.key)}
			{@const previous = entries[i - 1]}
			{#if entry.kind === 'time'}
				<p class="caption1 py-2 text-center font-semibold text-label2">{entry.label}</p>
			{:else if entry.kind === 'user'}
				<div class="{fresh ? 'pop' : ''} ml-12 mt-1.5 flex flex-col items-end gap-1.5 self-end">
					{#if entry.images.length}
						<div class="grid justify-items-end gap-1.5 {entry.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}">
							{#each entry.images as id (id)}
								<button class="pressable overflow-hidden rounded-[18px]" onclick={() => (viewing = id)} aria-label="Agrandir la photo">
									<img src="/api/assistant/images/{id}" alt="Pièce jointe" class="object-cover {entry.images.length === 1 ? 'h-44 w-56' : 'h-28 w-28'}" loading="lazy" />
								</button>
							{/each}
						</div>
					{/if}
					{#if entry.text}
						<div class="rounded-[22px] rounded-br-[8px] px-3.5 py-2.5 text-on-tint" style="background: linear-gradient(180deg, color-mix(in srgb, var(--tint) 88%, white), var(--tint))">
							<p class="body selectable whitespace-pre-wrap break-words">{frenchSpaces(entry.text)}</p>
						</div>
					{/if}
				</div>
			{:else}
				{@const first = !previous || previous.kind === 'user' || previous.kind === 'time'}
				<div class="{fresh ? 'pop' : ''} mr-6 flex items-end gap-2 self-start {first ? 'mt-1.5' : ''}">
					<span class="w-7 shrink-0 self-start">{#if first}<Avatar size={28} />{/if}</span>
					{#if entry.kind === 'assistant'}
						<div class="md selectable min-w-0 rounded-[22px] rounded-tl-[8px] bg-bg2 px-3.5 py-2.5" style="box-shadow: var(--water-edge), 0 1px 2px rgb(var(--shadow-ink) / 0.06)">
							<div class="body break-words">{@html renderMarkdown(entry.text)}</div>
						</div>
					{:else}
						<div class="min-w-0 flex-1">
							<ActionCard item={entry} waiting={pending.some((a) => a.id === entry.id)} decision={decisions[entry.id]} ondecide={(approve) => decide(entry.id, approve)} />
						</div>
					{/if}
				</div>
			{/if}
		{/each}
		{#if waiting}
			<!-- Réponse en cours : trois points qui respirent (un simple souffle d'opacité en « Réduire les animations »). -->
			<div class="pop mr-6 flex items-end gap-2 self-start {items[items.length - 1]?.kind === 'user' ? 'mt-1.5' : ''}" role="status" aria-label={status || 'L’assistant répond'}>
				<!-- Dans la suite d'une réponse déjà commencée, le visage n'est pas répété. -->
				{#if items[items.length - 1]?.kind === 'user'}<Avatar size={28} busy />{:else}<span class="w-7 shrink-0"></span>{/if}
				<div class="flex items-center gap-2.5 rounded-[22px] rounded-tl-[8px] bg-bg2 px-4 py-3.5" style="box-shadow: var(--water-edge)">
					<span class="dots" aria-hidden="true"><i class="busy"></i><i class="busy"></i><i class="busy"></i></span>
					{#if status}<span class="footnote text-label2">{status}</span>{/if}
				</div>
			</div>
		{/if}
	{/if}
	{#if failure}<p class="subhead mt-2 rounded-field bg-bg2 px-4 py-3 text-red" role="alert">{failure}</p>{/if}
</div>

{#if tank}
	{#if !atBottom && items.length}
		<button
			class="glass pressable fixed right-4 z-20 grid h-11 w-11 place-items-center rounded-full text-label"
			style="bottom: {barH + 14}px; animation: fade-in 160ms both"
			onclick={() => scrollDown(true)}
			aria-label="Aller au dernier message"
		>
			<Icon name="down" size={22} weight={2.4} />
		</button>
	{/if}
	{#if pending.length}
		<div class="bar-material fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md px-4 pt-3" style="padding-bottom: max(env(safe-area-inset-bottom), 12px)" bind:clientHeight={barH}>
			<p class="footnote pb-1 text-center text-label2">Confirme ou refuse {pending.length > 1 ? 'les actions proposées' : 'l’action proposée'} pour continuer.</p>
		</div>
	{:else}
		<Composer bind:this={composer} bind:draft bind:height={barH} {attachments} {working} {ready} {remaining} onsend={() => send()} onpick={pick} onremove={unpick} />
	{/if}
{/if}

<ThreadSheet
	open={listOpen}
	{tanks}
	currentId={threadId}
	onclose={() => (listOpen = false)}
	onopen={switchTo}
	onnew={() => {
		listOpen = false;
		newConversation();
	}}
	onrename={(t) => (renaming = { id: t.id, title: t.title })}
	ondeleted={removed}
/>
<ChatMenu
	open={menuOpen}
	hasThread={threadId !== null}
	busy={working}
	{photos}
	onclose={() => (menuOpen = false)}
	onrename={() => threadId !== null && (renaming = { id: threadId, title })}
	onlist={() => (listOpen = true)}
	onnew={newConversation}
	ondelete={deleteCurrent}
/>
<RenameSheet
	target={renaming}
	onclose={() => (renaming = null)}
	onsaved={(id, value) => {
		if (id !== threadId) return;
		// Un titre vidé redonne le titre automatique, que seul le serveur connaît.
		if (value) title = value;
		else void refresh(id);
	}}
/>
<PhotoViewer id={viewing} onclose={() => (viewing = null)} onadd={toGallery} />

<style>
	.pop {
		animation: pop 220ms cubic-bezier(0.3, 0.8, 0.3, 1) both;
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: translateY(8px) scale(0.98);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pop {
			animation: none;
		}
	}
	.dots {
		display: inline-flex;
		gap: 5px;
		align-items: center;
		height: 10px;
	}
	.dots i {
		display: block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--label3);
		animation: dot-breathe 1.2s ease-in-out infinite;
	}
	.dots i:nth-child(2) {
		animation-delay: 160ms;
	}
	.dots i:nth-child(3) {
		animation-delay: 320ms;
	}
	@keyframes dot-breathe {
		0%,
		80%,
		100% {
			opacity: 0.35;
			transform: scale(0.8);
		}
		40% {
			opacity: 1;
			transform: scale(1);
		}
	}
	.md :global(p + p),
	.md :global(p + ul),
	.md :global(p + ol),
	.md :global(ul + p),
	.md :global(ol + p) {
		margin-top: 0.5rem;
	}
	.md :global(ul),
	.md :global(ol) {
		padding-left: 1.25rem;
	}
	.md :global(ul) {
		list-style: disc;
	}
	.md :global(ol) {
		list-style: decimal;
	}
	.md :global(li + li) {
		margin-top: 0.15rem;
	}
	.md :global(code) {
		background: var(--fill3);
		border-radius: 6px;
		padding: 0 0.3em;
		font-size: 0.9em;
	}
</style>

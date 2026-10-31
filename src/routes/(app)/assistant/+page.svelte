<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { api } from '$lib/client/api';
	import { streamAssistant, uploadChatImage } from '$lib/client/assistant';
	import { renderMarkdown } from '$lib/domain/markdown';
	import { MAX_IMAGES, type AssistantEvent, type DisplayItem, type PendingAction, type ThreadSummary } from '$lib/domain/assistant';
	import Icon from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Segmented from '$lib/ios/Segmented.svelte';
	import Spinner from '$lib/ios/Spinner.svelte';

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
	let draft = $state('');
	let failure = $state('');
	let attachments = $state<Attachment[]>([]);
	let viewing = $state<number | null>(null);
	let input = $state<HTMLTextAreaElement>();
	let fileInput = $state<HTMLInputElement>();
	let barH = $state(80);
	let poll: ReturnType<typeof setTimeout> | undefined;
	let started = false;

	const suggestions = ['Où en est mon bac ?', 'Mes valeurs sont-elles correctes ?', 'Que dois-je faire cette semaine ?'];
	const uploading = $derived(attachments.some((a) => a.id === null));
	const ready = $derived((draft.trim() !== '' || attachments.length > 0) && !uploading && !working && pending.length === 0);

	const back = $derived(aquariumId !== null && page.url.searchParams.has('bac') ? { href: `/aquariums/${aquariumId}`, label: 'Bac' } : { href: '/outils', label: 'Atelier' });

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

	function reset(id: number) {
		clearTimeout(poll);
		aquariumId = id;
		threadId = null;
		title = null;
		items = [];
		pending = [];
		decisions = {};
		attachments = [];
		failure = '';
		loading = false;
		rememberTank(id);
	}

	async function openThread(id: number) {
		clearTimeout(poll);
		loading = true;
		try {
			const state = await api<ChatState>('GET', `/api/assistant/threads/${id}`);
			aquariumId = state.aquariumId;
			threadId = state.threadId;
			title = state.title;
			items = state.items;
			pending = state.pending;
			decisions = {};
			remaining = state.remaining;
			failure = '';
			rememberTank(state.aquariumId);
			// Une réponse en cours côté serveur (écran quitté puis rouvert) : on attend sa fin.
			if (state.busy) poll = setTimeout(() => void openThread(id), 2000);
		} catch (e) {
			failure = e instanceof Error ? e.message : 'Chargement impossible';
		} finally {
			loading = false;
			void scrollDown(true);
		}
	}

	/** Reprend la conversation récente du bac, ou prépare une nouvelle. */
	async function resume(id: number, allowResume = true) {
		reset(id);
		if (!allowResume) return;
		loading = true;
		try {
			const [latest] = await api<ThreadSummary[]>('GET', `/api/assistant/threads?aquarium=${id}`);
			if (latest && Date.now() - new Date(latest.updatedAt).getTime() < RESUME_MS) return await openThread(latest.id);
		} catch {
			// Historique indisponible : on commence une conversation vierge.
		}
		loading = false;
	}

	function newConversation() {
		if (aquariumId === null || working) return;
		reset(aquariumId);
		replaceState('/assistant', {});
		input?.focus();
	}

	// Ouverture : conversation précise (?c=), sinon bac demandé (?bac=), sinon dernier bac utilisé.
	$effect(() => {
		if (started || !tanks.length) return;
		started = true;
		const params = page.url.searchParams;
		const c = Number(params.get('c'));
		if (c) return void openThread(c);
		const bac = Number(params.get('bac'));
		const id = tanks.find((t) => t.id === bac)?.id ?? tanks.find((t) => t.id === lastTank())?.id ?? tanks[0].id;
		void resume(id, !params.has('new'));
	});

	onMount(() => {
		if (!tanks.length) loading = false;
		return () => clearTimeout(poll);
	});

	/** Applique un événement du flux à l'écran. */
	function apply(event: AssistantEvent, state: { acted: boolean }) {
		if (event.type === 'thread') {
			threadId = event.id;
			replaceState(`/assistant?c=${event.id}`, {});
		} else if (event.type === 'text') {
			const last = items[items.length - 1];
			if (last?.kind === 'assistant' && last.key === 'live') last.text += event.text;
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
			pending = event.actions;
			decisions = {};
			for (const a of event.actions) items.push({ kind: 'action', key: `a${a.id}`, id: a.id, name: a.name, label: a.label, status: 'pending', detail: '' });
			void scrollDown(true);
		} else if (event.type === 'error') {
			failure = event.message;
		}
	}

	async function run(url: string, body: unknown) {
		if (working) return;
		working = true;
		failure = '';
		const state = { acted: false };
		try {
			await streamAssistant(url, body, (event) => apply(event, state));
		} catch (e) {
			failure = e instanceof Error ? e.message : 'Envoi impossible';
		}
		// L'état du serveur fait foi : on remplace ce qui a été affiché pendant le flux.
		if (threadId !== null) await refresh(threadId);
		working = false;
		if (state.acted) void store.sync();
		// Le titre est proposé en arrière-plan après le premier échange : on le relit un peu plus tard.
		if (threadId !== null && !title) {
			const id = threadId;
			setTimeout(() => void api<ChatState>('GET', `/api/assistant/threads/${id}`).then((s) => threadId === id && (title = s.title)).catch(() => {}), 4000);
		}
	}

	/** Relit la conversation sans l'écran de chargement. */
	async function refresh(id: number) {
		try {
			const state = await api<ChatState>('GET', `/api/assistant/threads/${id}`);
			if (threadId !== id) return;
			title = state.title;
			items = state.items;
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
		const imageIds = attachments.map((a) => a.id!);
		draft = '';
		attachments.forEach((a) => URL.revokeObjectURL(a.preview));
		attachments = [];
		if (input) input.style.height = '';
		items.push({ kind: 'user', key: `u${Date.now()}`, text: message || 'Voici une photo.', images: imageIds });
		void scrollDown(true);
		await run('/api/assistant', { ...(threadId !== null ? { threadId } : { aquariumId }), message, imageIds });
	}

	function decide(id: string, approve: boolean) {
		decisions[id] = approve;
		// Dernière décision prise : on envoie le tout.
		if (pending.every((a) => a.id in decisions) && threadId !== null) {
			const body = { threadId, decisions: { ...decisions } };
			pending = [];
			void run('/api/assistant/confirm', body);
		}
	}

	async function pick(event: Event) {
		const files = [...((event.currentTarget as HTMLInputElement).files ?? [])];
		(event.currentTarget as HTMLInputElement).value = '';
		if (aquariumId === null) return;
		const tankId = aquariumId;
		for (const file of files.slice(0, MAX_IMAGES - attachments.length)) {
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
		if (files.length > MAX_IMAGES - attachments.length + files.length) failure = `${MAX_IMAGES} photos au plus par message.`;
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
			ui.show(e instanceof Error ? e.message : 'Ajout impossible');
		}
	}

	function grow() {
		if (!input) return;
		input.style.height = 'auto';
		input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
	}

	function onKey(event: KeyboardEvent) {
		// Entrée envoie sur ordinateur ; sur iPhone, Entrée reste un retour à la ligne.
		if (event.key === 'Enter' && !event.shiftKey && !/iPhone|iPad/.test(navigator.userAgent)) {
			event.preventDefault();
			void send();
		}
	}

	const waiting = $derived(working && items[items.length - 1]?.kind !== 'assistant' && pending.length === 0);
</script>

<svelte:head><title>{title ?? 'Assistant'} · Aquarium</title></svelte:head>
<svelte:window onkeydown={(e) => e.key === 'Escape' && (viewing = null)} />

<NavBar title={title ?? 'Assistant'} {back} large={false}>
	{#snippet trailing()}
		<div class="flex items-center gap-1 pr-2">
			<a href="/assistant/historique" class="btn-plain grid h-9 w-9 place-items-center" aria-label="Historique des conversations"><Icon name="history" size={23} /></a>
			<button class="btn-plain grid h-9 w-9 place-items-center disabled:opacity-40" onclick={newConversation} disabled={working || (!items.length && threadId === null)} aria-label="Nouvelle conversation">
				<Icon name="edit" size={22} />
			</button>
		</div>
	{/snippet}
</NavBar>

{#if tanks.length > 1 && tank}
	<div class="mb-3 mt-1">
		<Segmented
			options={tanks.map((t) => ({ value: t.id, label: t.name }))}
			value={tank.id}
			label="Bac"
			onchange={(id) => {
				if (working || id === aquariumId) return;
				replaceState('/assistant', {});
				void resume(id);
			}}
		/>
	</div>
{/if}

<!-- La zone de saisie est fixée en bas ; la liste laisse la place de sa hauteur mesurée. -->
<div class="flex flex-col gap-3 pt-1" style="min-height: calc(100dvh - 9rem); padding-bottom: {barH + 16}px" role="log" aria-live="polite" aria-label="Conversation avec l'assistant">
	{#if !tank && !loading}
		<p class="subhead mt-10 text-center text-label2">Crée d'abord un aquarium pour discuter avec l'assistant.</p>
	{:else if loading}
		<div class="mt-16 grid place-items-center"><Spinner /></div>
	{:else if !items.length}
		<div class="mt-8 px-1 text-center">
			<span class="mx-auto grid h-14 w-14 place-items-center rounded-[20px] text-white" style="background: var(--indigo)"><Icon name="chat" size={30} filled /></span>
			<p class="title3 mt-3 font-semibold">Parle à ton assistant</p>
			<p class="subhead mt-1 text-label2">Il connaît les mesures, les habitants et les tâches de « {tank?.name} ». Envoie-lui une photo, ou demande-lui de noter une mesure ou de cocher une tâche, avec ta confirmation.</p>
			<div class="mt-5 flex flex-col items-stretch gap-2">
				{#each suggestions as s (s)}
					<button class="pressable rounded-[18px] bg-bg2 px-4 py-3 text-left subhead" onclick={() => send(s)}>{s}</button>
				{/each}
			</div>
		</div>
	{:else}
		{#each items as item (item.key)}
			{#if item.kind === 'user'}
				<div class="pop ml-10 flex flex-col items-end gap-1.5 self-end">
					{#if item.images.length}
						<div class="flex flex-wrap justify-end gap-1.5">
							{#each item.images as id (id)}
								<button class="pressable overflow-hidden rounded-[16px]" onclick={() => (viewing = id)} aria-label="Agrandir la photo">
									<img src="/api/assistant/images/{id}" alt="Pièce jointe" class="h-28 w-28 object-cover" loading="lazy" />
								</button>
							{/each}
						</div>
					{/if}
					{#if item.text}<div class="rounded-[20px] rounded-br-md px-3.5 py-2 text-white" style="background: var(--tint)"><p class="body whitespace-pre-wrap break-words">{item.text}</p></div>{/if}
				</div>
			{:else if item.kind === 'assistant'}
				<div class="pop md mr-8 self-start rounded-[20px] rounded-bl-md bg-bg2 px-3.5 py-2.5"><div class="body break-words">{@html renderMarkdown(item.text)}</div></div>
			{:else}
				<div class="pop mr-8 self-start rounded-[18px] border border-sep bg-bg2 px-3.5 py-3">
					<div class="flex items-start gap-2.5">
						<span
							class="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-white"
							style="background: {item.status === 'done' ? 'var(--green)' : item.status === 'error' ? 'var(--red)' : item.status === 'refused' ? 'var(--gray)' : 'var(--indigo)'}"
						>
							<Icon name={item.status === 'done' ? 'check' : item.status === 'pending' ? 'edit' : 'close'} size={14} weight={2.8} />
						</span>
						<div class="min-w-0 flex-1">
							<p class="subhead font-semibold">{item.label}</p>
							{#if item.status === 'done'}<p class="footnote text-label2">{item.detail}</p>
							{:else if item.status === 'error'}<p class="footnote text-red">{item.detail}</p>
							{:else if item.status === 'refused'}<p class="footnote text-label2">Refusé</p>
							{:else if item.id in decisions}<p class="footnote text-label2">{decisions[item.id] ? 'Confirmé' : 'Refusé'}…</p>
							{:else}<p class="footnote text-label2">À confirmer avant d'être enregistré</p>{/if}
						</div>
					</div>
					{#if item.status === 'pending' && !(item.id in decisions) && pending.some((a) => a.id === item.id)}
						<div class="mt-3 flex gap-2">
							<button class="pressable h-10 flex-1 rounded-full bg-fill3 font-semibold" onclick={() => decide(item.id, false)}>Refuser</button>
							<button class="pressable h-10 flex-1 rounded-full font-semibold text-white" style="background: var(--tint)" onclick={() => decide(item.id, true)}>Confirmer</button>
						</div>
					{/if}
				</div>
			{/if}
		{/each}
		{#if waiting}
			<div class="pop mr-8 self-start rounded-[20px] rounded-bl-md bg-bg2 px-4 py-3"><Spinner /></div>
		{/if}
	{/if}
	{#if failure}<p class="subhead rounded-[16px] bg-bg2 px-4 py-3 text-red" role="alert">{failure}</p>{/if}
</div>

{#if tank}
	<div class="bar-material fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md px-4 pt-2" style="padding-bottom: max(env(safe-area-inset-bottom), 12px)" bind:clientHeight={barH}>
		{#if pending.length}
			<p class="footnote pb-2 text-center text-label2">Confirme ou refuse les actions proposées pour continuer.</p>
		{:else}
			{#if attachments.length}
				<div class="flex gap-2 overflow-x-auto pb-2" aria-label="Photos jointes">
					{#each attachments as a (a.key)}
						<div class="relative h-16 w-16 shrink-0">
							<img src={a.preview} alt="Pièce jointe" class="h-16 w-16 rounded-[12px] object-cover {a.id === null ? 'opacity-50' : ''}" />
							{#if a.id === null}<span class="absolute inset-0 grid place-items-center"><Spinner /></span>{/if}
							<button class="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-label2 text-bg2" onclick={() => unpick(a)} aria-label="Retirer la photo"><Icon name="close" size={13} weight={3} /></button>
						</div>
					{/each}
				</div>
			{/if}
			<form
				class="flex items-end gap-2"
				onsubmit={(e) => {
					e.preventDefault();
					void send();
				}}
			>
				<input bind:this={fileInput} type="file" accept="image/*" multiple class="hidden" onchange={pick} />
				<button
					type="button"
					class="pressable grid h-10 w-10 shrink-0 place-items-center rounded-full bg-fill3 text-label2 disabled:opacity-40"
					onclick={() => fileInput?.click()}
					disabled={working || attachments.length >= MAX_IMAGES}
					aria-label="Joindre une photo"
				>
					<Icon name="photo" size={22} />
				</button>
				<textarea
					bind:this={input}
					bind:value={draft}
					oninput={grow}
					onkeydown={onKey}
					rows="1"
					maxlength="4000"
					placeholder="Écris à l'assistant"
					aria-label="Message"
					class="body max-h-36 min-h-10 flex-1 resize-none rounded-[20px] bg-bg2 px-3.5 py-2 outline-none"
					disabled={working}
				></textarea>
				<button
					type="submit"
					class="pressable grid h-10 w-10 shrink-0 place-items-center rounded-full text-white disabled:opacity-40"
					style="background: var(--tint)"
					disabled={!ready}
					aria-label="Envoyer"
				>
					<Icon name="up" size={20} weight={2.6} />
				</button>
			</form>
			{#if remaining !== null && remaining <= 10}<p class="caption1 pt-1 text-center text-label2">{remaining} message{remaining > 1 ? 's' : ''} restant{remaining > 1 ? 's' : ''} aujourd'hui</p>{/if}
		{/if}
	</div>
{/if}

{#if viewing !== null}
	<div class="fixed inset-0 z-50 flex flex-col bg-black/92" role="dialog" aria-modal="true" aria-label="Photo" style="padding-top: env(safe-area-inset-top)">
		<div class="flex items-center justify-between px-4 py-3 text-white">
			<button class="pressable grid h-10 w-10 place-items-center rounded-full bg-white/15" onclick={() => (viewing = null)} aria-label="Fermer"><Icon name="close" size={22} weight={2.4} /></button>
			<button class="pressable rounded-full bg-white/15 px-4 py-2 subhead font-semibold" onclick={() => viewing !== null && toGallery(viewing)}>Ajouter aux photos du bac</button>
		</div>
		<button class="flex min-h-0 flex-1 items-center justify-center p-2" onclick={() => (viewing = null)} aria-label="Fermer la photo">
			<img src="/api/assistant/images/{viewing}" alt="Pièce jointe" class="max-h-full max-w-full rounded-[10px] object-contain" />
		</button>
	</div>
{/if}

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
	.md :global(code) {
		background: var(--fill3);
		border-radius: 6px;
		padding: 0 0.3em;
		font-size: 0.9em;
	}
</style>

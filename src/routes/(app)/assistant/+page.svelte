<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { api } from '$lib/client/api';
	import { streamAssistant } from '$lib/client/assistant';
	import { renderMarkdown } from '$lib/domain/markdown';
	import type { DisplayItem, PendingAction } from '$lib/domain/assistant';
	import Icon from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Segmented from '$lib/ios/Segmented.svelte';
	import Spinner from '$lib/ios/Spinner.svelte';

	interface ChatState {
		configured: boolean;
		busy: boolean;
		items: DisplayItem[];
		pending: PendingAction[];
		remaining: number;
	}

	const tanks = $derived(store.view?.aquariums ?? []);
	let chosen = $state<number | null>(null);
	const tankId = $derived(chosen ?? Number(page.url.searchParams.get('bac')) ?? null);
	const tank = $derived(tanks.find((t) => t.id === tankId) ?? tanks[0] ?? null);

	let items = $state<DisplayItem[]>([]);
	let pending = $state<PendingAction[]>([]);
	let decisions = $state<Record<string, boolean>>({});
	let configured = $state(true);
	let remaining = $state<number | null>(null);
	let loading = $state(true);
	let working = $state(false);
	let draft = $state('');
	let failure = $state('');
	let input = $state<HTMLTextAreaElement>();
	let poll: ReturnType<typeof setTimeout> | undefined;

	const back = $derived(page.url.searchParams.get('bac') ? { href: `/aquariums/${page.url.searchParams.get('bac')}`, label: 'Bac' } : { href: '/outils', label: 'Atelier' });
	const suggestions = ['Où en est mon bac ?', 'Mes valeurs sont-elles correctes ?', 'Que dois-je faire cette semaine ?'];

	async function scrollDown() {
		await tick();
		window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
	}

	async function load(id: number) {
		clearTimeout(poll);
		try {
			const state = await api<ChatState>('GET', `/api/assistant?aquarium=${id}`);
			if (tank?.id !== id) return;
			configured = state.configured;
			items = state.items;
			pending = state.pending;
			decisions = {};
			remaining = state.remaining;
			failure = '';
			// Une réponse en cours côté serveur (écran quitté puis rouvert) : on attend sa fin.
			if (state.busy) poll = setTimeout(() => void load(id), 2000);
		} catch (e) {
			failure = e instanceof Error ? e.message : 'Chargement impossible';
		} finally {
			loading = false;
			void scrollDown();
		}
	}

	$effect(() => {
		const id = tank?.id;
		if (id == null) return;
		loading = true;
		items = [];
		pending = [];
		void load(id);
		return () => clearTimeout(poll);
	});

	onMount(() => () => clearTimeout(poll));

	/** Applique un événement du flux à l'écran. */
	function apply(event: import('$lib/domain/assistant').AssistantEvent, state: { acted: boolean }) {
		if (event.type === 'text') {
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
			void scrollDown();
		} else if (event.type === 'error') {
			failure = event.message;
		}
	}

	async function run(url: string, body: unknown) {
		if (!tank || working) return;
		working = true;
		failure = '';
		const state = { acted: false };
		try {
			await streamAssistant(url, body, (event) => apply(event, state));
		} catch (e) {
			failure = e instanceof Error ? e.message : 'Envoi impossible';
		}
		// L'état du serveur fait foi : on remplace ce qui a été affiché pendant le flux.
		await load(tank.id);
		working = false;
		if (state.acted) void store.sync();
	}

	async function send(text = draft) {
		const message = text.trim();
		if (!message || !tank || working || pending.length) return;
		draft = '';
		if (input) input.style.height = '';
		items.push({ kind: 'user', key: `u${Date.now()}`, text: message });
		void scrollDown();
		await run('/api/assistant', { aquariumId: tank.id, message });
	}

	function decide(id: string, approve: boolean) {
		decisions[id] = approve;
		// Dernière décision prise : on envoie le tout.
		if (pending.every((a) => a.id in decisions) && tank) {
			const body = { aquariumId: tank.id, decisions: { ...decisions } };
			pending = [];
			void run('/api/assistant/confirm', body);
		}
	}

	async function clear() {
		if (!tank) return;
		const ok = await ui.confirm({ title: 'Effacer la conversation ?', message: `L'historique du chat de « ${tank.name} » sera supprimé.`, confirmLabel: 'Effacer', destructive: true });
		if (!ok) return;
		try {
			await api('DELETE', `/api/assistant?aquarium=${tank.id}`);
			await load(tank.id);
		} catch (e) {
			ui.show(e instanceof Error ? e.message : 'Suppression impossible');
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

<svelte:head><title>Assistant · Aquarium</title></svelte:head>

<NavBar title="Assistant" {back} large={false}>
	{#snippet trailing()}
		{#if items.length && !working}
			<button class="btn-plain pr-3" onclick={clear}>Effacer</button>
		{/if}
	{/snippet}
</NavBar>

{#if tanks.length > 1 && tank}
	<div class="mb-3 mt-1">
		<Segmented
			options={tanks.map((t) => ({ value: t.id, label: t.name }))}
			value={tank.id}
			label="Bac"
			onchange={(id) => {
				if (!working) chosen = id;
			}}
		/>
	</div>
{/if}

<div class="flex min-h-[62dvh] flex-col gap-3 pb-4 pt-1">
	{#if !tank}
		<p class="subhead mt-10 text-center text-label2">Crée d'abord un aquarium pour discuter avec l'assistant.</p>
	{:else if !configured}
		<div class="mt-6 rounded-[22px] bg-bg2 p-4">
			<p class="headline">Assistant non configuré</p>
			<p class="subhead mt-1 text-label2">Ajoute la variable <code>ANTHROPIC_API_KEY</code> au service de l'appli (Railway, onglet Variables), puis redéploie.</p>
		</div>
	{:else if loading}
		<div class="mt-16 grid place-items-center"><Spinner /></div>
	{:else if !items.length}
		<div class="mt-8 px-1 text-center">
			<span class="mx-auto grid h-14 w-14 place-items-center rounded-[20px] text-white" style="background: var(--indigo)"><Icon name="chat" size={30} filled /></span>
			<p class="title3 mt-3 font-semibold">Parle à ton assistant</p>
			<p class="subhead mt-1 text-label2">Il connaît les mesures, les habitants et les tâches de « {tank.name} ». Il peut aussi noter une mesure ou cocher une tâche, avec ta confirmation.</p>
			<div class="mt-5 flex flex-col items-stretch gap-2">
				{#each suggestions as s (s)}
					<button class="pressable rounded-[18px] bg-bg2 px-4 py-3 text-left subhead" onclick={() => send(s)}>{s}</button>
				{/each}
			</div>
		</div>
	{:else}
		{#each items as item (item.key)}
			{#if item.kind === 'user'}
				<div class="ml-10 self-end rounded-[20px] rounded-br-md px-3.5 py-2 text-white" style="background: var(--tint)"><p class="body whitespace-pre-wrap break-words">{item.text}</p></div>
			{:else if item.kind === 'assistant'}
				<div class="md mr-8 self-start rounded-[20px] rounded-bl-md bg-bg2 px-3.5 py-2.5"><div class="body break-words">{@html renderMarkdown(item.text)}</div></div>
			{:else}
				<div class="mr-8 self-start rounded-[18px] border border-sep bg-bg2 px-3.5 py-3">
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
			<div class="mr-8 self-start rounded-[20px] rounded-bl-md bg-bg2 px-4 py-3"><Spinner /></div>
		{/if}
	{/if}
	{#if failure}<p class="subhead rounded-[16px] bg-bg2 px-4 py-3 text-red">{failure}</p>{/if}
</div>

{#if tank && configured}
	<div class="bar-material sticky bottom-0 -mx-4 px-4 pt-2" style="padding-bottom: max(env(safe-area-inset-bottom), 12px)">
		{#if pending.length}
			<p class="footnote pb-2 text-center text-label2">Confirme ou refuse les actions proposées pour continuer.</p>
		{:else}
			<form
				class="flex items-end gap-2"
				onsubmit={(e) => {
					e.preventDefault();
					void send();
				}}
			>
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
					disabled={working || !draft.trim()}
					aria-label="Envoyer"
				>
					<Icon name="up" size={20} weight={2.6} />
				</button>
			</form>
			{#if remaining !== null && remaining <= 10}<p class="caption1 pt-1 text-center text-label2">{remaining} message{remaining > 1 ? 's' : ''} restant{remaining > 1 ? 's' : ''} aujourd'hui</p>{/if}
		{/if}
	</div>
{/if}

<style>
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

<script lang="ts">
	import { onMount } from 'svelte';
	import { store } from '$lib/client/store.svelte';
	import { api, listResource } from '$lib/client/api';
	import { speciesName } from '$lib/domain/species';
	import { KIND_LABELS, type Species } from '$lib/types';
	import { SHORT_WATER, TANK_ICON, TANK_TONE } from '$lib/ui';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import NavBar from '$lib/ios/NavBar.svelte';
	import Section from '$lib/ios/Section.svelte';
	import SearchField from '$lib/ios/SearchField.svelte';
	import Spinner from '$lib/ios/Spinner.svelte';

	// Recherche globale façon Réglages / Spotlight : bacs, paramètres, tâches, espèces, vivants,
	// matériel et notes, regroupés par section, texte trouvé en gras.

	interface Hit {
		key: string;
		title: string;
		subtitle?: string;
		href: string;
		icon: IconName;
		color: string;
	}
	interface Inhabitant { id: number; kind: 'faune' | 'flore'; species: string; quantity: number; leftOn: string | null }
	interface Equipment { id: number; name: string; category: string | null }
	interface Note { id: number; body: string; notedOn: string }

	const RECENTS_KEY = 'recent-searches';
	const PER_SECTION = 6;

	let query = $state('');
	let recents = $state<string[]>([]);
	let species = $state<Species[]>([]);
	let speciesLoading = $state(false);
	let extra = $state<{ aquariumId: number; inhabitants: Inhabitant[]; equipment: Equipment[]; notes: Note[] }[]>([]);
	let expanded = $state<Record<string, boolean>>({});

	const view = $derived(store.view);
	const tankName = (id: number) => view?.aquariums.find((a) => a.id === id)?.name ?? '';

	/** Minuscules sans accents, caractère par caractère : les positions restent alignées sur le texte d'origine. */
	const fold = (text: string) =>
		Array.from(text, (c) => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().charAt(0) || c).join('');
	const needle = $derived(fold(query.trim()));
	const matches = (...texts: (string | null | undefined)[]) => texts.some((t) => t && fold(t).includes(needle));

	/** Découpe un texte autour de la correspondance pour la mettre en gras. */
	function parts(text: string): { text: string; hit: boolean }[] {
		if (!needle) return [{ text, hit: false }];
		const at = fold(text).indexOf(needle);
		if (at < 0) return [{ text, hit: false }];
		return [
			{ text: text.slice(0, at), hit: false },
			{ text: text.slice(at, at + needle.length), hit: true },
			{ text: text.slice(at + needle.length), hit: false }
		].filter((p) => p.text);
	}

	/** Extrait d'une note autour du mot trouvé. */
	function excerpt(body: string): string {
		const at = fold(body).indexOf(needle);
		if (at < 40) return body.slice(0, 90);
		return '…' + body.slice(at - 30, at + 60);
	}

	const sections = $derived.by(() => {
		if (!view || needle.length < 1) return [];
		const out: { id: string; title: string; hits: Hit[] }[] = [];
		const tanks = view.aquariums
			.filter((a) => matches(a.name, SHORT_WATER[a.waterType]))
			.map<Hit>((a) => ({
				key: `a${a.id}`,
				title: a.name,
				subtitle: `${SHORT_WATER[a.waterType]}${a.volumeL ? ` · ${a.volumeL} L` : ''}`,
				href: `/aquariums/${a.id}`,
				icon: TANK_ICON[a.waterType],
				color: TANK_TONE[a.waterType]
			}));
		out.push({ id: 'bacs', title: 'Bacs', hits: tanks });
		out.push({
			id: 'parametres',
			title: 'Paramètres',
			hits: view.parameters
				.filter((p) => matches(p.name, p.key))
				.map((p) => ({ key: `p${p.id}`, title: p.name, subtitle: tankName(p.aquariumId), href: `/aquariums/${p.aquariumId}/parametre/${p.id}`, icon: 'chart', color: 'var(--blue)' }))
		});
		out.push({
			id: 'taches',
			title: 'Tâches',
			hits: view.tasks
				.filter((t) => matches(t.title))
				.map((t) => ({
					key: `t${t.id}`,
					title: t.title,
					subtitle: `${tankName(t.aquariumId)} · tous les ${t.everyDays} j`,
					href: `/aquariums/${t.aquariumId}/taches`,
					icon: 'calendar',
					color: 'var(--red)'
				}))
		});
		out.push({
			id: 'especes',
			title: 'Espèces',
			hits: species.map((s) => ({
				key: `s${s.id}`,
				title: speciesName(s),
				subtitle: `${s.scientificName} · ${KIND_LABELS[s.kind]}`,
				href: `/especes?id=${s.id}`,
				icon: s.kind === 'plante' ? 'leaf' : s.kind === 'corail' ? 'coral' : 'fish',
				color: 'var(--teal)'
			}))
		});
		const living: Hit[] = [];
		const gear: Hit[] = [];
		const notes: Hit[] = [];
		for (const e of extra) {
			for (const i of e.inhabitants) {
				if (!i.leftOn && matches(i.species))
					living.push({
						key: `i${i.id}`,
						title: i.species,
						subtitle: `${tankName(e.aquariumId)} · ${i.quantity} ${i.kind === 'flore' ? 'pied' : 'individu'}${i.quantity > 1 ? 's' : ''}`,
						href: `/aquariums/${e.aquariumId}/inventaire`,
						icon: i.kind === 'flore' ? 'leaf' : 'fish',
						color: i.kind === 'flore' ? 'var(--green)' : 'var(--orange)'
					});
			}
			for (const q of e.equipment) {
				if (matches(q.name, q.category))
					gear.push({ key: `e${q.id}`, title: q.name, subtitle: tankName(e.aquariumId), href: `/aquariums/${e.aquariumId}/inventaire`, icon: 'box', color: 'var(--brown)' });
			}
			for (const n of e.notes) {
				if (matches(n.body))
					notes.push({
						key: `n${n.id}`,
						title: excerpt(n.body),
						subtitle: `${tankName(e.aquariumId)} · ${new Date(`${n.notedOn}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`,
						href: `/aquariums/${e.aquariumId}/journal`,
						icon: 'note',
						color: 'var(--yellow)'
					});
			}
		}
		out.push({ id: 'vivants', title: 'Vivants', hits: living });
		out.push({ id: 'materiel', title: 'Matériel', hits: gear });
		out.push({ id: 'notes', title: 'Notes', hits: notes });
		return out.filter((s) => s.hits.length);
	});

	// Espèces : recherche côté serveur, avec un court délai entre deux frappes.
	let timer: ReturnType<typeof setTimeout> | undefined;
	let latest = 0;
	function searchSpecies() {
		clearTimeout(timer);
		const q = query.trim();
		if (q.length < 2 || !navigator.onLine) {
			species = [];
			speciesLoading = false;
			return;
		}
		speciesLoading = true;
		const ticket = ++latest;
		timer = setTimeout(async () => {
			try {
				const list = await api<Species[]>('GET', `/api/species?q=${encodeURIComponent(q)}`);
				if (ticket === latest) species = list.slice(0, 20);
			} catch {
				if (ticket === latest) species = [];
			} finally {
				if (ticket === latest) speciesLoading = false;
			}
		}, 250);
	}

	onMount(() => {
		try {
			recents = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]');
		} catch {
			recents = [];
		}
		// Le champ prend le focus à l'arrivée (iOS n'ouvre le clavier que si l'arrivée suit un toucher).
		requestAnimationFrame(() => document.querySelector<HTMLInputElement>('input[type="search"]')?.focus());
		// Vivants, matériel et notes de chaque bac : chargés une fois, en ligne seulement.
		if (navigator.onLine && view) {
			void Promise.all(
				view.aquariums.map(async (a) => {
					const [inhabitants, equipment, notes] = await Promise.all([
						listResource<Inhabitant>('inhabitants', a.id).catch(() => []),
						listResource<Equipment>('equipment', a.id).catch(() => []),
						listResource<Note>('notes', a.id).catch(() => [])
					]);
					return { aquariumId: a.id, inhabitants, equipment, notes };
				})
			).then((list) => (extra = list));
		}
		return () => clearTimeout(timer);
	});

	function remember() {
		const q = query.trim();
		if (q.length < 2) return;
		recents = [q, ...recents.filter((r) => fold(r) !== fold(q))].slice(0, 6);
		try {
			localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
		} catch {
			// Historique non conservé : sans conséquence.
		}
	}

	function clearRecents() {
		recents = [];
		try {
			localStorage.removeItem(RECENTS_KEY);
		} catch {
			// Rien à faire.
		}
	}

	function use(q: string) {
		query = q;
		searchSpecies();
	}
</script>

<svelte:head><title>Rechercher · Aquarium</title></svelte:head>

<NavBar title="Rechercher" back={{ href: '/', label: 'Aujourd’hui' }}>
	<form onsubmit={(e) => { e.preventDefault(); remember(); (document.activeElement as HTMLElement | null)?.blur(); }}>
		<SearchField bind:value={query} oninput={searchSpecies} placeholder="Bacs, espèces, notes, matériel…" />
	</form>
</NavBar>

<div class="mt-4">
	{#if !query.trim()}
		{#if recents.length}
			<section class="mb-8">
				<div class="mb-1.5 flex items-baseline justify-between px-1">
					<h2 class="title3 font-bold">Recherches récentes</h2>
					<button class="btn-plain subhead" onclick={clearRecents}>Effacer</button>
				</div>
				<ul class="group recents">
					{#each recents as r (r)}
						<li>
							<button class="tappable flex w-full items-center gap-3 pl-4 text-left" onclick={() => use(r)}>
								<span class="text-label2"><Icon name="search" size={18} weight={2} /></span>
								<span class="row-body body min-h-11 flex-1 py-2.5 pr-4 text-tint">{r}</span>
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{:else}
			<div class="mt-20 flex flex-col items-center px-8 text-center text-label2">
				<Icon name="search" size={44} weight={1.6} />
				<p class="title3 mt-4 text-label">Cherche dans tout l’aquarium</p>
				<p class="subhead mt-1.5">Bacs, paramètres, tâches, espèces de l’encyclopédie, vivants, matériel et notes du journal.</p>
			</div>
		{/if}
	{:else if sections.length === 0}
		{#if speciesLoading}
			<div class="mt-16 flex justify-center"><Spinner spinning /></div>
		{:else}
			<div class="mt-20 flex flex-col items-center px-8 text-center">
				<p class="title3">Aucun résultat pour « {query.trim()} »</p>
				<p class="subhead mt-1.5 text-label2">Vérifie l’orthographe ou essaie un autre mot.</p>
			</div>
		{/if}
	{:else}
		{#each sections as section (section.id)}
			{@const shown = expanded[section.id] ? section.hits : section.hits.slice(0, PER_SECTION)}
			<Section header={section.title}>
				{#each shown as hit (hit.key)}
					<li>
						<a href={hit.href} onclick={remember} class="tappable flex items-center gap-3 pl-4">
							<span class="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px] text-white" style="background: {hit.color}; --cut: {hit.color}">
								<Icon name={hit.icon} size={19} filled weight={2} />
							</span>
							<div class="row-body flex min-h-11 min-w-0 flex-1 items-center gap-3 py-2 pr-4">
								<div class="min-w-0 flex-1">
									<p class="body truncate text-label2">
										{#each parts(hit.title) as p, i (i)}{#if p.hit}<strong class="font-semibold text-label">{p.text}</strong>{:else}<span class="text-label">{p.text}</span>{/if}{/each}
									</p>
									{#if hit.subtitle}<p class="footnote truncate text-label2">{hit.subtitle}</p>{/if}
								</div>
								<span class="-mr-1 shrink-0 text-label3"><Icon name="next" size={18} weight={2.4} /></span>
							</div>
						</a>
					</li>
				{/each}
				{#if section.hits.length > PER_SECTION && !expanded[section.id]}
					<li>
						<button class="tappable flex w-full pl-4" onclick={() => (expanded[section.id] = true)}>
							<span class="row-body body min-h-11 flex-1 py-2.5 text-left text-tint">Afficher les {section.hits.length} résultats</span>
						</button>
					</li>
				{/if}
			</Section>
		{/each}
		{#if speciesLoading}
			<div class="flex justify-center pb-6"><Spinner spinning size={20} /></div>
		{/if}
	{/if}
</div>

<style>
	.recents > li + li .row-body {
		box-shadow: inset 0 0.5px 0 var(--sep);
	}
</style>

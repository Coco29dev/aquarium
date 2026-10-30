<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { ui } from '$lib/client/ui.svelte';
	import { api, createResource, deleteResource, listResource, toText } from '$lib/client/api';
	import { shrinkImage } from '$lib/client/image';
	import { dayInParis } from '$lib/domain/dates';
	import { fmt, relativeDay } from '$lib/ui';
	import Icon from '$lib/components/Icon.svelte';
	import TankHeader from '$lib/components/TankHeader.svelte';

	interface Note { id: number; body: string; notedOn: string }
	interface Photo { id: number; caption: string | null; takenOn: string }

	const id = $derived(Number(page.params.id));
	const view = $derived(store.view);
	const aquarium = $derived(view?.aquariums.find((a) => a.id === id));
	const today = dayInParis();

	let notes = $state<Note[]>([]);
	let photos = $state<Photo[]>([]);
	let message = $state('');
	let uploading = $state(false);
	let viewing = $state<Photo | null>(null);
	let draft = $state('');
	let loaded = $state(false);
	// Par défaut le carnet (notes, photos, entretien) ; les séries de mesures en option.
	let withTests = $state(false);

	async function load() {
		try {
			[notes, photos] = await Promise.all([listResource<Note>('notes', id), api<Photo[]>('GET', `/api/photos?aquariumId=${id}`)]);
			message = '';
		} catch (e) {
			message = (e as Error).message;
		} finally {
			loaded = true;
		}
	}
	onMount(load);

	async function addNote(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		try {
			await createResource('notes', id, { body: toText(new FormData(form).get('body')) });
			draft = '';
			await load();
			ui.show('Note ajoutée au carnet');
		} catch (e) {
			message = (e as Error).message;
		}
	}

	async function upload(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = [...(input.files ?? [])];
		if (!files.length) return;
		uploading = true;
		message = '';
		try {
			for (const file of files) {
				const body = new FormData();
				body.set('file', await shrinkImage(file), 'photo.jpg');
				body.set('aquariumId', String(id));
				const response = await fetch('/api/photos', { method: 'POST', body });
				if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? `Erreur ${response.status}`);
			}
			await load();
			ui.show(files.length > 1 ? `${files.length} photos ajoutées` : 'Photo ajoutée');
		} catch (e) {
			message = (e as Error).message;
		} finally {
			uploading = false;
			input.value = '';
		}
	}

	async function removePhoto(photo: Photo) {
		if (!confirm('Supprimer cette photo ?')) return;
		try {
			await api('DELETE', `/api/photos/${photo.id}`);
			viewing = null;
			await load();
		} catch (e) {
			message = (e as Error).message;
		}
	}

	async function removeNote(note: Note) {
		if (!confirm('Supprimer cette note ?')) return;
		try {
			await deleteResource('notes', note.id);
			await load();
		} catch (e) {
			message = (e as Error).message;
		}
	}

	// Fil du carnet : notes, photos, tâches faites et séries de mesures, regroupés par jour.
	type Entry =
		| { kind: 'note'; note: Note }
		| { kind: 'photos'; photos: Photo[] }
		| { kind: 'done'; title: string; time: string }
		| { kind: 'tests'; summary: string; count: number };

	const days = $derived.by(() => {
		const byDay = new Map<string, Entry[]>();
		const push = (day: string, entry: Entry) => {
			const list = byDay.get(day);
			if (list) list.push(entry);
			else byDay.set(day, [entry]);
		};
		for (const note of notes) push(note.notedOn.slice(0, 10), { kind: 'note', note });
		const photoDays = new Map<string, Photo[]>();
		for (const photo of photos) {
			const d = photo.takenOn.slice(0, 10);
			photoDays.set(d, [...(photoDays.get(d) ?? []), photo]);
		}
		for (const [d, list] of photoDays) push(d, { kind: 'photos', photos: list });

		const tasks = (view?.tasks ?? []).filter((t) => t.aquariumId === id);
		for (const c of view?.completions ?? []) {
			const task = tasks.find((t) => t.id === c.taskId);
			if (!task) continue;
			const time = new Date(c.doneAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
			push(dayInParis(c.doneAt), { kind: 'done', title: task.title, time });
		}

		const params = (view?.parameters ?? []).filter((p) => p.aquariumId === id);
		const tests = new Map<string, Map<number, number>>();
		for (const m of view?.measurements ?? []) {
			if (m.aquariumId !== id) continue;
			const d = dayInParis(m.measuredAt);
			const map = tests.get(d) ?? new Map<number, number>();
			map.set(m.parameterId, m.value);
			tests.set(d, map);
		}
		for (const [d, values] of withTests ? tests : []) {
			const parts = params
				.filter((p) => values.has(p.id))
				.map((p) => `${p.name.replace(/\s*\(.*\)$/, '')} ${fmt(values.get(p.id)!, p.decimals)}`);
			push(d, { kind: 'tests', summary: parts.slice(0, 4).join(' · '), count: parts.length });
		}

		const order = { photos: 0, note: 1, done: 2, tests: 3 } as const;
		return [...byDay.entries()]
			.sort((a, b) => b[0].localeCompare(a[0]))
			.map(([day, entries]) => ({ day, entries: entries.sort((a, b) => order[a.kind] - order[b.kind]) }));
	});

	const dayLabel = (d: string) => {
		const rel = relativeDay(d, today);
		const long = new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
		return rel === "aujourd'hui" || rel === 'hier' ? `${rel} · ${long}` : long;
	};
	// Légère inclinaison stable par élément, comme collé à la main.
	const tilt = (n: number) => [-1.4, 0.9, -0.6, 1.3, -1, 0.5][n % 6];
</script>

<svelte:head><title>Journal · {aquarium?.name ?? 'Bac'}</title></svelte:head>

{#if !aquarium}
	<p class="hand text-lg text-muted">Bac introuvable.</p>
{:else}
	<TankHeader {aquarium} tab="journal" />

	{#if message}<p class="mb-4 rounded-xl border-2 border-bad bg-bad-soft p-3 text-sm font-bold text-bad" role="alert">{message}</p>{/if}

	<!-- Écrire dans le carnet -->
	<form onsubmit={addNote} class="card rise mb-8 overflow-hidden">
		<label class="block">
			<span class="sr-only">Nouvelle note</span>
			<textarea
				name="body"
				bind:value={draft}
				required
				rows="3"
				maxlength="4000"
				placeholder="Une observation, un comportement, un incident…"
				class="lined hand block w-full resize-none bg-transparent px-4 pt-2 text-xl outline-none placeholder:text-muted"
			></textarea>
		</label>
		<div class="flex items-center gap-2 border-t-2 border-edge px-3 py-2.5">
			<label class="btn-ghost min-h-0 cursor-pointer px-3 py-2 text-sm {uploading ? 'opacity-50' : ''}">
				<Icon name="camera" size={18} />{uploading ? 'Envoi…' : 'Photo'}
				<input type="file" accept="image/*" multiple class="sr-only" disabled={uploading} onchange={upload} />
			</label>
			<button class="btn ml-auto min-h-0 px-4 py-2 text-sm" disabled={!draft.trim()}>
				<Icon name="edit" size={16} />Noter
			</button>
		</div>
	</form>

	<!-- Fil chronologique -->
	<div class="mb-5 flex rounded-xl border-2 border-edge bg-surface p-0.5 text-sm font-bold" role="group" aria-label="Contenu du fil">
		<button class="flex-1 rounded-lg py-1.5 {withTests ? 'text-muted' : 'bg-ink text-on-ink'}" aria-pressed={!withTests} onclick={() => (withTests = false)}>Carnet</button>
		<button class="flex-1 rounded-lg py-1.5 {withTests ? 'bg-ink text-on-ink' : 'text-muted'}" aria-pressed={withTests} onclick={() => (withTests = true)}>Avec les mesures</button>
	</div>

	{#if loaded && days.length === 0}
		<p class="hand text-lg text-muted">Le carnet est vierge. Première page à écrire.</p>
	{/if}

	<ol class="relative flex flex-col gap-7 border-l-2 border-dashed border-line pl-5">
		{#each days as { day, entries }, di (day)}
			<li class="rise relative" style="animation-delay: {Math.min(di, 6) * 40}ms">
				<span class="absolute -left-[29px] top-1 h-4 w-4 rounded-full border-2 border-edge {day === today ? 'bg-sun' : 'bg-surface'}"></span>
				<p class="num mb-3 text-xs uppercase tracking-wider text-muted">{dayLabel(day)}</p>
				<div class="flex flex-col gap-3">
					{#each entries as entry, ei (ei)}
						{#if entry.kind === 'note'}
							<figure class="lined card-flat relative px-4 pb-3 pt-2" style="rotate: {tilt(entry.note.id)}deg">
								<p class="hand whitespace-pre-wrap pr-6 text-xl leading-[1.75rem]">{entry.note.body}</p>
								<button class="absolute right-2 top-2 text-muted" onclick={() => removeNote(entry.note)} aria-label="Supprimer la note">
									<Icon name="close" size={16} />
								</button>
							</figure>
						{:else if entry.kind === 'photos'}
							<div class="grid grid-cols-2 gap-4 py-1">
								{#each entry.photos as photo (photo.id)}
									<button
										class="press border-2 border-edge bg-surface p-2 pb-1 shadow-[3px_3px_0_var(--shadow)]"
										style="rotate: {tilt(photo.id)}deg"
										onclick={() => (viewing = photo)}
									>
										<img src="/api/photos/{photo.id}" alt={photo.caption ?? `Photo du ${dayLabel(day)}`} loading="lazy" class="aspect-square w-full border-[1.5px] border-edge object-cover" />
										<span class="hand block truncate pt-1 text-base text-muted">{photo.caption ?? dayLabel(day)}</span>
									</button>
								{/each}
							</div>
						{:else if entry.kind === 'done'}
							<p class="flex items-center gap-2 text-sm">
								<span class="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ok text-surface"><Icon name="check" size={13} /></span>
								<span class="min-w-0 flex-1 truncate font-bold">{entry.title}</span>
								<span class="num shrink-0 text-xs text-muted">{entry.time}</span>
							</p>
						{:else}
							<a href="/aquariums/{id}" class="flex items-start gap-2 text-sm">
								<span class="grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px] border-edge bg-sun text-[#16202e]"><Icon name="drop" size={12} /></span>
								<span class="min-w-0 flex-1 text-muted">
									<span class="font-bold text-ink">{entry.count} mesure{entry.count > 1 ? 's' : ''}</span> · <span class="num text-xs">{entry.summary}{entry.count > 4 ? '…' : ''}</span>
								</span>
							</a>
						{/if}
					{/each}
				</div>
			</li>
		{/each}
	</ol>
{/if}

{#if viewing}
	<div class="fixed inset-0 z-50 flex flex-col bg-black/95 text-[#fafbf8]" role="dialog" aria-modal="true" aria-label="Photo">
		<div class="flex items-center justify-between p-4 text-sm" style="padding-top: max(1rem, env(safe-area-inset-top))">
			<span class="num">{dayLabel(viewing.takenOn.slice(0, 10))}</span>
			<span class="flex gap-5">
				<button class="flex items-center gap-1 font-bold text-bad" onclick={() => viewing && removePhoto(viewing)}><Icon name="trash" size={16} />Supprimer</button>
				<button class="flex items-center gap-1 font-bold" onclick={() => (viewing = null)}><Icon name="close" size={16} />Fermer</button>
			</span>
		</div>
		<img src="/api/photos/{viewing.id}" alt={viewing.caption ?? 'Photo'} class="min-h-0 flex-1 object-contain" />
	</div>
{/if}

<style>
	/* Papier ligné du carnet. */
	.lined {
		background-image: repeating-linear-gradient(
			to bottom,
			transparent 0,
			transparent calc(1.75rem - 1px),
			var(--line) calc(1.75rem - 1px),
			var(--line) 1.75rem
		);
		background-position: 0 0.45rem;
		line-height: 1.75rem;
	}
	figure.lined {
		background-color: var(--surface);
	}
</style>

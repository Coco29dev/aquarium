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
	import NavBar from '$lib/ios/NavBar.svelte';
	import TankTabs from '$lib/ios/TankTabs.svelte';
	import Segmented from '$lib/ios/Segmented.svelte';
	import Sheet from '$lib/ios/Sheet.svelte';

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

	let writing = $state(false);
	async function addNote() {
		const body = toText(draft);
		if (!body) return;
		try {
			await createResource('notes', id, { body });
			draft = '';
			writing = false;
			await load();
			ui.show('Note ajoutée', undefined, 'check');
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
			ui.show(files.length > 1 ? `${files.length} photos ajoutées` : 'Photo ajoutée', undefined, 'check');
		} catch (e) {
			message = (e as Error).message;
		} finally {
			uploading = false;
			input.value = '';
		}
	}

	async function removePhoto(photo: Photo) {
		if (!(await ui.confirm({ title: 'Supprimer cette photo ?', confirmLabel: 'Supprimer', destructive: true }))) return;
		try {
			await api('DELETE', `/api/photos/${photo.id}`);
			viewing = null;
			await load();
		} catch (e) {
			message = (e as Error).message;
		}
	}

	/** Fait de cette photo la couverture de la fiche du bac (ou la retire si elle l'est déjà). */
	async function toggleCover(photo: Photo) {
		const isCover = aquarium?.coverPhotoId === photo.id;
		try {
			await store.mutate('PATCH', `/api/aquariums/${id}`, { coverPhotoId: isCover ? null : photo.id });
			ui.show(isCover ? 'Photo de couverture retirée' : 'Photo de couverture du bac', undefined, 'check');
		} catch (e) {
			ui.show((e as Error).message);
		}
	}

	async function removeNote(note: Note) {
		if (!(await ui.confirm({ title: 'Supprimer cette note ?', message: note.body.slice(0, 80), confirmLabel: 'Supprimer', destructive: true }))) return;
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
		const long = new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
		return rel === "aujourd'hui" ? 'Aujourd’hui' : rel === 'hier' ? 'Hier' : long.charAt(0).toUpperCase() + long.slice(1);
	};

	// Visionneuse : glisser vers le bas pour fermer.
	let dragY = $state(0);
	let startY = 0;
	let dragging = $state(false);
	let photoInput = $state<HTMLInputElement>();
</script>

<svelte:head><title>Journal · {aquarium?.name ?? 'Bac'}</title></svelte:head>

{#if !aquarium}
	<NavBar title="Bac introuvable" back={{ href: '/aquariums', label: 'Bacs' }} large={false} />
{:else}
	<NavBar title={aquarium.name} back={{ href: '/aquariums', label: 'Bacs' }}>
		{#snippet trailing()}
			<button class="btn-plain grid h-9 w-9 place-items-center" onclick={() => photoInput?.click()} disabled={uploading} aria-label="Ajouter une photo">
				<Icon name="camera" size={24} />
			</button>
			<button class="btn-plain grid h-9 w-9 place-items-center" onclick={() => (writing = true)} aria-label="Nouvelle note">
				<Icon name="edit" size={23} />
			</button>
		{/snippet}
		<TankTabs {aquarium} tab="journal" />
	</NavBar>
	<input bind:this={photoInput} type="file" accept="image/*" multiple class="hidden" onchange={upload} />

	<div class="mt-4">
		{#if message}<p class="subhead mb-4 rounded-2xl bg-red/10 px-4 py-3 text-red" role="alert">{message}</p>{/if}
		{#if uploading}<p class="subhead mb-4 px-1 text-label2">Envoi de la photo…</p>{/if}

		<div class="mb-6">
			<Segmented
				label="Contenu du journal"
				options={[
					{ value: 'carnet', label: 'Carnet' },
					{ value: 'tests', label: 'Avec les mesures' }
				]}
				value={withTests ? 'tests' : 'carnet'}
				onchange={(v) => (withTests = v === 'tests')}
			/>
		</div>

		{#if loaded && days.length === 0}
			<div class="mt-14 flex flex-col items-center px-6 text-center">
				<span class="mb-3 text-label3"><Icon name="book" size={56} weight={1.4} /></span>
				<h2 class="title3">Journal vide</h2>
				<p class="subhead mt-1 text-label2">Note une observation, un incident, une taille de plantes, ou ajoute une photo du bac.</p>
				<button class="btn-tinted mt-5" onclick={() => (writing = true)}>Nouvelle note</button>
			</div>
		{/if}

		{#each days as { day, entries } (day)}
			<section class="mb-6">
				<h2 class="headline mb-2 px-1">{dayLabel(day)}</h2>
				<div class="group">
					{#each entries as entry, n (n)}
						<div class="px-4 py-3 {n ? 'shadow-[inset_0_0.5px_0_var(--sep)]' : ''}">
							{#if entry.kind === 'note'}
								<div class="flex items-start gap-3">
									<p class="body min-w-0 flex-1 whitespace-pre-line select-text">{entry.note.body}</p>
									<button class="shrink-0 text-label3 active:opacity-50" onclick={() => removeNote(entry.note)} aria-label="Supprimer la note">
										<Icon name="trash" size={19} />
									</button>
								</div>
							{:else if entry.kind === 'photos'}
								<div class="grid gap-1 {entry.photos.length === 1 ? 'grid-cols-1' : entry.photos.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}">
									{#each entry.photos as photo (photo.id)}
										<button class="pressable overflow-hidden rounded-xl" onclick={() => (viewing = photo)}>
											<img
												src="/api/photos/{photo.id}"
												alt={photo.caption ?? `Photo du ${dayLabel(day)}`}
												loading="lazy"
												class="w-full bg-fill3 object-cover {entry.photos.length === 1 ? 'aspect-[4/3]' : 'aspect-square'}"
											/>
										</button>
									{/each}
								</div>
							{:else if entry.kind === 'done'}
								<p class="subhead flex items-center gap-2 text-label2">
									<span class="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-green text-white"><Icon name="check" size={11} weight={3.4} /></span>
									<span class="min-w-0 flex-1 truncate text-label">{entry.title}</span>
									<span class="rounded-num">{entry.time}</span>
								</p>
							{:else if entry.kind === 'tests'}
								<p class="subhead flex items-start gap-2 text-label2">
									<span class="mt-px shrink-0 text-tint"><Icon name="drop" size={18} filled /></span>
									<span class="min-w-0 flex-1">
										<span class="text-label">{entry.count} mesure{entry.count > 1 ? 's' : ''}</span> · {entry.summary}{entry.count > 4 ? '…' : ''}
									</span>
								</p>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/each}
	</div>

	<Sheet open={writing} title="Nouvelle note" detent="medium" onclose={() => (writing = false)} action={{ label: 'Ajouter', onclick: addNote, disabled: !draft.trim() }}>
		<textarea
			bind:value={draft}
			rows="6"
			class="body group w-full resize-none p-4 outline-none placeholder:text-label3"
			placeholder="Une observation, un comportement, un incident…"
			aria-label="Texte de la note"
		></textarea>
		<p class="footnote mt-2 px-4 text-label2">Datée d’aujourd’hui, {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.</p>
	</Sheet>
{/if}

{#if viewing}
	{@const photo = viewing}
	<div
		class="fixed inset-0 z-[55] flex flex-col bg-black text-white"
		style="animation: fade-in 200ms both; opacity: {1 - Math.min(0.6, dragY / 500)}"
		role="dialog"
		aria-modal="true"
		aria-label="Photo"
	>
		<div class="flex items-center justify-between px-4" style="padding-top: calc(env(safe-area-inset-top) + 8px)">
			<button class="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur-xl active:opacity-60" onclick={() => (viewing = null)} aria-label="Fermer">
				<Icon name="close" size={20} weight={2.4} />
			</button>
			<p class="subhead font-semibold">{dayLabel(photo.takenOn.slice(0, 10))}</p>
			<button class="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-[#ff453a] backdrop-blur-xl active:opacity-60" onclick={() => removePhoto(photo)} aria-label="Supprimer la photo">
				<Icon name="trash" size={20} />
			</button>
		</div>
		<div
			class="flex min-h-0 flex-1 touch-none items-center justify-center"
			style="transform: translateY({dragY}px) scale({1 - Math.min(0.2, dragY / 1500)}); transition: {dragging ? 'none' : 'transform 300ms cubic-bezier(0.3,0.8,0.3,1)'}"
			onpointerdown={(e) => {
				dragging = true;
				startY = e.clientY;
				(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
			}}
			onpointermove={(e) => dragging && (dragY = Math.max(0, e.clientY - startY))}
			onpointerup={() => {
				dragging = false;
				if (dragY > 120) viewing = null;
				dragY = 0;
			}}
			onpointercancel={() => ((dragging = false), (dragY = 0))}
			role="presentation"
		>
			<img src="/api/photos/{photo.id}" alt={photo.caption ?? 'Photo'} class="max-h-full max-w-full object-contain" draggable="false" />
		</div>
		{#if photo.caption}<p class="subhead px-6 pb-2 text-center text-white/80">{photo.caption}</p>{/if}
		<div class="flex justify-center px-6 pt-2">
			<button class="subhead flex items-center gap-2 rounded-full bg-white/15 px-4 py-2.5 font-semibold text-white backdrop-blur-xl active:opacity-60" onclick={() => toggleCover(photo)}>
				<Icon name="camera" size={18} />
				{aquarium?.coverPhotoId === photo.id ? 'Retirer de la couverture' : 'Définir comme photo du bac'}
			</button>
		</div>
		<div style="height: calc(env(safe-area-inset-bottom) + 16px)"></div>
	</div>
{/if}

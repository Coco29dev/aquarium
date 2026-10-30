<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { store } from '$lib/client/store.svelte';
	import { api, createResource, deleteResource, listResource, toText } from '$lib/client/api';
	import { shrinkImage } from '$lib/client/image';

	interface Note { id: number; body: string; notedOn: string }
	interface Photo { id: number; caption: string | null; takenOn: string }

	const id = $derived(Number(page.params.id));
	const aquarium = $derived(store.view?.aquariums.find((a) => a.id === id));

	let notes = $state<Note[]>([]);
	let photos = $state<Photo[]>([]);
	let message = $state('');
	let uploading = $state(false);
	let viewing = $state<Photo | null>(null);

	async function load() {
		try {
			[notes, photos] = await Promise.all([listResource<Note>('notes', id), api<Photo[]>('GET', `/api/photos?aquariumId=${id}`)]);
			message = '';
		} catch (e) {
			message = (e as Error).message;
		}
	}
	onMount(load);

	async function addNote(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		try {
			await createResource('notes', id, { body: toText(new FormData(form).get('body')) });
			form.reset();
			await load();
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

	const field = 'w-full rounded-lg border border-cyan-900 bg-slate-950 px-3 py-2 text-sm';
	const date = (d: string) => new Date(d).toLocaleDateString('fr-FR');
</script>

<svelte:head><title>Journal · {aquarium?.name ?? 'Aquarium'}</title></svelte:head>

<a href="/aquariums/{id}" class="text-sm text-cyan-300 underline">← {aquarium?.name ?? 'Aquarium'}</a>
<h1 class="mb-6 mt-2 text-2xl font-semibold">Journal</h1>
{#if message}<p class="mb-4 rounded-lg bg-red-950 p-3 text-sm text-red-200" role="alert">{message}</p>{/if}

<section class="mb-8">
	<h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">Photos</h2>
	<label class="mb-3 block rounded-lg bg-cyan-700 px-4 py-3 text-center font-medium active:bg-cyan-800 {uploading ? 'opacity-40' : ''}">
		{uploading ? 'Envoi…' : 'Ajouter des photos'}
		<input type="file" accept="image/*" multiple class="sr-only" disabled={uploading} onchange={upload} />
	</label>
	<ul class="grid grid-cols-3 gap-2">
		{#each photos as photo (photo.id)}
			<li>
				<button class="block aspect-square w-full overflow-hidden rounded-lg bg-slate-900" onclick={() => (viewing = photo)}>
					<img src="/api/photos/{photo.id}" alt={photo.caption ?? `Photo du ${date(photo.takenOn)}`} loading="lazy" class="h-full w-full object-cover" />
				</button>
			</li>
		{/each}
	</ul>
	{#if photos.length === 0}<p class="text-sm text-slate-400">Aucune photo.</p>{/if}
</section>

<section>
	<h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">Notes</h2>
	<form onsubmit={addNote} class="mb-4 flex flex-col gap-2">
		<textarea name="body" required rows="3" maxlength="4000" placeholder="Observation, comportement, incident…" class={field}></textarea>
		<button class="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium active:bg-cyan-800">Ajouter la note</button>
	</form>
	<ul class="flex flex-col gap-2">
		{#each notes as note (note.id)}
			<li class="rounded-lg bg-slate-900 p-3">
				<div class="flex justify-between text-xs text-slate-400">
					<span>{date(note.notedOn)}</span>
					<button class="text-red-300 underline" onclick={() => confirm('Supprimer cette note ?') && deleteResource('notes', note.id).then(load)}>Supprimer</button>
				</div>
				<p class="mt-1 whitespace-pre-wrap text-sm">{note.body}</p>
			</li>
		{/each}
	</ul>
</section>

{#if viewing}
	<div class="fixed inset-0 z-50 flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label="Photo">
		<div class="flex items-center justify-between p-4 text-sm">
			<span>{date(viewing.takenOn)}</span>
			<span class="flex gap-5">
				<button class="text-red-300 underline" onclick={() => viewing && removePhoto(viewing)}>Supprimer</button>
				<button class="text-cyan-300 underline" onclick={() => (viewing = null)}>Fermer</button>
			</span>
		</div>
		<img src="/api/photos/{viewing.id}" alt={viewing.caption ?? 'Photo'} class="min-h-0 flex-1 object-contain" />
	</div>
{/if}

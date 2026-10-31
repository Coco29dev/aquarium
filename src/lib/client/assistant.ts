import type { AssistantEvent } from '$lib/domain/assistant';
import { shrinkImage } from './image';

/**
 * Appelle une route de l'assistant qui répond en flux d'événements (SSE) et transmet chaque
 * événement à `onEvent`. Lève une Error si la requête est refusée avant le flux.
 */
export async function streamAssistant(url: string, body: unknown, onEvent: (event: AssistantEvent) => void): Promise<void> {
	if (!navigator.onLine) throw new Error('Connexion requise.');
	const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
	if (response.status === 401) {
		location.href = '/login';
		throw new Error('Session expirée');
	}
	if (!response.ok || !response.body) {
		const detail = await response.json().catch(() => null);
		throw new Error(detail?.message ?? `Erreur ${response.status}`);
	}
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		let end: number;
		while ((end = buffer.indexOf('\n\n')) >= 0) {
			const chunk = buffer.slice(0, end);
			buffer = buffer.slice(end + 2);
			const data = chunk.startsWith('data: ') ? chunk.slice(6) : null;
			if (data) onEvent(JSON.parse(data) as AssistantEvent);
		}
	}
}

/** Réduit une photo puis l'envoie au serveur ; renvoie son identifiant, à joindre au message. */
export async function uploadChatImage(aquariumId: number, file: File): Promise<number> {
	if (!navigator.onLine) throw new Error('Connexion requise.');
	const blob = await shrinkImage(file, 1280, 0.8);
	const form = new FormData();
	form.set('file', new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
	form.set('aquariumId', String(aquariumId));
	const response = await fetch('/api/assistant/images', { method: 'POST', body: form });
	if (response.status === 401) {
		location.href = '/login';
		throw new Error('Session expirée');
	}
	if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? `Erreur ${response.status}`);
	return ((await response.json()) as { id: number }).id;
}

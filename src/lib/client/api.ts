// Appels JSON vers l'API. Ces données (inventaire, dépenses, notes, photos) demandent une connexion.

export async function api<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
	if (!navigator.onLine) throw new Error('Connexion requise.');
	const response = await fetch(url, {
		method,
		headers: body === undefined ? undefined : { 'content-type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	if (response.status === 401) {
		location.href = '/login';
		throw new Error('Session expirée');
	}
	if (!response.ok) {
		const detail = await response.json().catch(() => null);
		throw new Error(detail?.message ?? `Erreur ${response.status}`);
	}
	return response.json() as Promise<T>;
}

export const listResource = <T>(name: string, scope?: number) =>
	api<T[]>('GET', `/api/r/${name}${scope === undefined ? '' : `?scope=${scope}`}`);
export const createResource = (name: string, scopeId: number | null, fields: Record<string, unknown>) =>
	api<{ id: number }>('POST', `/api/r/${name}`, { scopeId, ...fields });
export const updateResource = (name: string, id: number, fields: Record<string, unknown>) =>
	api('PATCH', `/api/r/${name}/${id}`, fields);
export const deleteResource = (name: string, id: number) => api('DELETE', `/api/r/${name}/${id}`);

/** Champ de formulaire → nombre, ou null si vide. */
export const toNumber = (value: FormDataEntryValue | null): number | null => {
	const text = String(value ?? '').trim().replace(',', '.');
	return text === '' ? null : Number(text);
};
export const toText = (value: FormDataEntryValue | null): string | null => String(value ?? '').trim() || null;

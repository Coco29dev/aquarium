import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createEvent, isEventKind, listEvents } from '$lib/server/events';
import type { EventKind } from '$lib/types';
import { integer, readBody } from '$lib/server/validate';

const isoOrNull = (value: string | null, label: string): string | undefined => {
	if (!value) return undefined;
	if (Number.isNaN(Date.parse(value))) error(400, `Date invalide : ${label}`);
	return new Date(value).toISOString();
};

// GET /api/events?aquarium=ID&kind=a,b&from=ISO&to=ISO&limit=N : au-delà de la fenêtre du snapshot (statistiques).
export const GET: RequestHandler = async ({ url }) => {
	const aquarium = url.searchParams.get('aquarium');
	const kinds = (url.searchParams.get('kind') ?? '').split(',').filter(Boolean);
	if (!kinds.every(isEventKind)) error(400, "Type d'événement inconnu");
	const limit = url.searchParams.get('limit');
	return json(
		await listEvents({
			aquariumId: aquarium ? integer(Number(aquarium), 'aquarium') : undefined,
			kinds: kinds.length ? (kinds as EventKind[]) : undefined,
			from: isoOrNull(url.searchParams.get('from'), 'from'),
			to: isoOrNull(url.searchParams.get('to'), 'to'),
			limit: limit ? integer(Number(limit), 'limit') : undefined
		})
	);
};

// POST { aquariumId, kind, at?, payload, note? } → { id }
export const POST: RequestHandler = async ({ request }) => {
	const body = await readBody(request);
	if (!isEventKind(body.kind)) error(400, "Type d'événement inconnu");
	if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') error(400, 'Champ invalide : note');
	if (body.at !== undefined && (typeof body.at !== 'string' || Number.isNaN(Date.parse(body.at)))) error(400, 'Date invalide');
	const id = await createEvent({
		aquariumId: integer(body.aquariumId, 'aquariumId'),
		kind: body.kind,
		at: typeof body.at === 'string' ? new Date(body.at).toISOString() : undefined,
		payload: (body.payload ?? {}) as Record<string, unknown>,
		note: body.note as string | null | undefined
	});
	return json({ id }, { status: 201 });
};

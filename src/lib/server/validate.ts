import { error } from '@sveltejs/kit';
import type { WaterType } from '$lib/types';

type Body = Record<string, unknown>;

export async function readBody(request: Request): Promise<Body> {
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body)) error(400, 'Corps JSON attendu');
	return body as Body;
}

export function text(body: Body, field: string, required = true): string | undefined {
	const value = body[field];
	if (value === undefined || value === null || value === '') {
		if (required) error(400, `Champ requis : ${field}`);
		return undefined;
	}
	if (typeof value !== 'string' || value.length > 200) error(400, `Champ invalide : ${field}`);
	return value.trim();
}

/** Nombre, ou null si explicitement vide ; undefined si le champ est absent. */
export function number(body: Body, field: string): number | null | undefined {
	if (!(field in body)) return undefined;
	const value = body[field];
	if (value === null || value === '') return null;
	if (typeof value !== 'number' || !Number.isFinite(value)) error(400, `Champ invalide : ${field}`);
	return value;
}

export function integer(value: unknown, field: string): number {
	if (typeof value !== 'number' || !Number.isInteger(value)) error(400, `Champ invalide : ${field}`);
	return value;
}

export function day(body: Body, field: string): string | null | undefined {
	if (!(field in body)) return undefined;
	const value = body[field];
	if (value === null || value === '') return null;
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) error(400, `Date invalide : ${field}`);
	return value;
}

export function waterType(body: Body): WaterType {
	const value = body.waterType;
	if (value !== 'douce' && value !== 'plantee' && value !== 'mer' && value !== 'recif') {
		error(400, "Type d'eau invalide");
	}
	return value;
}

export function paramId(value: string): number {
	const id = Number(value);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Introuvable');
	return id;
}

/** Refuse une plage inversée quand les deux bornes sont fournies. */
export function range(min: number | null | undefined, max: number | null | undefined): void {
	if (min != null && max != null && min > max) error(400, 'Le minimum dépasse le maximum');
}

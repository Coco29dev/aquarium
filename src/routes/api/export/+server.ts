import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exportAll, exportCompletionsCsv, exportMeasurementsCsv } from '$lib/server/data';

// /api/export?format=json | csv&table=measurements|completions
export const GET: RequestHandler = async ({ url }) => {
	const format = url.searchParams.get('format') ?? 'json';
	const stamp = new Date().toISOString().slice(0, 10);
	if (format === 'json') {
		return new Response(JSON.stringify(await exportAll(), null, 2), {
			headers: {
				'content-type': 'application/json; charset=utf-8',
				'content-disposition': `attachment; filename="aquarium-${stamp}.json"`
			}
		});
	}
	if (format === 'csv') {
		const table = url.searchParams.get('table') ?? 'measurements';
		if (table !== 'measurements' && table !== 'completions') error(400, 'Table inconnue');
		const csv = table === 'measurements' ? await exportMeasurementsCsv() : await exportCompletionsCsv();
		return new Response('﻿' + csv, {
			headers: {
				'content-type': 'text/csv; charset=utf-8',
				'content-disposition': `attachment; filename="aquarium-${table}-${stamp}.csv"`
			}
		});
	}
	error(400, 'Format inconnu');
};

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { backupStatus, runBackup } from '$lib/server/backup';

export const GET: RequestHandler = async () => json(await backupStatus());

// Sauvegarde immédiate.
export const POST: RequestHandler = async () => {
	try {
		return json(await runBackup());
	} catch (e) {
		console.error('[sauvegarde]', e);
		error(502, 'Sauvegarde impossible : vérifie le stockage et les logs du service.');
	}
};

import { exportAll, readState, writeState } from './data';
import { deleteObject, putObject, remoteStorageConfigured } from './storage';
import { dayInParis } from '$lib/domain/dates';
import type { BackupStatus } from '$lib/types';

const LAST = 'last_backup';
const KEYS = 'backup_keys';
const KEEP = 8;

export async function backupStatus(): Promise<BackupStatus> {
	const last = await readState<{ at: string; key: string; bytes: number }>(LAST);
	return {
		lastBackupAt: last?.at ?? null,
		key: last?.key ?? null,
		bytes: last?.bytes ?? null,
		configured: remoteStorageConfigured()
	};
}

/**
 * Écrit l'export JSON complet dans le stockage (backups/aquarium-AAAA-MM-JJ.json) et ne garde
 * que les 8 dernières. Sans bucket, le fichier va sur le disque local du service.
 */
export async function runBackup(now = new Date()): Promise<BackupStatus> {
	const key = `backups/aquarium-${dayInParis(now)}.json`;
	const body = new TextEncoder().encode(JSON.stringify(await exportAll()));
	await putObject(key, body, 'application/json');
	const keys = (await readState<string[]>(KEYS)) ?? [];
	const kept = [...keys.filter((k) => k !== key), key];
	const removed = kept.splice(0, Math.max(0, kept.length - KEEP));
	await Promise.allSettled(removed.map((k) => deleteObject(k)));
	await writeState(KEYS, kept);
	await writeState(LAST, { at: now.toISOString(), key, bytes: body.byteLength });
	console.log(`[sauvegarde] ${key} (${body.byteLength} octets)${remoteStorageConfigured() ? '' : ' — disque local, pas de bucket'}`);
	return backupStatus();
}

import { readState, writeState } from './data';
import { DEFAULT_NOTIFICATION_SETTINGS, parseNotificationSettings } from '$lib/domain/notifications';
import type { NotificationSettings } from '$lib/types';
import { parseProfile, type Profile } from '$lib/domain/profile';

const KEY = 'notification_settings';

export async function getNotificationSettings(): Promise<NotificationSettings> {
	const stored = await readState<unknown>(KEY);
	if (!stored) return { ...DEFAULT_NOTIFICATION_SETTINGS };
	try {
		return parseNotificationSettings(stored);
	} catch {
		return { ...DEFAULT_NOTIFICATION_SETTINGS };
	}
}

export async function saveNotificationSettings(value: unknown): Promise<NotificationSettings> {
	const settings = parseNotificationSettings(value);
	await writeState(KEY, settings);
	return settings;
}

// --- Profil personnel (prénom, niveau, intérêt, couleur) ---

const PROFILE_KEY = 'profile';

export async function getProfile(): Promise<Profile> {
	return parseProfile(await readState<unknown>(PROFILE_KEY));
}

export async function saveProfile(value: unknown): Promise<Profile> {
	const profile = parseProfile(value);
	await writeState(PROFILE_KEY, profile);
	return profile;
}

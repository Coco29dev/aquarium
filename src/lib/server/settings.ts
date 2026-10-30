import { readState, writeState } from './data';
import { DEFAULT_NOTIFICATION_SETTINGS, parseNotificationSettings } from '$lib/domain/notifications';
import type { NotificationSettings } from '$lib/types';

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

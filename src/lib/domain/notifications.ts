import type { NotificationSettings } from '../types';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
	summaryTime: '08:30',
	quietStart: null,
	quietEnd: null,
	aquariumIds: null,
	ntfyTopic: null
};

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isTime(value: unknown): value is string {
	return typeof value === 'string' && HHMM.test(value);
}

/** 'HH:MM' → minutes depuis minuit. */
export function minutesOf(time: string): number {
	const [h, m] = time.split(':').map(Number);
	return h * 60 + m;
}

/** Minutes depuis minuit à Paris pour un instant donné. */
export function parisMinutes(now: Date | number = Date.now()): number {
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Europe/Paris',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(new Date(now));
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
	return get('hour') * 60 + get('minute');
}

/** Vrai pendant les heures de silence ; gère une plage qui passe minuit (22:00 → 07:00). */
export function inQuietHours(settings: Pick<NotificationSettings, 'quietStart' | 'quietEnd'>, minutes: number): boolean {
	const { quietStart, quietEnd } = settings;
	if (!quietStart || !quietEnd) return false;
	const start = minutesOf(quietStart);
	const end = minutesOf(quietEnd);
	if (start === end) return false;
	return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

/**
 * Le récapitulatif du jour part-il maintenant ? Oui à partir de l'heure choisie, tant qu'on
 * n'est pas en heures de silence (s'il tombe dedans, il part à leur fin), une fois par jour.
 */
export function summaryDue(
	settings: Pick<NotificationSettings, 'summaryTime' | 'quietStart' | 'quietEnd'>,
	minutes: number,
	alreadySentToday: boolean
): boolean {
	if (alreadySentToday) return false;
	if (minutes < minutesOf(settings.summaryTime)) return false;
	return !inQuietHours(settings, minutes);
}

/** Valide et complète des réglages reçus ; lève une erreur lisible si un champ est invalide. */
export function parseNotificationSettings(value: unknown): NotificationSettings {
	const v = (value ?? {}) as Record<string, unknown>;
	const out: NotificationSettings = { ...DEFAULT_NOTIFICATION_SETTINGS };
	if (v.summaryTime !== undefined) {
		if (!isTime(v.summaryTime)) throw new Error('Heure du récapitulatif invalide (HH:MM).');
		out.summaryTime = v.summaryTime;
	}
	for (const key of ['quietStart', 'quietEnd'] as const) {
		const t = v[key];
		if (t === undefined || t === null || t === '') out[key] = null;
		else if (isTime(t)) out[key] = t;
		else throw new Error('Heure de silence invalide (HH:MM).');
	}
	if (v.aquariumIds === undefined || v.aquariumIds === null) out.aquariumIds = null;
	else if (Array.isArray(v.aquariumIds) && v.aquariumIds.every((n) => Number.isInteger(n) && (n as number) > 0)) {
		out.aquariumIds = [...new Set(v.aquariumIds as number[])];
	} else throw new Error('Liste de bacs invalide.');
	if (v.ntfyTopic === undefined || v.ntfyTopic === null || v.ntfyTopic === '') out.ntfyTopic = null;
	else if (typeof v.ntfyTopic === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v.ntfyTopic.trim())) out.ntfyTopic = v.ntfyTopic.trim();
	else throw new Error('Sujet ntfy invalide (lettres, chiffres, - et _).');
	return out;
}

/** Prochaine échéance quand on ignore une occurrence : un cycle plus loin, jamais dans le passé. */
export function skipDue(nextDue: string, today: string, everyDays: number, addDays: (d: string, n: number) => string): string {
	return addDays(nextDue > today ? nextDue : today, everyDays);
}

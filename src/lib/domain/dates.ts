export const TIMEZONE = 'Europe/Paris';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Jour calendaire (YYYY-MM-DD) à Paris pour un instant donné. */
export function dayInParis(date: Date | string | number = Date.now()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: TIMEZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date(date));
}

export function addDays(day: string, days: number): string {
	const [y, m, d] = day.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
	const parse = (day: string) => {
		const [y, m, d] = day.split('-').map(Number);
		return Date.UTC(y, m - 1, d);
	};
	return Math.round((parse(to) - parse(from)) / DAY_MS);
}

export { DAY_MS };

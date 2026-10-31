// Rotation des sauvegardes JSON : les 7 plus récentes (une par jour), puis une par semaine
// (la plus récente de chaque semaine) pendant 4 semaines. Tout le reste est supprimé.

export const KEEP_DAILY = 7;
export const KEEP_WEEKLY = 4;

/** Date (AAAA-MM-JJ) d'une clé `backups/aquarium-AAAA-MM-JJ.json`, ou null. */
export function backupDay(key: string): string | null {
	return /aquarium-(\d{4}-\d{2}-\d{2})\.json$/.exec(key)?.[1] ?? null;
}

const weekOf = (day: string) => Math.floor(Date.parse(`${day}T12:00:00Z`) / (7 * 86_400_000));

/** Clés à garder parmi `keys`. Une clé au format inconnu est toujours gardée, par prudence. */
export function retainBackups(keys: string[]): string[] {
	const dated = keys
		.flatMap((key) => {
			const day = backupDay(key);
			return day ? [{ key, day }] : [];
		})
		.sort((a, b) => b.day.localeCompare(a.day));
	const keep = new Set(keys.filter((k) => backupDay(k) === null));
	for (const { key } of dated.slice(0, KEEP_DAILY)) keep.add(key);
	const weeks = new Set<number>();
	for (const { key, day } of dated.slice(KEEP_DAILY)) {
		const w = weekOf(day);
		if (weeks.has(w) || weeks.size >= KEEP_WEEKLY) continue;
		weeks.add(w);
		keep.add(key);
	}
	return keys.filter((k) => keep.has(k));
}

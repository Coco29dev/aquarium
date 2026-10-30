import type { Idea, RawIdea } from '$lib/domain/ideas';
import { IDEA_PLANTS } from './plants';
import { IDEAS_NANO_PETIT } from './nano-petit';
import { IDEAS_MOYEN } from './moyen';
import { IDEAS_GRAND } from './grand';
import { IDEAS_MER } from './mer';

const RAW: RawIdea[] = [...IDEAS_NANO_PETIT, ...IDEAS_MOYEN, ...IDEAS_GRAND, ...IDEAS_MER];

export const IDEAS: Idea[] = RAW.map((idea) => ({ ...idea, plants: IDEA_PLANTS[idea.slug] ?? { strict: [], mixed: [] } }));

export const ideaOf = (slug: string): Idea | undefined => IDEAS.find((i) => i.slug === slug);

/** Noms latins cités par une idée (animaux, coraux et plantes) : à charger depuis la base d'espèces. */
export function speciesNamesOf(idea: Idea): string[] {
	return [...new Set([...idea.stock.map(([s]) => s), ...idea.plants.mixed])];
}

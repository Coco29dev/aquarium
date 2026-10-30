import { BIOTOPES } from './biotopes';
import { DEMARRER } from './demarrer';
import { ENTRETIEN } from './entretien';
import { LEXIQUE } from './lexique';
import { PLANTES } from './plantes';
import { SANTE } from './sante';
import { VIVRE } from './vivre';
import type { Guide, Theme } from './types';

export * from './types';

/** Ordre d'affichage sur l'écran Encyclopédie. */
export const THEMES: Theme[] = [DEMARRER, ENTRETIEN, PLANTES, SANTE, VIVRE, BIOTOPES, LEXIQUE];

export const themeOf = (slug: string): Theme | undefined => THEMES.find((t) => t.slug === slug);

export function guideOf(themeSlug: string, guideSlug: string): { theme: Theme; guide: Guide } | undefined {
	const theme = themeOf(themeSlug);
	const guide = theme?.guides.find((g) => g.slug === guideSlug);
	return theme && guide ? { theme, guide } : undefined;
}

/** « thème/guide » → guide et thème, ou undefined si le lien est cassé. */
export function resolveRelated(ref: string): { theme: Theme; guide: Guide } | undefined {
	const [theme, guide] = ref.split('/');
	return guideOf(theme, guide);
}

export const ALL_GUIDES: { theme: Theme; guide: Guide }[] = THEMES.flatMap((theme) => theme.guides.map((guide) => ({ theme, guide })));

/** Texte brut d'un guide, pour la recherche. */
export function guideText(guide: Guide): string {
	return [guide.title, guide.summary, ...guide.blocks.flatMap((b) => [b.h, ...(b.p ?? []), ...(b.list ?? []), ...(b.steps ?? []), b.tip, b.warn])]
		.filter(Boolean)
		.join(' ');
}

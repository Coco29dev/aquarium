import type { IconName } from '$lib/components/Icon.svelte';

/** Un bloc de lecture : titre optionnel, paragraphes, liste à puces, étapes numérotées, astuce ou avertissement. */
export interface GuideBlock {
	h?: string;
	p?: string[];
	list?: string[];
	steps?: string[];
	tip?: string;
	warn?: string;
}

export type GuideLevel = 'debutant' | 'intermediaire' | 'avance';

export interface Guide {
	slug: string;
	title: string;
	summary: string;
	level?: GuideLevel;
	/** Temps de lecture en minutes. */
	minutes: number;
	blocks: GuideBlock[];
	/** Autres guides à lire ensuite, sous la forme « thème/guide ». */
	related?: string[];
	/** Noms latins d'espèces de l'encyclopédie à proposer (biotopes, cohabitation…). */
	species?: string[];
	/** Raccourci vers un outil de l'appli. */
	tool?: { label: string; href: string };
}

export interface Theme {
	slug: string;
	title: string;
	summary: string;
	icon: IconName;
	color: string;
	guides: Guide[];
}

export const LEVEL_LABELS: Record<GuideLevel, string> = {
	debutant: 'Débutant',
	intermediaire: 'Intermédiaire',
	avance: 'Avancé'
};

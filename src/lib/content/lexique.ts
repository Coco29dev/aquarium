import type { Theme } from './types';

export const LEXIQUE: Theme = {
	slug: 'lexique',
	title: 'Lexique',
	summary: 'Les mots de l’aquariophilie, expliqués simplement.',
	icon: 'book',
	color: 'var(--purple)',
	guides: [
		{
			slug: 'termes',
			title: 'Glossaire',
			summary: 'GH, KH, mbuna, cyclage, biotope… ce que ces mots veulent dire.',
			level: 'debutant',
			minutes: 5,
			blocks: [
				{
					h: 'Eau et chimie',
					list: [
						'pH : mesure de l’acidité de l’eau (7 est neutre).',
						'GH : dureté totale, teneur en calcium et magnésium.',
						'KH : dureté carbonatée, capacité de l’eau à résister aux variations de pH.',
						'TDS : total des matières dissoutes, mesuré en mg/L ou ppm.',
						'Osmose : filtration qui retire presque tous les minéraux de l’eau.',
						'Conditionneur : produit qui neutralise chlore et chloramines.',
						'Tanins : composés bruns libérés par le bois et les feuilles, qui acidifient l’eau.'
					]
				},
				{
					h: 'Azote et filtration',
					list: [
						'Cyclage : installation des bactéries qui transforment l’ammoniac en nitrates.',
						'Ammoniac (NH3/NH4) : déchet très toxique des poissons.',
						'Nitrites (NO2) : produit intermédiaire toxique.',
						'Nitrates (NO3) : produit final, peu toxique à faible dose.',
						'Bac mûr : bac cyclé, stable, avec une flore bactérienne établie.',
						'Matériau de filtration : mousse, céramique, support des bactéries.'
					]
				},
				{
					h: 'Poissons et comportements',
					list: [
						'Mbuna : cichlidés rocheux du lac Malawi, herbivores et territoriaux.',
						'Peacock : cichlidés de sable du Malawi, plus calmes.',
						'Incubateur buccal : poisson qui garde ses œufs dans sa bouche.',
						'Vivipare : poisson qui met bas des alevins formés.',
						'Ovipare : poisson qui pond des œufs.',
						'Banc : groupe de poissons qui nagent ensemble.',
						'Territorial : qui défend un espace contre les autres.',
						'Quarantaine : isolement d’un poisson avant de le mettre dans le bac principal.'
					]
				},
				{
					h: 'Plantes et décor',
					list: [
						'Rhizome : tige souterraine épaisse (anubias, fougères), qui ne s’enterre pas.',
						'Stolon : tige rampante qui produit de nouvelles plantes.',
						'Tapis : plantes basses qui couvrent le sol.',
						'Hardscape : éléments durs du décor (roches, bois).',
						'CO₂ : gaz carbonique dissous, qui stimule la croissance des plantes.',
						'Biotope : reconstitution d’un milieu naturel précis.',
						'Aquascape : composition esthétique de plantes et de décor.'
					]
				}
			],
			related: ['demarrer/parametres']
		}
	]
};

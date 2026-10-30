import type { Theme } from './types';

export const VIVRE: Theme = {
	slug: 'vivre',
	title: 'Vie du bac',
	summary: 'Nourrir, faire cohabiter, reproduire : le quotidien des habitants.',
	icon: 'fish',
	color: 'var(--indigo)',
	guides: [
		{
			slug: 'nourrir',
			title: 'Bien nourrir ses poissons',
			summary: 'Quantité, fréquence, variété : la suralimentation est la première cause de pollution.',
			level: 'debutant',
			minutes: 4,
			blocks: [
				{
					h: 'Les règles de base',
					list: [
						'Une à deux fois par jour, en quantité mangée en deux minutes.',
						'Un jour de jeûne par semaine est bénéfique pour la plupart des poissons adultes.',
						'Retire ce qui reste au bout de cinq minutes.',
						'Varie : flocons, granulés, surgelé, vivant, légumes selon l’espèce.'
					]
				},
				{
					h: 'Selon le régime',
					list: [
						'Carnivores : granulés riches en protéines, vers, crevettes, surgelé.',
						'Herbivores : spiruline, légumes verts blanchis (courgette, concombre, épinards).',
						'Omnivores : mélange des deux.',
						'Poissons de fond : granulés qui coulent.',
						'Poissons de surface : flocons et petits granulés flottants.'
					]
				},
				{
					h: 'Signes de suralimentation',
					list: ['Eau trouble, nitrates élevés, algues.', 'Restes sur le sol.', 'Poissons au ventre gonflé.']
				},
				{ tip: 'Dans l’app, le suivi du nourrissage te montre qui a nourri et à quelle heure, utile à plusieurs dans la maison.' }
			],
			related: ['sante/vessie-natatoire', 'entretien/routine']
		},
		{
			slug: 'cohabitation',
			title: 'Faire cohabiter les espèces',
			summary: 'Taille, tempérament, zone de nage et paramètres d’eau : les quatre critères.',
			level: 'debutant',
			minutes: 5,
			blocks: [
				{
					h: 'Les quatre critères',
					list: [
						'Paramètres d’eau : température, pH et dureté doivent se recouper.',
						'Taille : un poisson avale tout ce qui tient dans sa bouche.',
						'Tempérament : évite de mélanger des poissons paisibles avec des mordilleurs ou des territoriaux.',
						'Zone de nage : répartis les espèces entre surface, milieu et fond.'
					]
				},
				{
					h: 'Le groupe',
					p: ['Beaucoup de poissons vivent en banc dans la nature. En petit nombre, ils sont stressés ou agressifs. Respecte le groupe minimal indiqué dans la fiche d’espèce.']
				},
				{
					h: 'Les pièges classiques',
					list: [
						'Poissons à longs voiles (combattants, scalaires, guppys) avec des barbus ou des tétras mordilleurs.',
						'Cichlidés africains avec des poissons américains : paramètres incompatibles.',
						'Plusieurs mâles de la même espèce territoriale dans un petit bac.',
						'Poissons nocturnes qui ne mangent pas parce que les autres ont tout pris.'
					]
				},
				{ tip: 'Le simulateur de peuplement de l’app te prévient des incompatibilités avant l’achat.' }
			],
			related: ['vivre/charge-biologique', 'sante/prevenir']
		},
		{
			slug: 'charge-biologique',
			title: 'La charge biologique',
			summary: 'Combien de poissons un bac peut-il supporter ? Pourquoi « 1 cm par litre » ne suffit pas.',
			level: 'intermediaire',
			minutes: 4,
			blocks: [
				{
					p: ['La règle « 1 cm de poisson par litre » est trop simpliste : un poisson de 10 cm est bien plus lourd et produit bien plus de déchets que dix poissons de 1 cm. Ce qui compte, c’est la masse du poisson adulte, son activité et son régime.']
				},
				{
					h: 'Facteurs à prendre en compte',
					list: ['Taille adulte et corpulence.', 'Alimentation (les carnivores salissent plus).', 'Filtration et surface d’échange à la surface.', 'Plantes (elles consomment les nitrates).', 'Fréquence des changements d’eau.']
				},
				{ tip: 'La page peuplement de ton bac calcule une charge biologique estimée et te signale quand elle devient limite.' },
				{ warn: 'Compte toujours la taille adulte, pas celle du poisson au moment de l’achat.' }
			],
			related: ['vivre/cohabitation']
		},
		{
			slug: 'reproduction',
			title: 'La reproduction des poissons d’aquarium',
			summary: 'Vivipares, pondeurs, incubateurs buccaux : trois grandes stratégies.',
			level: 'intermediaire',
			minutes: 5,
			blocks: [
				{
					h: 'Les vivipares (guppys, platys, mollys)',
					p: ['Ils mettent bas des alevins formés. Une grosse touffe de plantes ou de mousse protège les petits des adultes. Ils se reproduisent très facilement : prévois d’en placer une partie.']
				},
				{
					h: 'Les pondeurs sur plantes (tétras, barbus, danios)',
					p: ['Ils éparpillent leurs œufs sans les garder. Retire les adultes ou protège les œufs sous une grille. Les alevins demandent une nourriture microscopique.']
				},
				{
					h: 'Les pondeurs de substrat (corydoras, nombreux cichlidés)',
					p: ['Ils pondent sur une feuille, une pierre ou dans une grotte, et souvent gardent les œufs. Les cichlidés nains sont des parents attentifs.']
				},
				{
					h: 'Les incubateurs buccaux (cichlidés africains)',
					p: ['La femelle (ou le mâle) garde les œufs dans la bouche pendant plusieurs semaines. Ne dérange pas une femelle qui jeûne.']
				},
				{
					h: 'Les poissons à nid de bulles (combattants, gouramis)',
					p: ['Le mâle construit un nid à la surface et le garde. Retire la femelle après la ponte.']
				},
				{ tip: 'Prévois à l’avance un bac d’élevage ou une pouponnière : les jeunes alevins sont mangés dans un bac de communauté.' }
			],
			related: ['vivre/nourrir']
		},
		{
			slug: 'crevettes-escargots',
			title: 'Crevettes et escargots',
			summary: 'Invertébrés d’eau douce : utiles, discrets, mais sensibles.',
			level: 'intermediaire',
			minutes: 4,
			blocks: [
				{
					h: 'Les crevettes',
					list: [
						'Bac mûr (au moins 2 à 3 mois), eau stable, sans cuivre.',
						'Acclimatation lente, goutte à goutte, sur une heure.',
						'Mousses et plantes denses pour les jeunes.',
						'Pas de poissons capables de les avaler (cichlidés, loches).'
					]
				},
				{
					h: 'Les escargots',
					list: [
						'Les néritines nettoient les algues mais ne se reproduisent pas en eau douce.',
						'Les planorbes et les physes se multiplient vite si on suralimente.',
						'L’escargot assassin réduit les populations d’escargots.',
						'Une coquille érodée signale une eau trop douce ou acide.'
					]
				},
				{ warn: 'Beaucoup de traitements contre les parasites ou les algues, et les engrais contenant du cuivre, tuent crevettes et escargots.' }
			],
			related: ['sante/pharmacie']
		}
	]
};

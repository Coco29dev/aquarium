import type { RawIdea } from '$lib/domain/ideas';

// Grands bacs d'eau douce : 250 L et plus. Les poissons vedettes sont des adultes de belle taille.

export const IDEAS_GRAND: RawIdea[] = [
	{
		slug: 'discus-amazonie',
		title: 'Discus : le roi de l’Amazonie',
		summary: 'Un groupe de discus, un grand banc de tétras rhodostomus et des corydoras, en eau tiède et très douce.',
		region: 'Amazonie',
		water: 'plantee',
		volume: [300, 500],
		ref: 350,
		level: 3,
		tags: ['discus', 'amazonie', 'banc', 'exigeant'],
		conditions: { temp: [27, 30], ph: [5.5, 6.8], dgh: [1, 6] },
		decor: 'Racines, sable fin, plantes à feuilles larges, éclairage doux. Eau osmosée, très propre : un changement d’eau important chaque semaine.',
		stock: [
			['Symphysodon aequifasciatus', 6, 'vedette', 5, 8],
			['Hemigrammus rhodostomus', 20, 'banc', 12],
			['Corydoras sterbai', 8, 'fond', 6],
			['Ancistrus triradiatus', 2, 'nettoyeur', 1, 3]
		],
		tip: 'Les discus aiment vivre en groupe de cinq ou six au moins : seuls, ils s’étiolent.',
		warn: 'Eau stable à 28 °C, très propre. Les discus sont sensibles aux maladies : un bac mûr et une bonne hygiène font la différence.',
		guide: 'biotopes/amazonie-eaux-noires'
	},
	{
		slug: 'geophages-et-tetras',
		title: 'Géophages nains et grand banc',
		summary: 'Des géophages qui filtrent le sable en continu, accompagnés d’un grand banc de tétras et de corydoras.',
		region: 'Amazonie',
		water: 'plantee',
		volume: [200, 350],
		ref: 250,
		level: 2,
		tags: ['cichlidés', 'amazonie', 'sable', 'banc'],
		conditions: { temp: [24, 28], ph: [5.8, 7.2], dgh: [2, 10] },
		decor: 'Épaisse couche de sable fin que les géophages filtrent toute la journée, racines, quelques roches. Plantes à racines solides.',
		stock: [
			['Biotodoma cupido', 3, 'vedette', 2, 4],
			['Hemigrammus bleheri', 25, 'banc', 12],
			['Corydoras aeneus', 10, 'fond', 6],
			['Panaqolus maccus', 2, 'nettoyeur', 1, 3]
		],
		tip: 'Du sable fin et propre : les géophages filtrent chaque grain et les graviers pointus les blessent.'
	},
	{
		slug: 'malawi-mbuna',
		title: 'Malawi : mur de mbuna',
		summary: 'Un grand bac rocheux surpeuplé de mbuna colorés : jaune, bleu, orange, noir.',
		region: 'Lac Malawi',
		water: 'douce',
		volume: [300, 500],
		ref: 350,
		level: 2,
		dense: 2,
		tags: ['cichlidés', 'malawi', 'colorés', 'eau dure'],
		conditions: { temp: [24, 28], ph: [7.6, 8.6], dgh: [8, 20] },
		decor: 'Un grand mur de roches avec des grottes, sable, pas de plantes (hormis anubias). Filtration puissante et changements d’eau fréquents.',
		stock: [
			['Labidochromis caeruleus', 6, 'banc', 5],
			['Maylandia estherae', 6, 'banc', 5],
			['Pseudotropheus socolofi', 6, 'banc', 5],
			['Cynotilapia afra', 6, 'banc', 5],
			['Synodontis petricola', 2, 'fond', 1, 3]
		],
		tip: 'Mieux vaut un bac trop peuplé qu’un bac clairsemé : la hargne se répartit entre nombreux poissons.',
		warn: 'Les mbuna sont territoriaux. Pas d’espèces trop paisibles avec eux, et jamais deux mâles de la même couleur.',
		guide: 'biotopes/lac-malawi'
	},
	{
		slug: 'malawi-peacocks',
		title: 'Malawi : peacocks et haplochromis',
		summary: 'Des poissons du sable, plus calmes que les mbuna : reflets bleus, rouges et jaunes.',
		region: 'Lac Malawi',
		water: 'douce',
		volume: [400, 700],
		ref: 500,
		level: 2,
		dense: 2,
		tags: ['cichlidés', 'malawi', 'colorés', 'eau dure'],
		conditions: { temp: [24, 28], ph: [7.6, 8.6], dgh: [8, 20] },
		decor: 'Vaste sable, quelques roches isolées, de la place pour nager. Les mâles défendent un petit territoire pour parader.',
		stock: [
			['Aulonocara stuartgranti', 5, 'vedette', 3, 8],
			['Aulonocara jacobfreibergi', 4, 'vedette', 3, 6],
			['Copadichromis borleyi', 6, 'banc', 4],
			['Sciaenochromis fryeri', 3, 'vedette', 2, 4],
			['Placidochromis electra', 4, 'vedette', 3, 5]
		],
		tip: 'Un mâle pour trois ou quatre femelles : sans femelles, les mâles s’épuisent à se battre entre eux.',
		guide: 'biotopes/lac-malawi'
	},
	{
		slug: 'malawi-predateurs',
		title: 'Malawi : prédateurs de rivage',
		summary: 'De grands cichlidés qui chassent à l’affût : un bac impressionnant, à observer plus qu’à toucher.',
		region: 'Lac Malawi',
		water: 'douce',
		volume: [1000, 1800],
		ref: 1200,
		level: 3,
		dense: 2,
		tags: ['cichlidés', 'malawi', 'grande taille', 'prédateurs'],
		conditions: { temp: [24, 28], ph: [7.6, 8.6], dgh: [8, 20] },
		decor: 'Grand bac long (180 cm ou plus), sable, grandes roches et quelques recoins. Aucun petit poisson.',
		stock: [
			['Nimbochromis venustus', 3, 'vedette', 2, 4],
			['Nimbochromis livingstonii', 2, 'vedette', 2, 3],
			['Cyrtocara moorii', 2, 'vedette', 2, 3],
			['Dimidiochromis compressiceps', 2, 'vedette', 2, 3]
		],
		warn: 'Ces poissons dépassent 25 cm et avalent tout ce qui est plus petit. À réserver aux bacs de 450 L et plus.'
	},
	{
		slug: 'tanganyika-pelagique',
		title: 'Tanganyika : bancs pélagiques',
		summary: 'Des nuées de Cyprichromis au-dessus des roches, avec des poissons de rivage et un synodontis.',
		region: 'Lac Tanganyika',
		water: 'douce',
		volume: [400, 650],
		ref: 450,
		level: 2,
		dense: 2,
		tags: ['cichlidés', 'tanganyika', 'banc', 'colorés'],
		conditions: { temp: [24, 27], ph: [7.8, 9.0], dgh: [10, 20] },
		decor: 'Grands blocs de roche à une extrémité, sable, grand volume libre au-dessus. Eau dure et alcaline.',
		stock: [
			['Cyprichromis leptosoma', 14, 'banc', 10],
			['Paracyprichromis nigripinnis', 10, 'banc', 8],
			['Neolamprologus leleupi', 3, 'fond', 2, 5],
			['Synodontis petricola', 3, 'fond', 1, 4]
		],
		tip: 'Plus le banc de Cyprichromis est nombreux, plus il évolue en pleine eau : vise 15 ou plus.',
		guide: 'biotopes/lac-tanganyika'
	},
	{
		slug: 'tropheus-bac-dedie',
		title: 'Tropheus : un bac de caractère',
		summary: 'Un grand groupe de Tropheus moorii, brouteurs de rochers, réputés pour leurs couleurs.',
		region: 'Lac Tanganyika',
		water: 'douce',
		volume: [350, 600],
		ref: 400,
		level: 3,
		dense: 2,
		tags: ['cichlidés', 'tanganyika', 'exigeant', 'colorés'],
		conditions: { temp: [24, 27], ph: [7.8, 9.0], dgh: [10, 20] },
		decor: 'Roches formant des tunnels, peu de sable, éclairage fort (pour les algues qu’ils broutent). Eau dure, très oxygénée.',
		stock: [
			['Tropheus moorii', 18, 'banc', 12],
			['Synodontis petricola', 2, 'fond', 1, 3]
		],
		tip: 'Un groupe d’une quinzaine répartit l’agressivité. Régime à base d’algues, très peu de protéines.',
		warn: 'Ils craignent les maladies intestinales : pas de nourriture riche en protéines, quarantaine stricte.',
		guide: 'biotopes/lac-tanganyika'
	},
	{
		slug: 'afrique-curiosites',
		title: 'Afrique : curiosités et prédateurs doux',
		summary: 'Un poisson-papillon d’eau douce, un poisson-éléphant et un banc de tétras du Congo.',
		region: 'Afrique de l’Ouest et centrale',
		water: 'plantee',
		volume: [450, 800],
		ref: 550,
		level: 3,
		tags: ['insolite', 'afrique', 'grande taille'],
		conditions: { temp: [24, 28], ph: [6.0, 7.5], dgh: [3, 12] },
		decor: 'Bac long, sable fin, racines, plantes flottantes (le poisson-papillon aime la surface), couvercle hermétique.',
		stock: [
			['Gnathonemus petersii', 3, 'vedette', 3, 4],
			['Pantodon buchholzi', 1, 'vedette', 1, 2],
			['Phenacogrammus interruptus', 10, 'banc', 8],
			['Synodontis nigriventris', 3, 'fond', 1, 4]
		],
		tip: 'Le poisson-éléphant cherche sa nourriture avec son organe électrique : donne-lui du vivant ou du surgelé la nuit.',
		warn: 'Le poisson-papillon avale les poissons de moins de 3 cm. Garde des voisins plus gros, et ferme bien le couvercle.'
	},
	{
		slug: 'amazonie-geante',
		title: 'Amazonie géante : scalaires altum et uaru',
		summary: 'Un grand bac d’Amazonie avec scalaires altum, uaru et un banc de tétras rhodostomus.',
		region: 'Amazonie',
		water: 'plantee',
		volume: [500, 800],
		ref: 600,
		level: 3,
		tags: ['amazonie', 'grande taille', 'exigeant', 'cichlidés'],
		conditions: { temp: [27, 30], ph: [5.0, 6.8], dgh: [1, 5] },
		decor: 'Bac profond (60 cm ou plus), grands troncs, plantes flottantes, eau très douce et acide.',
		stock: [
			['Pterophyllum altum', 4, 'vedette', 3, 6],
			['Hemigrammus rhodostomus', 25, 'banc', 15],
			['Corydoras sterbai', 10, 'fond', 6],
			['Panaqolus maccus', 2, 'nettoyeur', 1, 3]
		],
		warn: 'Scalaires altum et uaru sont exigeants en qualité d’eau et en patience. Réserve ce bac à quelqu’un d’expérimenté.',
		guide: 'biotopes/amazonie-eaux-noires'
	}
];

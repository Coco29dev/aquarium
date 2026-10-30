import type { Idea } from '$lib/domain/ideas';

// Nano et petits bacs : jusqu'à environ 120 L. Les quantités sont écrites pour `ref` litres et s'adaptent au volume.

export const IDEAS_NANO_PETIT: Idea[] = [
	{
		slug: 'betta-solo',
		title: 'Betta en solitaire',
		summary: 'Un seul mâle betta dans un petit bac planté, avec des escargots qui travaillent le sol.',
		region: 'Asie du Sud-Est',
		water: 'plantee',
		volume: [20, 40],
		ref: 30,
		level: 1,
		tags: ['nano', 'betta', 'plantes', 'débutant'],
		conditions: { temp: [24, 28], ph: [6.0, 7.5], dgh: [2, 10] },
		decor: 'Chauffage réglable, filtre à débit très faible (éponge), plantes flottantes et grandes feuilles où se reposer. Couvercle : le betta respire en surface.',
		plants: ['Anubias barteri', 'Microsorum pteropus', 'Limnobium laevigatum', 'Cryptocoryne parva'],
		stock: [
			['Betta splendens', 1, 'vedette', 1, 1],
			['Neritina natalensis', 1, 'invertebre', 1, 2],
			['Melanoides tuberculata', 3, 'invertebre', 2, 6]
		],
		tip: 'Un betta aime un bac stable et chaud : 25 à 27 °C, jamais un bocal sans chauffage ni filtre.',
		warn: 'Un seul mâle par bac. Aucun poisson à longues nageoires ou très coloré avec lui.'
	},
	{
		slug: 'micro-rasboras',
		title: 'Micro-rasboras',
		summary: 'Des Boraras de 2 cm, minuscules et brillants, en banc dans un petit bac sombre.',
		region: 'Asie du Sud-Est',
		water: 'plantee',
		volume: [20, 50],
		ref: 30,
		level: 2,
		tags: ['nano', 'banc', 'plantes', 'colorés'],
		conditions: { temp: [22, 27], ph: [5.5, 7.2], dgh: [2, 8] },
		decor: 'Sol sombre, plantes à petites feuilles, mousses, plantes flottantes pour tamiser la lumière. Filtre très doux.',
		plants: ['Cryptocoryne parva', 'Vesicularia dubyana', 'Bucephalandra motleyana', 'Salvinia minima'],
		stock: [
			['Boraras urophthalmoides', 12, 'banc', 8],
			['Neocaridina davidi', 6, 'invertebre', 6, 15]
		],
		tip: 'Ces poissons très petits ne mangent que de la nourriture minuscule : micro-granulés, artémias nauplii.'
	},
	{
		slug: 'poissons-moustiques',
		title: 'Poissons-moustiques',
		summary: 'Heterandria formosa, le plus petit vivipare du monde, dans un bac tout en plantes flottantes.',
		region: 'Sud-Est des États-Unis',
		water: 'plantee',
		volume: [20, 50],
		ref: 30,
		level: 1,
		tags: ['nano', 'vivipares', 'sans chauffage', 'débutant'],
		conditions: { temp: [18, 27], ph: [7.0, 8.0], dgh: [8, 18] },
		decor: 'Beaucoup de plantes flottantes et de mousses : les jeunes s’y cachent. Peu de courant. Il supporte le frais.',
		plants: ['Ceratophyllum demersum', 'Vesicularia dubyana', 'Najas guadalupensis', 'Lemna minor'],
		stock: [
			['Heterandria formosa', 8, 'banc', 5],
			['Planorbarius corneus', 2, 'invertebre', 1, 4]
		],
		tip: 'Les femelles mettent bas quelques jeunes à la fois, jour après jour, sans épuiser le bac.'
	},
	{
		slug: 'crevettes-crystal',
		title: 'Crevettes crystal',
		summary: 'Des crevettes rouges et blanches très prisées, qui demandent une eau douce et acide : un bac de passionné.',
		region: 'Chine, Taïwan',
		water: 'plantee',
		volume: [20, 40],
		ref: 25,
		level: 3,
		tags: ['nano', 'crevettes', 'sans poisson', 'exigeant'],
		conditions: { temp: [20, 24], ph: [5.5, 7.0], dgh: [3, 6] },
		decor: 'Sol actif acide, eau osmosée reminéralisée, mousses et bois. Température fraîche, bac mûr plusieurs mois avant l’arrivée.',
		plants: ['Vesicularia dubyana', 'Fissidens fontanus', 'Cryptocoryne parva', 'Bucephalandra motleyana'],
		stock: [['Caridina cantonensis', 10, 'invertebre', 6, 20]],
		tip: 'Ces crevettes mesurent leur confort au dixième de pH : un TDS-mètre aide à régler l’eau.',
		warn: 'Ne les mélange pas avec les Neocaridina : les deux se croisent et perdent leurs couleurs.'
	},
	{
		slug: 'killi-annuel',
		title: 'Killi annuel',
		summary: 'Un trio de Nothobranchius, aux couleurs saturées, dont la vie ne dure qu’une saison.',
		region: 'Afrique orientale',
		water: 'plantee',
		volume: [20, 40],
		ref: 25,
		level: 3,
		tags: ['nano', 'insolite', 'colorés', 'exigeant'],
		conditions: { temp: [22, 26], ph: [6.5, 7.5], dgh: [2, 8] },
		decor: 'Petite tourbe au fond pour la ponte, plantes flottantes, couvercle serré. Un mâle pour deux femelles.',
		plants: ['Ceratopteris cornuta', 'Najas guadalupensis', 'Salvinia natans'],
		stock: [['Nothobranchius furzeri', 3, 'vedette', 3, 3]],
		tip: 'Les œufs passent la saison sèche dans la tourbe humide, puis éclosent à la remise en eau : un cycle fascinant.',
		warn: 'Sa vie dépasse rarement un an en aquarium. Réserve-le à quelqu’un qui aime l’élevage et l’éclosion des œufs.'
	},
	{
		slug: 'amazonie-nano',
		title: 'Amazonie en 40 litres',
		summary: 'Des tétras de 2 cm, des corydoras nains et des crevettes dans un petit coin d’Amazonie.',
		region: 'Amazonie',
		water: 'plantee',
		volume: [30, 70],
		ref: 40,
		level: 2,
		tags: ['nano', 'banc', 'amazonie', 'paisible'],
		conditions: { temp: [23, 27], ph: [5.5, 7.0], dgh: [2, 8] },
		decor: 'Sable fin, un morceau de racine, feuilles mortes et plantes à petites feuilles. Lumière douce.',
		plants: ['Echinodorus tenellus', 'Cryptocoryne parva', 'Hygrophila difformis', 'Salvinia minima'],
		stock: [
			['Hyphessobrycon amandae', 12, 'banc', 8],
			['Corydoras hastatus', 8, 'fond', 8],
			['Neocaridina davidi', 6, 'invertebre', 6, 12]
		],
		tip: 'Les tétras « feu » (Hyphessobrycon amandae) rougissent à mesure qu’ils prennent confiance : un bac calme les fait ressortir.'
	},
	{
		slug: 'gouramis-de-poche',
		title: 'Gouramis de poche',
		summary: 'Un couple de Parosphromenus, de minuscules gouramis d’eaux noires, et des micro-rasboras rouges.',
		region: 'Asie du Sud-Est',
		water: 'plantee',
		volume: [30, 60],
		ref: 40,
		level: 3,
		tags: ['nano', 'eaux noires', 'exigeant', 'insolite'],
		conditions: { temp: [22, 26], ph: [4.5, 6.2], dgh: [1, 4] },
		decor: 'Eau osmosée, feuilles d’amandier et tourbe, cachettes en grottes minuscules (petits pots, tubes). Très peu de lumière.',
		plants: ['Cryptocoryne parva', 'Vesicularia dubyana', 'Salvinia minima'],
		stock: [
			['Parosphromenus deissneri', 2, 'vedette', 2, 2],
			['Boraras merah', 10, 'banc', 8]
		],
		tip: 'Le mâle construit un nid dans une cachette étroite : prévois plusieurs grottes minuscules.',
		warn: 'Une eau trop dure ou trop chaude affaiblit ces poissons : c’est un bac pour amateur confirmé.',
		guide: 'biotopes/asie-tourbieres'
	},
	{
		slug: 'jardin-de-crevettes',
		title: 'Jardin de crevettes',
		summary: 'Une colonie de crevettes cerises dans la mousse et les plantes : un bac à observer de près.',
		region: 'Taïwan et Chine',
		water: 'plantee',
		volume: [20, 50],
		ref: 30,
		level: 1,
		tags: ['nano', 'crevettes', 'sans poisson', 'plantes'],
		conditions: { temp: [20, 25], ph: [6.8, 7.8], dgh: [6, 12] },
		decor: 'Sol fin, bois et pierres couverts de mousses, beaucoup de plantes pour cacher les jeunes. Filtre à mousse : pas d’aspiration pour les bébés.',
		plants: ['Vesicularia dubyana', 'Microsorum pteropus', 'Anubias barteri', 'Cryptocoryne parva', 'Fissidens fontanus'],
		stock: [
			['Neocaridina davidi', 12, 'invertebre', 6],
			['Neritina natalensis', 2, 'invertebre', 1, 3]
		],
		tip: 'Une dizaine de crevettes bien installées deviennent vite une centaine : n’en mets pas trop au départ.',
		warn: 'Aucun poisson, même petit : les bébés crevettes disparaissent. Pas de cuivre ni d’engrais pour plantes d’intérieur.'
	},
	{
		slug: 'betta-et-ses-voisins',
		title: 'Betta et ses voisins tranquilles',
		summary: 'Un mâle betta, un petit groupe de corydoras nains et quelques invertébrés dans un bac planté.',
		region: 'Asie du Sud-Est',
		water: 'plantee',
		volume: [30, 80],
		ref: 60,
		level: 1,
		tags: ['nano', 'betta', 'plantes', 'débutant'],
		conditions: { temp: [24, 27], ph: [6.0, 7.5], dgh: [2, 10] },
		decor: 'Plantes flottantes pour casser la lumière, feuilles larges en surface, courant faible. Le betta aime les racines et les feuilles où se poser.',
		plants: ['Anubias barteri', 'Cryptocoryne wendtii', 'Microsorum pteropus', 'Limnobium laevigatum', 'Ceratopteris thalictroides'],
		stock: [
			['Betta splendens', 1, 'vedette', 1, 1],
			['Corydoras pygmaeus', 8, 'fond', 6],
			['Neocaridina davidi', 8, 'invertebre', 4, 20],
			['Neritina natalensis', 2, 'invertebre', 1, 3]
		],
		tip: 'Chaque betta a son caractère : si le tien chasse les crevettes, retire-les et garde les corydoras.',
		warn: 'Un seul betta mâle par bac. Pas de poissons à longues nageoires ni de guppys avec lui.'
	},
	{
		slug: 'tourbiere-miniature',
		title: 'Tourbière miniature',
		summary: 'Des Boraras rouge et ambre dans une eau teintée par les feuilles : un banc minuscule très coloré.',
		region: 'Asie du Sud-Est',
		water: 'plantee',
		volume: [25, 80],
		ref: 50,
		level: 2,
		tags: ['nano', 'banc', 'eaux noires', 'plantes'],
		conditions: { temp: [23, 27], ph: [5.0, 6.8], dgh: [1, 6] },
		decor: 'Feuilles d’amandier ou de chêne, racines, sol sombre, lumière douce. Eau tendre et acide ; filtre doux.',
		plants: ['Cryptocoryne wendtii', 'Bucephalandra motleyana', 'Vesicularia dubyana', 'Salvinia minima'],
		stock: [
			['Boraras brigittae', 14, 'banc', 10],
			['Caridina babaulti', 6, 'invertebre', 4, 15]
		],
		tip: 'Plus le banc est nombreux, plus les Boraras sortent. Une quinzaine dans 50 L est un bon départ.',
		guide: 'biotopes/asie-tourbieres'
	},
	{
		slug: 'galaxy-dans-son-ruisseau',
		title: 'Galaxy dans son ruisseau',
		summary: 'Les célèbres « galaxy » (Danio margaritatus) : de minuscules poissons perlés qui adorent un banc dense.',
		region: 'Myanmar',
		water: 'plantee',
		volume: [40, 90],
		ref: 50,
		level: 2,
		tags: ['nano', 'banc', 'plantes', 'colorés'],
		conditions: { temp: [22, 26], ph: [6.5, 7.8], dgh: [5, 12] },
		decor: 'Bac très planté, plantes à petites feuilles, cachettes dans les mousses. Sol sombre pour faire ressortir les couleurs.',
		plants: ['Hygrophila pinnatifida', 'Micranthemum tweediei', 'Vesicularia dubyana', 'Cryptocoryne parva'],
		stock: [
			['Danio margaritatus', 12, 'banc', 8],
			['Neritina natalensis', 2, 'invertebre', 1, 3],
			['Neocaridina davidi', 8, 'invertebre', 4, 20]
		],
		tip: 'Les mâles se disputent des « galaxies » sans se blesser : un banc de 10 ou plus répartit les parades.'
	},
	{
		slug: 'poissons-des-rizieres',
		title: 'Poissons des rizières',
		summary: 'Le medaka japonais (Oryzias latipes) supporte l’eau fraîche et se passe de chauffage : un bac sans contrainte.',
		region: 'Japon',
		water: 'plantee',
		volume: [40, 100],
		ref: 60,
		level: 1,
		tags: ['nano', 'sans chauffage', 'banc', 'débutant'],
		conditions: { temp: [16, 26], ph: [6.5, 8.0], dgh: [5, 15] },
		decor: 'Plantes flottantes et plantes à tiges où les œufs s’accrochent, courant très doux. Un grand bocal planté suffit.',
		plants: ['Ceratophyllum demersum', 'Hygrophila difformis', 'Vallisneria spiralis', 'Salvinia natans'],
		stock: [
			['Oryzias latipes', 10, 'banc', 6],
			['Neocaridina davidi', 8, 'invertebre', 4, 20]
		],
		tip: 'Les medakas se reproduisent facilement : les œufs sont portés par la femelle puis déposés sur les plantes.'
	},
	{
		slug: 'endlers-et-crevettes',
		title: 'Endlers et crevettes',
		summary: 'Des guppys d’Endler multicolores qui se reproduisent seuls, avec des crevettes pour nettoyer.',
		region: 'Venezuela',
		water: 'plantee',
		volume: [20, 70],
		ref: 40,
		level: 1,
		tags: ['nano', 'vivipares', 'colorés', 'débutant'],
		conditions: { temp: [22, 27], ph: [7.0, 8.0], dgh: [8, 18] },
		decor: 'Bac bien planté, mousses pour les alevins, eau plutôt dure. Aucune cachette obligatoire, mais elles sauvent des jeunes.',
		plants: ['Ceratophyllum demersum', 'Vesicularia dubyana', 'Najas guadalupensis', 'Hygrophila difformis'],
		stock: [
			['Poecilia wingei', 10, 'banc', 6],
			['Neocaridina davidi', 8, 'invertebre', 4, 20],
			['Neritina natalensis', 2, 'invertebre', 1, 3]
		],
		tip: 'Pour éviter une explosion de population, garde surtout des mâles, ou prévois un second bac pour les jeunes.'
	},
	{
		slug: 'nano-australie',
		title: 'Nano australien',
		summary: 'Le poisson arc-en-ciel nain Pseudomugil gertrudae : des yeux bleus, des nageoires dorées, un banc tout en finesse.',
		region: 'Australie, Nouvelle-Guinée',
		water: 'plantee',
		volume: [40, 90],
		ref: 60,
		level: 2,
		tags: ['nano', 'banc', 'colorés', 'plantes'],
		conditions: { temp: [22, 28], ph: [6.5, 7.8], dgh: [6, 14] },
		decor: 'Plantes à tiges et mousses sur les bords, lumière modérée, courant calme. Un couvercle est indispensable : ils sautent.',
		plants: ['Vallisneria spiralis', 'Cryptocoryne wendtii', 'Vesicularia dubyana', 'Hygrophila corymbosa'],
		stock: [
			['Pseudomugil gertrudae', 10, 'banc', 6],
			['Neritina natalensis', 2, 'invertebre', 1, 3]
		],
		tip: 'Les mâles se mettent en scène devant les femelles : un banc d’une dizaine donne le meilleur spectacle.',
		guide: 'biotopes/australasie'
	},
	{
		slug: 'neons-verts-et-corydoras-nains',
		title: 'Néons verts et corydoras nains',
		summary: 'Un banc de petits tétras et des corydoras minuscules : un bac discret, paisible et très vivant.',
		region: 'Amazonie',
		water: 'plantee',
		volume: [60, 110],
		ref: 70,
		level: 2,
		tags: ['banc', 'amazonie', 'plantes', 'paisible'],
		conditions: { temp: [23, 27], ph: [5.5, 7.0], dgh: [2, 8] },
		decor: 'Sable fin, racines, plantes à feuilles larges et quelques plantes flottantes. Lumière douce.',
		plants: ['Echinodorus tenellus', 'Cryptocoryne wendtii', 'Hygrophila difformis', 'Salvinia minima'],
		stock: [
			['Paracheirodon simulans', 15, 'banc', 10],
			['Corydoras habrosus', 8, 'fond', 6],
			['Otocinclus affinis', 4, 'nettoyeur', 3, 6]
		],
		tip: 'Ajoute les otocinclus dans un bac mûr de plusieurs mois : ils meurent de faim dans un bac trop propre.'
	},
	{
		slug: 'eaux-noires-en-miniature',
		title: 'Eaux noires en miniature',
		summary: 'Néons cardinaux, poissons-hachettes et un trio d’Apistogramma dans une eau teintée de tanins.',
		region: 'Amazonie, Rio Negro',
		water: 'plantee',
		volume: [80, 130],
		ref: 90,
		level: 3,
		tags: ['banc', 'eaux noires', 'amazonie', 'cichlidés nains'],
		conditions: { temp: [25, 28], ph: [4.8, 6.5], dgh: [1, 5] },
		decor: 'Sable clair, racines, feuilles mortes, plantes flottantes. Eau osmosée coupée avec un peu d’eau du robinet pour garder le pH bas.',
		plants: ['Anubias barteri', 'Cryptocoryne wendtii', 'Microsorum pteropus', 'Limnobium laevigatum'],
		stock: [
			['Paracheirodon axelrodi', 15, 'banc', 10],
			['Carnegiella strigata', 8, 'surface', 6],
			['Apistogramma agassizii', 3, 'vedette', 3, 3],
			['Corydoras habrosus', 6, 'fond', 6]
		],
		tip: 'Un trio (un mâle, deux femelles) évite que le mâle épuise une seule femelle.',
		warn: 'Les poissons-hachettes sautent : un couvercle bien fermé est obligatoire. Les néons cardinaux demandent une eau très stable.',
		guide: 'biotopes/amazonie-eaux-noires'
	},
	{
		slug: 'rasboras-et-kuhli',
		title: 'Rasboras et loches kuhli',
		summary: 'Un banc de rasboras arlequin, des loches kuhli sous les feuilles et un couple de gouramis nains.',
		region: 'Asie du Sud-Est',
		water: 'plantee',
		volume: [60, 120],
		ref: 80,
		level: 1,
		tags: ['banc', 'asie', 'plantes', 'débutant', 'paisible'],
		conditions: { temp: [24, 27], ph: [6.0, 7.5], dgh: [2, 10] },
		decor: 'Sable fin pour les loches, plantes à feuilles larges, quelques racines. Lumière douce, plantes flottantes.',
		plants: ['Cryptocoryne wendtii', 'Anubias barteri', 'Echinodorus bleheri', 'Salvinia natans'],
		stock: [
			['Trigonostigma heteromorpha', 14, 'banc', 10],
			['Pangio kuhlii', 6, 'fond', 5],
			['Trichogaster chuna', 2, 'vedette', 2, 2],
			['Neritina natalensis', 2, 'invertebre', 1, 3]
		],
		tip: 'Les loches kuhli sortent surtout au crépuscule. Un sable doux évite d’abîmer leurs barbillons.'
	},
	{
		slug: 'riviere-indienne-petit-bac',
		title: 'Rivière indienne',
		summary: 'Des barbus de Ceylan et un couple de cichlidés orange, dans un décor de galets et de plantes.',
		region: 'Inde du Sud, Sri Lanka',
		water: 'plantee',
		volume: [100, 160],
		ref: 120,
		level: 1,
		tags: ['banc', 'asie', 'paisible', 'plantes'],
		conditions: { temp: [22, 27], ph: [6.5, 7.8], dgh: [4, 12] },
		decor: 'Galets, gravier fin, racines, plantes robustes. Courant modéré.',
		plants: ['Vallisneria spiralis', 'Echinodorus bleheri', 'Cryptocoryne wendtii', 'Microsorum pteropus'],
		stock: [
			['Pethia nigrofasciata', 8, 'banc', 6],
			['Etroplus maculatus', 2, 'vedette', 2, 2],
			['Pangio kuhlii', 5, 'fond', 5]
		],
		tip: 'Le cichlidé orange (Etroplus maculatus) est timide : donne-lui des cachettes et un banc nombreux de voisins calmes.',
		guide: 'biotopes/inde-ghats'
	},
	{
		slug: 'gouramis-nains-et-corydoras',
		title: 'Gouramis nains et corydoras',
		summary: 'Un couple de gouramis miel, des rasboras et des corydoras pour une ambiance posée.',
		region: 'Inde, Asie du Sud',
		water: 'plantee',
		volume: [60, 120],
		ref: 80,
		level: 1,
		tags: ['paisible', 'asie', 'plantes', 'débutant'],
		conditions: { temp: [24, 27], ph: [6.0, 7.5], dgh: [3, 12] },
		decor: 'Végétation dense avec des plantes flottantes : les gouramis nichent sous les feuilles de surface.',
		plants: ['Limnobium laevigatum', 'Hygrophila difformis', 'Cryptocoryne wendtii', 'Vallisneria spiralis'],
		stock: [
			['Trichogaster lalius', 2, 'vedette', 2, 3],
			['Trigonostigma heteromorpha', 12, 'banc', 8],
			['Corydoras panda', 6, 'fond', 6],
			['Neritina natalensis', 2, 'invertebre', 1, 3]
		],
		tip: 'Un seul couple de gouramis (un mâle, une femelle) : deux mâles se battent.'
	},
	{
		slug: 'vivipares-en-bac-plante',
		title: 'Vivipares en bac planté',
		summary: 'Guppys, platys et corydoras : un bac coloré, rustique et facile à vivre pour débuter.',
		region: 'Amérique centrale',
		water: 'plantee',
		volume: [60, 120],
		ref: 80,
		level: 1,
		tags: ['vivipares', 'colorés', 'débutant', 'paisible'],
		conditions: { temp: [22, 27], ph: [7.0, 8.0], dgh: [8, 18] },
		decor: 'Sol clair, beaucoup de plantes denses et de mousses : ce sont les refuges des alevins.',
		plants: ['Ceratophyllum demersum', 'Najas guadalupensis', 'Vallisneria spiralis', 'Hygrophila difformis'],
		stock: [
			['Poecilia reticulata', 8, 'banc', 6],
			['Xiphophorus maculatus', 5, 'banc', 4],
			['Corydoras paleatus', 6, 'fond', 6],
			['Neritina natalensis', 2, 'invertebre', 1, 3]
		],
		tip: 'Les vivipares se multiplient très vite : choisis des mâles seulement, ou prévois que les jeunes aillent ailleurs.',
		warn: 'Pas de poissons qui mordillent les nageoires des guppys (barbus tigrés, par exemple).'
	},
	{
		slug: 'arcs-en-ciel-nains',
		title: 'Arcs-en-ciel nains',
		summary: 'Des poissons arc-en-ciel de Nouvelle-Guinée et un petit gobie à écailles d’or, dans un bac lumineux.',
		region: 'Nouvelle-Guinée, Australie',
		water: 'plantee',
		volume: [100, 160],
		ref: 120,
		level: 2,
		tags: ['banc', 'colorés', 'plantes'],
		conditions: { temp: [23, 27], ph: [6.5, 7.8], dgh: [6, 14] },
		decor: 'Plantes en fond de bac, laissant un grand espace de nage devant. Éclairage vif, quelques racines.',
		plants: ['Vallisneria spiralis', 'Cryptocoryne wendtii', 'Microsorum pteropus', 'Hygrophila corymbosa'],
		stock: [
			['Melanotaenia praecox', 8, 'banc', 6],
			['Iriatherina werneri', 8, 'banc', 6],
			['Tateurndina ocellicauda', 3, 'vedette', 2, 4],
			['Neritina natalensis', 2, 'invertebre', 1, 3]
		],
		tip: 'Les couleurs des arcs-en-ciel s’épanouissent avec l’âge et la lumière : sois patient, les jeunes sont ternes.',
		guide: 'biotopes/australasie'
	},
	{
		slug: 'collection-de-corydoras',
		title: 'Collection de corydoras',
		summary: 'Trois espèces de corydoras sur un sable doux, avec un banc de petits tétras au-dessus.',
		region: 'Amazonie',
		water: 'plantee',
		volume: [80, 130],
		ref: 90,
		level: 1,
		tags: ['fond', 'paisible', 'amazonie', 'débutant'],
		conditions: { temp: [23, 27], ph: [6.0, 7.5], dgh: [3, 10] },
		decor: 'Sable fin, racines, quelques feuilles mortes. Les corydoras ont besoin d’un sol doux pour leurs barbillons.',
		plants: ['Echinodorus bleheri', 'Cryptocoryne wendtii', 'Anubias barteri', 'Limnobium laevigatum'],
		stock: [
			['Corydoras panda', 6, 'fond', 6],
			['Corydoras sterbai', 6, 'fond', 6],
			['Hemigrammus ocellifer', 12, 'banc', 8],
			['Otocinclus affinis', 3, 'nettoyeur', 3, 6]
		],
		tip: 'Chaque espèce de corydoras se tient en groupe de six ou plus : mieux vaut deux espèces bien fournies que quatre en petit nombre.'
	},
	{
		slug: 'eau-fraiche-sans-chauffage',
		title: 'Bac d’eau fraîche sans chauffage',
		summary: 'Des poissons qui aiment 18 à 24 °C : pas de résistance, moins d’électricité.',
		region: 'Chine, Inde',
		water: 'plantee',
		volume: [60, 120],
		ref: 80,
		level: 1,
		tags: ['sans chauffage', 'banc', 'débutant'],
		conditions: { temp: [18, 24], ph: [6.5, 8.0], dgh: [5, 15] },
		decor: 'Bac planté de plantes robustes et rustiques, sol de gravier fin. Il peut même rester dans une pièce non chauffée l’hiver, si elle reste au-dessus de 15 °C.',
		plants: ['Vallisneria spiralis', 'Hygrophila difformis', 'Ceratophyllum demersum', 'Microsorum pteropus'],
		stock: [
			['Tanichthys albonubes', 12, 'banc', 8],
			['Danio rerio', 8, 'banc', 6],
			['Corydoras paleatus', 6, 'fond', 6],
			['Neocaridina davidi', 8, 'invertebre', 4, 20]
		],
		tip: 'Les « White Cloud » et les danios zébrés sont très résistants : parfaits pour un premier bac.'
	},
	{
		slug: 'kribensis-et-tetras-africains',
		title: 'Kribensis et tétras africains',
		summary: 'Un couple de kribensis, un banc de petits poissons africains et un synodontis à l’envers.',
		region: 'Afrique de l’Ouest',
		water: 'plantee',
		volume: [100, 160],
		ref: 120,
		level: 1,
		tags: ['cichlidés', 'afrique', 'paisible', 'plantes'],
		conditions: { temp: [24, 27], ph: [6.0, 7.5], dgh: [3, 12] },
		decor: 'Pots en terre cuite ou noix de coco coupées pour que le couple pose ses œufs, sable, racines, plantes robustes.',
		plants: ['Anubias barteri', 'Bolbitis heudelotii', 'Microsorum pteropus', 'Echinodorus bleheri'],
		stock: [
			['Pelvicachromis pulcher', 2, 'vedette', 2, 2],
			['Poropanchax normani', 8, 'surface', 6],
			['Synodontis nigriventris', 2, 'fond', 1, 3]
		],
		tip: 'Un couple de kribensis garde ses alevins avec ardeur : observe-le, c’est un spectacle.',
		guide: 'biotopes/afrique-ouest-congo'
	},
	{
		slug: 'couple-apistogramma',
		title: 'Apistogramma : un harem coloré',
		summary: 'Un mâle d’Apistogramma cacatuoides, ses femelles, un banc de tétras et des corydoras.',
		region: 'Amazonie',
		water: 'plantee',
		volume: [80, 140],
		ref: 100,
		level: 2,
		tags: ['cichlidés nains', 'amazonie', 'colorés', 'plantes'],
		conditions: { temp: [23, 27], ph: [5.5, 7.2], dgh: [2, 10] },
		decor: 'Sable fin, racines et feuilles mortes, grottes (noix de coco, petits pots). Chaque femelle choisit une grotte.',
		plants: ['Cryptocoryne wendtii', 'Echinodorus bleheri', 'Anubias barteri', 'Limnobium laevigatum'],
		stock: [
			['Apistogramma cacatuoides', 3, 'vedette', 3, 4],
			['Hemigrammus erythrozonus', 10, 'banc', 8],
			['Corydoras sterbai', 6, 'fond', 6],
			['Otocinclus affinis', 3, 'nettoyeur', 3, 5]
		],
		tip: 'Un mâle pour deux ou trois femelles : plusieurs mâles ont besoin d’un bac beaucoup plus grand.'
	}
];

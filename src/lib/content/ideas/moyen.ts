import type { RawIdea } from '$lib/domain/ideas';

// Bacs moyens : environ 100 à 250 L, la taille d'un premier « vrai » aquarium.

export const IDEAS_MOYEN: RawIdea[] = [
	{
		slug: 'killis-ouest-africains',
		title: 'Killis d’Afrique de l’Ouest',
		summary: 'Des petits killis de surface aux couleurs vives, sous un tapis de plantes flottantes.',
		region: 'Afrique de l’Ouest',
		water: 'plantee',
		volume: [60, 120],
		ref: 90,
		level: 2,
		tags: ['killis', 'afrique', 'colorés', 'surface'],
		conditions: { temp: [22, 25], ph: [5.8, 7.2], dgh: [2, 8] },
		decor: 'Bac long, couvercle hermétique, beaucoup de plantes flottantes et de mousses. Éclairage faible, courant presque nul.',
		stock: [
			['Aphyosemion striatum', 5, 'surface', 3, 8],
			['Epiplatys dageti', 4, 'surface', 4, 8],
			['Pangio kuhlii', 5, 'fond', 5]
		],
		tip: 'Les killis aiment la nourriture vivante : artémias, vers de vase surgelés, petits insectes.'
	},
	{
		slug: 'torrent-asiatique',
		title: 'Torrent d’Asie',
		summary: 'Des loches de rivière collées aux galets dans un courant vif, avec un banc de petits cyprinidés.',
		region: 'Vietnam, Chine du Sud',
		water: 'plantee',
		volume: [80, 160],
		ref: 100,
		level: 3,
		tags: ['courant', 'eau fraîche', 'insolite', 'asie'],
		conditions: { temp: [18, 24], ph: [6.5, 7.5], dgh: [4, 10] },
		decor: 'Pompe de brassage, galets et pierres couvertes d’algues, peu de plantes (mousses et anubias fixés). Eau fraîche et très oxygénée.',
		stock: [
			['Sewellia lineolata', 4, 'fond', 3, 6],
			['Tanichthys albonubes', 12, 'banc', 8],
			['Neocaridina davidi', 8, 'invertebre', 6, 15]
		],
		tip: 'Les loches de torrent vivent du biofilm des pierres : laisse les algues se développer sur les galets, c’est leur repas.',
		warn: 'Elles supportent mal la chaleur : au-dessus de 25 °C, elles dépérissent. Prévois un ventilateur en été.'
	},
	{
		slug: 'barbus-de-cuming-et-rasboras',
		title: 'Barbus de Cuming et rasboras',
		summary: 'Deux bancs de petits cyprinidés asiatiques, des loches kuhli et un plateau de plantes denses.',
		region: 'Sri Lanka, Asie du Sud-Est',
		water: 'plantee',
		volume: [100, 180],
		ref: 140,
		level: 1,
		tags: ['banc', 'asie', 'paisible', 'plantes', 'débutant'],
		conditions: { temp: [22, 26], ph: [6.3, 7.5], dgh: [4, 12] },
		decor: 'Plantes denses sur les côtés, espace libre devant, racines, sable fin pour les loches. Lumière moyenne.',
		stock: [
			['Pethia cumingii', 10, 'banc', 6],
			['Rasbora dorsiocellata', 10, 'banc', 8],
			['Pangio kuhlii', 5, 'fond', 5],
			['Neritina natalensis', 2, 'invertebre', 1, 3]
		],
		tip: 'Deux bancs de tailles proches nagent ensemble : on obtient un mouvement permanent dans toute la hauteur du bac.'
	},
	{
		slug: 'tanganyika-juliens',
		title: 'Tanganyika : juliens et compagnons',
		summary: 'Un couple de juliens rayés, des néolamprologus tachetés et une colonie de coquilles : un bac rocheux de taille raisonnable.',
		region: 'Lac Tanganyika',
		water: 'douce',
		volume: [150, 250],
		ref: 180,
		level: 2,
		dense: 2,
		tags: ['cichlidés', 'tanganyika', 'eau dure', 'rochers'],
		conditions: { temp: [24, 27], ph: [7.8, 9.0], dgh: [10, 20] },
		decor: 'Murs de roches avec fentes et plafonds, sable blanc, coquilles d’escargots posées au sol. Éclairage simple, pas de plantes sauf anubias fixés.',
		stock: [
			['Julidochromis dickfeldi', 2, 'vedette', 2, 2],
			['Neolamprologus caudopunctatus', 4, 'fond', 2, 6],
			['Neolamprologus multifasciatus', 8, 'fond', 6, 12]
		],
		tip: 'Le couple de juliens garde ses alevins dans une fente : retire-les ou prévois d’autres cachettes pour éviter les conflits.',
		guide: 'biotopes/lac-tanganyika'
	},
	{
		slug: 'apistogramma-eunotus',
		title: 'Apistogramma eunotus et poissons-crayons',
		summary: 'Un harem d’apistos jaunes, des poissons-crayons en surface et des corydoras au fond.',
		region: 'Amazonie',
		water: 'plantee',
		volume: [100, 180],
		ref: 120,
		level: 2,
		tags: ['cichlidés nains', 'amazonie', 'paisible', 'plantes'],
		conditions: { temp: [23, 27], ph: [5.5, 7.0], dgh: [2, 8] },
		decor: 'Sable fin, racines, feuilles mortes, plusieurs grottes pour les femelles. Plantes flottantes et lumière douce.',
		stock: [
			['Apistogramma eunotus', 3, 'vedette', 3, 4],
			['Nannostomus harrisoni', 10, 'surface', 6],
			['Corydoras nattereri', 6, 'fond', 6]
		],
		tip: 'Les poissons-crayons occupent le haut, les apistos le milieu et les corydoras le sol : chacun sa place.'
	},
	{
		slug: 'amazonie-claire',
		title: 'Amazonie : communauté d’eaux claires',
		summary: 'Néons, tétras, corydoras et un couple de rams : le grand classique, facile et lumineux.',
		region: 'Amazonie',
		water: 'plantee',
		volume: [100, 200],
		ref: 150,
		level: 1,
		tags: ['banc', 'amazonie', 'paisible', 'débutant', 'plantes'],
		conditions: { temp: [24, 27], ph: [6.0, 7.5], dgh: [3, 10] },
		decor: 'Sable ou gravier fin, racines, roches arrondies. Plantes variées : échinodorus, vallisnéries, cryptocorynes. Plantes flottantes pour tamiser.',
		stock: [
			['Paracheirodon innesi', 15, 'banc', 10],
			['Hemigrammus ocellifer', 12, 'banc', 8],
			['Corydoras aeneus', 8, 'fond', 6],
			['Mikrogeophagus ramirezi', 2, 'vedette', 2, 2],
			['Otocinclus affinis', 4, 'nettoyeur', 3, 6]
		],
		tip: 'Cinq espèces, cinq étages de nage : le bac occupe toute la hauteur d’eau sans que personne ne se gêne.',
		guide: 'biotopes/amazonie-eaux-claires'
	},
	{
		slug: 'rio-negro-150',
		title: 'Rio Negro : eaux noires',
		summary: 'Néons cardinaux, rhodostomus, poissons-hachettes et un trio d’Apistogramma dans une eau brune.',
		region: 'Amazonie, Rio Negro',
		water: 'plantee',
		volume: [120, 250],
		ref: 150,
		level: 3,
		tags: ['banc', 'eaux noires', 'amazonie', 'cichlidés nains'],
		conditions: { temp: [25, 29], ph: [4.8, 6.5], dgh: [1, 5] },
		decor: 'Sable clair, racines, feuilles d’amandier ou de chêne. Eau osmosée, très tendre, avec une teinte brune.',
		stock: [
			['Paracheirodon axelrodi', 25, 'banc', 15],
			['Hemigrammus rhodostomus', 12, 'banc', 10],
			['Carnegiella strigata', 8, 'surface', 6],
			['Corydoras adolfoi', 8, 'fond', 6],
			['Apistogramma agassizii', 3, 'vedette', 3, 3]
		],
		tip: 'Plus le banc de néons cardinaux est grand, plus l’effet est saisissant. Vise 25 à 30.',
		warn: 'Les néons cardinaux sont sensibles : eau très douce et stable, introduction lente, pas de grosses variations.',
		guide: 'biotopes/amazonie-eaux-noires'
	},
	{
		slug: 'scalaires-et-grand-banc',
		title: 'Scalaires et grand banc',
		summary: 'Un petit groupe de scalaires qui plane au-dessus d’un grand banc de tétras rouges.',
		region: 'Amazonie',
		water: 'plantee',
		volume: [200, 320],
		ref: 250,
		level: 2,
		tags: ['scalaires', 'amazonie', 'banc', 'plantes hautes'],
		conditions: { temp: [25, 28], ph: [5.8, 7.2], dgh: [2, 10] },
		decor: 'Aquarium haut (50 cm ou plus) avec des plantes hautes et des racines verticales. Sable fin, éclairage tamisé.',
		stock: [
			['Pterophyllum scalare', 3, 'vedette', 2, 6],
			['Hemigrammus bleheri', 20, 'banc', 12],
			['Corydoras sterbai', 8, 'fond', 6],
			['Ancistrus triradiatus', 2, 'nettoyeur', 1, 3]
		],
		tip: 'Choisis des tétras trop gros pour être avalés (Hemigrammus bleheri, 5 cm), et jamais de néons : le scalaire adulte les mange.',
		warn: 'Un scalaire adulte grandit en hauteur : le bac doit faire au moins 50 cm de haut.'
	},
	{
		slug: 'bac-neerlandais',
		title: 'Bac néerlandais coloré',
		summary: 'Un jardin dense de plantes à tiges colorées, avec un banc de petits tétras et des crevettes.',
		region: 'Style néerlandais',
		water: 'plantee',
		volume: [100, 250],
		ref: 150,
		level: 2,
		tags: ['aquascaping', 'plantes', 'banc', 'colorés', 'crevettes'],
		conditions: { temp: [23, 27], ph: [6.0, 7.2], dgh: [3, 8] },
		decor: 'Plantes plantées en rangées, du tapis à l’avant aux grandes plantes à l’arrière. Éclairage fort, CO₂ et engrais conseillés. Entretien régulier (taille).',
		stock: [
			['Hemigrammus erythrozonus', 15, 'banc', 10],
			['Nematobrycon palmeri', 8, 'banc', 6],
			['Corydoras trilineatus', 6, 'fond', 6],
			['Otocinclus affinis', 5, 'nettoyeur', 3, 8],
			['Caridina multidentata', 10, 'invertebre', 5, 20]
		],
		tip: 'Les poissons sont là pour la vie du bac : peu de gros poissons, un bon banc, et une alimentation légère.',
		guide: 'biotopes/styles'
	},
	{
		slug: 'barbus-et-loches',
		title: 'Barbus tigrés et loches',
		summary: 'Un bac nerveux et joueur : barbus tigrés, barbus à cinq bandes, loches naines et un mangeur d’algues.',
		region: 'Asie du Sud-Est',
		water: 'plantee',
		volume: [200, 300],
		ref: 220,
		level: 1,
		tags: ['banc', 'asie', 'actif', 'débutant'],
		conditions: { temp: [22, 27], ph: [6.0, 7.5], dgh: [4, 12] },
		decor: 'Plantes denses sur les bords, grand espace de nage, racines et galets. Courant modéré.',
		stock: [
			['Puntigrus tetrazona', 10, 'banc', 8],
			['Desmopuntius pentazona', 8, 'banc', 6],
			['Yasuhikotakia modesta', 4, 'fond', 3, 6],
			['Crossocheilus oblongus', 3, 'nettoyeur', 2, 5]
		],
		tip: 'Un banc de dix barbus tigrés calme leur agressivité : isolés ou en petit nombre, ils mordillent les voisins.',
		warn: 'Pas de poissons à longues nageoires (guppys, scalaires, bettas) avec les barbus tigrés.'
	},
	{
		slug: 'gouramis-et-rasboras',
		title: 'Gouramis perlés et rasboras',
		summary: 'Un trio de gouramis perlés dans un bac planté, avec un banc de rasboras, des loches et des corydoras.',
		region: 'Asie du Sud-Est',
		water: 'plantee',
		volume: [150, 250],
		ref: 180,
		level: 1,
		tags: ['paisible', 'asie', 'plantes', 'débutant'],
		conditions: { temp: [24, 28], ph: [6.0, 7.5], dgh: [3, 10] },
		decor: 'Végétation dense avec plantes flottantes, bois flotté. Courant faible : les gouramis respirent à la surface.',
		stock: [
			['Trichopodus leerii', 3, 'vedette', 2, 4],
			['Trigonostigma heteromorpha', 15, 'banc', 10],
			['Pangio kuhlii', 6, 'fond', 5],
			['Corydoras panda', 6, 'fond', 6]
		],
		tip: 'Les mâles de gourami perlé se parent de rouge au moment de la parade. Un mâle et une ou deux femelles suffisent.'
	},
	{
		slug: 'tanganyika-coquilles',
		title: 'Tanganyika : cichlidés à coquilles',
		summary: 'Des colonies de petits cichlidés qui vivent dans des coquilles d’escargots, en eau dure et sable blanc.',
		region: 'Lac Tanganyika',
		water: 'douce',
		volume: [60, 150],
		ref: 100,
		level: 2,
		tags: ['cichlidés', 'tanganyika', 'eau dure', 'fascinant'],
		conditions: { temp: [24, 27], ph: [7.8, 9.0], dgh: [10, 20] },
		decor: 'Sable fin blanc, beaucoup de coquilles d’escargots vides (une par poisson et plus). Quelques roches. Aucune plante, ou très peu.',
		stock: [
			['Neolamprologus multifasciatus', 12, 'fond', 8],
			['Neolamprologus similis', 6, 'fond', 4]
		],
		tip: 'Chaque poisson défend sa coquille : on les voit déplacer du sable et se chamailler sans cesse, c’est tout le charme.',
		guide: 'biotopes/lac-tanganyika'
	},
	{
		slug: 'tanganyika-rochers',
		title: 'Tanganyika : rochers et pélagiques',
		summary: 'Des juliens, des leleupi et un banc de Cyprichromis qui flotte au-dessus des roches.',
		region: 'Lac Tanganyika',
		water: 'douce',
		volume: [200, 320],
		ref: 250,
		level: 2,
		dense: 2,
		tags: ['cichlidés', 'tanganyika', 'eau dure', 'colorés'],
		conditions: { temp: [24, 27], ph: [7.8, 9.0], dgh: [10, 20] },
		decor: 'Murs de roches avec des fentes, sable, grand espace de nage libre au milieu. Eau dure et alcaline.',
		stock: [
			['Julidochromis ornatus', 4, 'fond', 2, 6],
			['Neolamprologus leleupi', 4, 'fond', 2, 6],
			['Synodontis petricola', 2, 'fond', 1, 3]
		],
		tip: 'Les Cyprichromis occupent le haut de l’eau, les Julidochromis les roches : deux mondes dans un seul bac.',
		warn: 'Les cichlidés de rochers sont territoriaux : fournis assez de roches pour séparer les territoires.',
		guide: 'biotopes/lac-tanganyika'
	},
	{
		slug: 'cichlides-americains-bleus',
		title: 'Cichlidés bleus d’Amérique du Sud',
		summary: 'Un couple d’Andinoacara bleu, un banc de tétras robustes et des corydoras : un bac solide et coloré.',
		region: 'Amérique du Sud',
		water: 'plantee',
		volume: [180, 300],
		ref: 220,
		level: 2,
		tags: ['cichlidés', 'colorés', 'robuste'],
		conditions: { temp: [22, 27], ph: [6.5, 7.8], dgh: [5, 15] },
		decor: 'Sable, racines, roches arrondies. Plantes robustes (anubias, fougères). Cachettes en pierre pour le couple.',
		stock: [
			['Andinoacara pulcher', 2, 'vedette', 2, 2],
			['Gymnocorymbus ternetzi', 10, 'banc', 8],
			['Corydoras aeneus', 8, 'fond', 6],
			['Ancistrus triradiatus', 1, 'nettoyeur', 1, 2]
		],
		tip: 'Évite les poissons très petits (néons, rasboras) : un couple de cichlidés, en période de reproduction, peut les chasser.'
	},
	{
		slug: 'vivipares-du-mexique',
		title: 'Vivipares et goodéidés du Mexique',
		summary: 'Des poissons mexicains rares : xenotoca, splendens, limias… dans une eau dure et fraîche.',
		region: 'Mexique',
		water: 'plantee',
		volume: [150, 250],
		ref: 180,
		level: 2,
		tags: ['vivipares', 'rares', 'eau dure', 'colorés'],
		conditions: { temp: [20, 26], ph: [7.2, 8.2], dgh: [10, 20] },
		decor: 'Eau dure, plantes robustes ou à croissance rapide, sol clair. Beaucoup d’algues autorisées : ils les mangent.',
		stock: [
			['Xenotoca eiseni', 8, 'banc', 6],
			['Ameca splendens', 6, 'banc', 5],
			['Limia nigrofasciata', 6, 'banc', 5]
		],
		tip: 'Ces espèces sont menacées dans la nature, plusieurs survivent surtout grâce aux aquariophiles : c’est un bac qui a du sens.'
	},
	{
		slug: 'riviere-du-congo',
		title: 'Rivière du Congo',
		summary: 'Un grand banc de tétras du Congo, des synodontis et une anguille de roseaux, dans une eau teintée.',
		region: 'Afrique centrale',
		water: 'plantee',
		volume: [200, 350],
		ref: 250,
		level: 2,
		tags: ['afrique', 'banc', 'insolite'],
		conditions: { temp: [24, 28], ph: [6.0, 7.5], dgh: [3, 12] },
		decor: 'Racines, sable, feuilles. Plantes résistantes à l’ombre (anubias, fougères). Couvercle bien fermé : l’anguille de roseaux sort du bac.',
		stock: [
			['Phenacogrammus interruptus', 10, 'banc', 8],
			['Pelvicachromis taeniatus', 2, 'vedette', 2, 2],
			['Synodontis nigriventris', 3, 'fond', 1, 4],
			['Erpetoichthys calabaricus', 1, 'vedette', 1, 2]
		],
		tip: 'Le tétra du Congo adulte est un très beau poisson : les mâles font 8 cm et leurs nageoires frangées brillent sous la lumière.',
		guide: 'biotopes/afrique-ouest-congo'
	},
	{
		slug: 'nouvelle-guinee',
		title: 'Nouvelle-Guinée : arcs-en-ciel',
		summary: 'Des poissons arc-en-ciel de Boeseman et des rouges de Nouvelle-Guinée, en banc spectaculaire.',
		region: 'Nouvelle-Guinée',
		water: 'plantee',
		volume: [250, 400],
		ref: 300,
		level: 2,
		tags: ['banc', 'colorés', 'australasie'],
		conditions: { temp: [24, 28], ph: [7.0, 8.2], dgh: [8, 18] },
		decor: 'Grand bac long (120 cm ou plus), peu de décor au centre, plantes en fond. Éclairage vif qui fait ressortir les reflets.',
		stock: [
			['Melanotaenia boesemani', 8, 'banc', 6],
			['Glossolepis incisus', 6, 'banc', 5],
			['Tateurndina ocellicauda', 4, 'vedette', 2, 6]
		],
		tip: 'Les arcs-en-ciel ont besoin d’espace en longueur : ce sont des nageurs de rivière.',
		guide: 'biotopes/australasie'
	},
	{
		slug: 'riviere-a-courant',
		title: 'Rivière à courant',
		summary: 'Des danios géants et des barbus qui adorent le courant, avec un mangeur d’algues et des loches.',
		region: 'Inde, Asie du Sud',
		water: 'plantee',
		volume: [220, 320],
		ref: 250,
		level: 1,
		tags: ['banc', 'courant', 'actif', 'asie'],
		conditions: { temp: [20, 26], ph: [6.5, 8.0], dgh: [4, 14] },
		decor: 'Pompe de brassage pour créer du courant, galets, racines, plantes robustes. Bac long.',
		stock: [
			['Danio albolineatus', 10, 'banc', 8],
			['Pethia conchonius', 8, 'banc', 5],
			['Crossocheilus oblongus', 4, 'nettoyeur', 2, 6],
			['Botia lohachata', 3, 'fond', 3, 5]
		],
		tip: 'Ces poissons filent toute la journée : le courant et la longueur du bac comptent plus que le volume.'
	},
];

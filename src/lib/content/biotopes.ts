import type { Theme } from './types';

// Les noms latins de `species` renvoient vers les fiches de l'encyclopédie.

export const BIOTOPES: Theme = {
	slug: 'biotopes',
	title: 'Biotopes et styles',
	summary: 'Recréer un milieu naturel : eaux noires, lacs africains, ruisseaux d’Asie…',
	icon: 'sun',
	color: 'var(--orange)',
	guides: [
		{
			slug: 'amazonie-eaux-noires',
			title: 'Amazonie : eaux noires',
			summary: 'Rio Negro et affluents : eau très douce, acide, teintée de tanins.',
			level: 'avance',
			minutes: 4,
			blocks: [
				{
					p: ['Les eaux noires coulent sur des sols pauvres et reçoivent beaucoup de matière végétale. L’eau est brune, presque sans minéraux, très acide, et les poissons y sont adaptés à des conditions précises.']
				},
				{
					h: 'Valeurs de référence',
					list: ['Température : 26 à 30 °C', 'pH : 4,5 à 6,5', 'GH : 0 à 3 °dGH', 'KH : 0 à 2 °dKH']
				},
				{
					h: 'Décor',
					list: ['Sable clair ou foncé, bois flotté, racines, feuilles mortes (amandier, chêne, hêtre).', 'Éclairage tamisé, plantes flottantes.', 'Plantes tolérantes : anubias, fougères, cryptocorynes.']
				},
				{ tip: 'Il faut en général de l’eau osmosée ou très douce. Le pH baisse avec les tanins du bois et des feuilles.' }
			],
			species: [
				'Paracheirodon axelrodi',
				'Hemigrammus rhodostomus',
				'Hemigrammus bleheri',
				'Carnegiella strigata',
				'Nannostomus trifasciatus',
				'Corydoras adolfoi',
				'Apistogramma agassizii',
				'Dicrossus filamentosus',
				'Pterophyllum altum',
				'Symphysodon discus'
			],
			related: ['demarrer/eau-robinet', 'biotopes/amazonie-eaux-claires']
		},
		{
			slug: 'amazonie-eaux-claires',
			title: 'Amazonie : eaux claires et rivières tempérées',
			summary: 'Rivières de forêt aux eaux douces et peu acides : un bac de communauté facile.',
			level: 'debutant',
			minutes: 3,
			blocks: [
				{
					h: 'Valeurs de référence',
					list: ['Température : 24 à 28 °C', 'pH : 6 à 7,5', 'GH : 3 à 8 °dGH', 'KH : 2 à 6 °dKH']
				},
				{
					h: 'Décor',
					list: ['Sable ou gravier fin, racines, roches arrondies.', 'Plantes : échinodorus, vallisnéries, sagittaires, cryptocorynes.', 'Plantes flottantes pour tamiser la lumière.']
				},
				{ tip: 'C’est le biotope le plus accessible pour débuter : poissons faciles et eau du robinet souvent adaptée après un peu d’osmose.' }
			],
			species: [
				'Paracheirodon innesi',
				'Hyphessobrycon eques',
				'Hemigrammus ocellifer',
				'Corydoras aeneus',
				'Corydoras sterbai',
				'Mikrogeophagus ramirezi',
				'Pterophyllum scalare',
				'Otocinclus affinis',
				'Nannostomus beckfordi'
			],
			related: ['biotopes/amazonie-eaux-noires']
		},
		{
			slug: 'asie-tourbieres',
			title: 'Asie du Sud-Est : ruisseaux de forêt et tourbières',
			summary: 'Eaux brunes, très acides, avec feuilles mortes et racines : le paradis des petits rasboras.',
			level: 'avance',
			minutes: 4,
			blocks: [
				{
					h: 'Valeurs de référence',
					list: ['Température : 24 à 28 °C', 'pH : 4 à 6,5', 'GH : 0 à 4 °dGH', 'KH : 0 à 2 °dKH']
				},
				{
					h: 'Décor',
					list: ['Sable, bois, feuilles mortes en quantité.', 'Éclairage faible, plantes flottantes, mousses.', 'Cryptocorynes, fougères de Java et anubias.']
				},
				{ warn: 'Les espèces de tourbière (Betta coccina, Parosphromenus, Boraras) sont sensibles à l’eau dure et aux variations. Elles exigent un bac mature et une eau stable.' }
			],
			species: [
				'Boraras brigittae',
				'Boraras merah',
				'Trigonostigma heteromorpha',
				'Rasbora kalochroma',
				'Desmopuntius pentazona',
				'Puntigrus tetrazona',
				'Betta coccina',
				'Parosphromenus deissneri',
				'Sphaerichthys osphromenoides',
				'Pangio kuhlii'
			],
			related: ['biotopes/amazonie-eaux-noires']
		},
		{
			slug: 'inde-ghats',
			title: 'Inde du Sud : rivières des Ghâts',
			summary: 'Rivières claires et rapides, eau neutre, courant et bonne oxygénation.',
			level: 'intermediaire',
			minutes: 3,
			blocks: [
				{
					h: 'Valeurs de référence',
					list: ['Température : 22 à 27 °C', 'pH : 6,5 à 7,8', 'GH : 5 à 12 °dGH', 'KH : 3 à 8 °dKH']
				},
				{
					h: 'Décor',
					list: ['Galets et roches, un peu de bois, sable ou gravier fin.', 'Courant modéré et eau très oxygénée.', 'Plantes de berge : vallisnéries, cryptocorynes, microsorum.']
				}
			],
			species: [
				'Sahyadria denisonii',
				'Dawkinsia filamentosa',
				'Devario aequipinnatus',
				'Pethia ticto',
				'Botia striata',
				'Dario dario',
				'Badis badis',
				'Trichogaster lalius'
			],
			related: ['biotopes/asie-tourbieres']
		},
		{
			slug: 'lac-malawi',
			title: 'Lac Malawi : les mbuna et les peacocks',
			summary: 'Eau dure, alcaline, rochers empilés : un bac coloré et animé.',
			level: 'intermediaire',
			minutes: 4,
			blocks: [
				{
					h: 'Valeurs de référence',
					list: ['Température : 24 à 28 °C', 'pH : 7,8 à 8,6', 'GH : 8 à 15 °dGH', 'KH : 8 à 14 °dKH']
				},
				{
					h: 'Décor',
					list: ['Roches empilées avec nombreuses cachettes (les mbuna défendent des territoires).', 'Sable (pour les peacocks).', 'Peu de plantes, ou des plantes robustes comme les anubias et la fougère de Java.']
				},
				{
					h: 'Règles de composition',
					list: [
						'Surpeuple légèrement un bac de mbuna pour disperser l’agressivité.',
						'Un mâle pour plusieurs femelles.',
						'Ne mélange pas deux espèces trop proches pour éviter l’hybridation.',
						'Alimentation riche en végétal pour les mbuna.'
					]
				}
			],
			species: [
				'Labidochromis caeruleus',
				'Maylandia estherae',
				'Pseudotropheus demasoni',
				'Iodotropheus sprengerae',
				'Aulonocara stuartgranti',
				'Copadichromis borleyi'
			],
			related: ['biotopes/lac-tanganyika', 'vivre/cohabitation']
		},
		{
			slug: 'lac-tanganyika',
			title: 'Lac Tanganyika',
			summary: 'Eau très dure et alcaline, rochers et coquilles : cichlidés comportementalistes.',
			level: 'intermediaire',
			minutes: 4,
			blocks: [
				{
					h: 'Valeurs de référence',
					list: ['Température : 24 à 27 °C', 'pH : 8 à 9', 'GH : 10 à 20 °dGH', 'KH : 10 à 18 °dKH']
				},
				{
					h: 'Décor',
					list: ['Sable, roches, coquilles d’escargots vides pour les espèces à coquilles.', 'Peu de plantes.']
				},
				{ tip: 'Les cichlidés à coquilles (Neolamprologus multifasciatus) forment des colonies fascinantes dans un petit bac.' }
			],
			species: [
				'Neolamprologus multifasciatus',
				'Neolamprologus pulcher',
				'Julidochromis ornatus',
				'Altolamprologus calvus',
				'Cyprichromis leptosoma',
				'Tropheus moorii',
				'Synodontis petricola'
			],
			related: ['biotopes/lac-malawi']
		},
		{
			slug: 'afrique-ouest-congo',
			title: 'Afrique de l’Ouest et Congo',
			summary: 'Ruisseaux de forêt et rivières : cichlidés nains, killis et poissons préhistoriques.',
			level: 'intermediaire',
			minutes: 3,
			blocks: [
				{
					h: 'Valeurs de référence',
					list: ['Température : 23 à 28 °C', 'pH : 5,5 à 7,5', 'GH : 2 à 10 °dGH', 'KH : 1 à 6 °dKH']
				},
				{
					h: 'Décor',
					list: ['Sable, racines, feuilles mortes, quelques grottes.', 'Plantes : anubias, fougères, bolbitis.', 'Couvercle indispensable pour les poissons de surface.']
				}
			],
			species: [
				'Pelvicachromis pulcher',
				'Anomalochromis thomasi',
				'Phenacogrammus interruptus',
				'Synodontis nigriventris',
				'Pantodon buchholzi',
				'Erpetoichthys calabaricus',
				'Aphyosemion australe'
			],
			related: ['plantes/debuter']
		},
		{
			slug: 'amerique-centrale',
			title: 'Amérique centrale',
			summary: 'Vivipares et cichlidés robustes, eau neutre à dure.',
			level: 'debutant',
			minutes: 3,
			blocks: [
				{
					h: 'Valeurs de référence',
					list: ['Température : 22 à 28 °C', 'pH : 7 à 8,5', 'GH : 8 à 18 °dGH', 'KH : 6 à 12 °dKH']
				},
				{
					h: 'Décor',
					list: ['Sable ou gravier, roches calcaires, bois.', 'Plantes robustes : vallisnéries, sagittaires, anubias.']
				},
				{ tip: 'Les vivipares (platys, porte-épées) sont des classiques de débutant. Les cichlidés centraméricains demandent plus de place et sont territoriaux.' }
			],
			species: [
				'Xiphophorus maculatus',
				'Xiphophorus hellerii',
				'Poecilia sphenops',
				'Xenotoca eiseni',
				'Amatitlania nigrofasciata',
				'Thorichthys meeki'
			],
			related: ['vivre/cohabitation']
		},
		{
			slug: 'australasie',
			title: 'Nouvelle-Guinée et Australie',
			summary: 'Poissons arc-en-ciel : bancs colorés, bac long et eau neutre à dure.',
			level: 'intermediaire',
			minutes: 3,
			blocks: [
				{
					h: 'Valeurs de référence',
					list: ['Température : 22 à 28 °C', 'pH : 6,5 à 8', 'GH : 6 à 15 °dGH', 'KH : 4 à 10 °dKH']
				},
				{
					h: 'Décor',
					list: ['Bac long (120 cm et plus), espace de nage dégagé.', 'Bois, roches, plantes robustes (vallisnéries, cryptocorynes).', 'Couvercle conseillé.']
				},
				{ tip: 'Les couleurs des mâles se révèlent avec l’âge. Prends toujours un groupe d’au moins six.' }
			],
			species: [
				'Melanotaenia boesemani',
				'Melanotaenia praecox',
				'Glossolepis incisus',
				'Iriatherina werneri',
				'Pseudomugil gertrudae'
			],
			related: ['vivre/cohabitation']
		},
		{
			slug: 'eau-froide',
			title: 'Eau fraîche et tempérée',
			summary: 'Poissons de petits cours d’eau d’Asie et d’Europe : un bac sans chauffage.',
			level: 'debutant',
			minutes: 3,
			blocks: [
				{
					h: 'Valeurs de référence',
					list: ['Température : 14 à 22 °C', 'pH : 6,5 à 8', 'GH : 6 à 15 °dGH']
				},
				{
					h: 'Décor',
					list: ['Gravier, roches, plantes d’eau fraîche : hottonie, élodée, vallisnérie, nuphar.', 'Pas de chauffage, mais un ventilateur en été.']
				},
				{ warn: 'Le poisson rouge devient grand et salit beaucoup : prévois un grand bac ou un bassin, et une filtration puissante.' }
			],
			species: [
				'Tanichthys albonubes',
				'Oryzias latipes',
				'Barbodes semifasciolatus',
				'Pethia conchonius',
				'Misgurnus anguillicaudatus',
				'Carassius auratus'
			],
			related: ['entretien/chaleur-froid']
		},
		{
			slug: 'styles',
			title: 'Quel style de bac choisir ?',
			summary: 'Communauté, biotope, néerlandais, aquascape, nano : les grandes familles.',
			level: 'debutant',
			minutes: 4,
			blocks: [
				{
					list: [
						'Bac de communauté : plusieurs espèces compatibles dans un décor libre. Le plus simple pour débuter.',
						'Biotope : on recrée un milieu naturel précis, avec des espèces et un décor d’une même région.',
						'Aquarium néerlandais : très planté, par massifs de plantes aux couleurs et formes variées, avec peu de décor.',
						'Aquascape de nature : composition minimaliste de roches, bois et tapis, inspirée du paysage.',
						'Nano-bac : moins de 30 litres, pour de petites espèces (rasboras, crevettes). Plus de rigueur.',
						'Paludarium : terre et eau ensemble, pour plantes et animaux semi-aquatiques.'
					]
				},
				{ tip: 'Choisis d’abord les animaux, puis le décor. C’est l’inverse qui crée les problèmes.' }
			],
			related: ['demarrer/choisir-son-bac']
		}
	]
};

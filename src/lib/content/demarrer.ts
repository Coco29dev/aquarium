import type { Theme } from './types';

export const DEMARRER: Theme = {
	slug: 'demarrer',
	title: 'Bien démarrer',
	summary: 'Choisir, installer et cycler un premier aquarium.',
	icon: 'bacs',
	color: 'var(--blue)',
	guides: [
		{
			slug: 'choisir-son-bac',
			title: 'Choisir son premier aquarium',
			summary: 'Volume, emplacement et budget : les décisions qui comptent avant d’acheter.',
			level: 'debutant',
			minutes: 4,
			blocks: [
				{
					h: 'Le volume',
					p: [
						'Plus un bac est grand, plus l’eau reste stable : une erreur de dosage ou un poisson de trop se dilue au lieu de tuer. Pour un premier bac, vise 60 à 120 litres. Les bacs de moins de 30 litres sont plus difficiles qu’on ne le pense, car les paramètres y varient vite.',
						'Le volume réel est inférieur au volume annoncé : sol, décor et marge sous le bord retirent 10 à 20 %. Le calculateur « Volume réel » de l’Atelier te donne la valeur exacte.'
					]
				},
				{
					h: 'L’emplacement',
					list: [
						'Loin d’une fenêtre plein sud (algues et chaleur) et des radiateurs.',
						'Sur un meuble prévu pour le poids : un litre d’eau pèse un kilo, un bac de 100 litres dépasse 130 kg avec le sol et le décor.',
						'À proximité d’une prise et d’un point d’eau, avec un accès facile par-dessus.'
					]
				},
				{
					h: 'Le budget',
					p: ['Compte le bac, le meuble, le filtre, le chauffage, l’éclairage, le sol, le décor, les tests d’eau et le conditionneur. Les poissons sont la dernière dépense, pas la première.']
				},
				{ tip: 'Décide du type de bac avant d’acheter : communauté tropicale, plantée, cichlidés africains, eau de mer… Chaque type impose son matériel et ses réglages.' }
			],
			related: ['demarrer/materiel-essentiel', 'demarrer/cycle-azote'],
			tool: { label: 'Calculer le volume réel', href: '/outils' }
		},
		{
			slug: 'materiel-essentiel',
			title: 'Le matériel indispensable',
			summary: 'Filtre, chauffage, éclairage, sol, tests : ce qu’il faut, et ce qui peut attendre.',
			level: 'debutant',
			minutes: 4,
			blocks: [
				{
					h: 'Le filtre',
					p: ['C’est le cœur du bac : il héberge les bactéries qui transforment les déchets toxiques. Choisis un débit horaire d’environ 3 à 5 fois le volume du bac. Un filtre extérieur ou un filtre d’angle conviennent à la plupart des bacs de communauté ; le filtre à mousse suffit pour un nano-bac ou des alevins.']
				},
				{
					h: 'Le chauffage',
					p: ['Un thermochauffage de 1 W par litre environ convient en intérieur ; prévois un modèle réglable avec thermostat fiable et vérifie la température avec un thermomètre séparé. Les poissons d’eau froide (poisson rouge, tanichthys) s’en passent.']
				},
				{
					h: 'L’éclairage',
					p: ['Une rampe LED de la longueur du bac, programmée 7 à 9 heures par jour, suffit pour un bac peu planté. Les plantes exigeantes demandent une lumière plus forte et un cycle régulier.']
				},
				{
					h: 'Le sol et le décor',
					p: ['Sable fin pour les poissons de fond (corydoras, loches) ; gravier arrondi pour les autres. Évite les décors qui libèrent du calcaire dans un bac à eau douce (certains calcaires, coquillages) sauf si tu cherches une eau dure. Rince bien tout avant de l’installer.']
				},
				{
					h: 'Les tests',
					list: ['pH', 'KH et GH', 'Ammoniac (NH3/NH4), nitrites (NO2), nitrates (NO3)', 'Thermomètre fiable'],
					tip: 'Les tests en gouttes sont plus précis que les bandelettes. Note la date d’ouverture : les réactifs se périment.'
				},
				{ list: ['Épuisette', 'Seau réservé à l’aquarium', 'Tuyau de vidange', 'Conditionneur d’eau', 'Pince et ciseaux pour plantes'], h: 'Le petit matériel' }
			],
			related: ['demarrer/installation', 'entretien/tests']
		},
		{
			slug: 'cycle-azote',
			title: 'Le cycle de l’azote expliqué',
			summary: 'Pourquoi un bac neuf ne peut pas accueillir de poissons tout de suite.',
			level: 'debutant',
			minutes: 4,
			blocks: [
				{
					p: ['Les poissons excrètent de l’ammoniac, très toxique. Des bactéries (surtout dans le filtre et le sol) le transforment en nitrites, toxiques eux aussi, puis d’autres en nitrates, bien moins dangereux. Les plantes et les changements d’eau éliminent les nitrates.']
				},
				{
					h: 'Les trois étapes',
					steps: [
						'Ammoniac (NH3/NH4) : il apparaît dès que quelque chose se décompose ou que des poissons sont présents.',
						'Nitrites (NO2) : ils montent quand les premières bactéries se développent, puis retombent.',
						'Nitrates (NO3) : ils s’accumulent. On les maîtrise par les changements d’eau et les plantes.'
					]
				},
				{
					h: 'Le bac est cyclé quand…',
					p: ['L’ammoniac et les nitrites retombent à zéro de façon stable, deux mesures de suite espacées de deux jours, et que des nitrates sont présents. L’app te suit sur ce point depuis l’écran du bac.']
				},
				{ warn: 'Des nitrates dans l’eau du robinet ne prouvent pas que le bac est cyclé. Il faut avoir observé le cycle (ammoniac ou nitrites mesurables, puis disparus).' },
				{ tip: 'Ne jamais rincer le filtre à l’eau du robinet : le chlore détruit les bactéries. Rince-le dans l’eau du bac siphonnée.' }
			],
			related: ['demarrer/cyclage-pas-a-pas', 'entretien/filtre']
		},
		{
			slug: 'cyclage-pas-a-pas',
			title: 'Cycler un bac neuf, pas à pas',
			summary: 'La méthode « sans poissons » : propre, plus douce pour les animaux, mais il faut de la patience.',
			level: 'debutant',
			minutes: 5,
			blocks: [
				{
					steps: [
						'Installe le bac, le filtre, le chauffage et l’éclairage ; remplis avec de l’eau traitée au conditionneur.',
						'Ajoute une source d’ammoniac : produit dédié à l’aquarium (sans additifs), ou une pincée de nourriture qui se décompose. Vise environ 2 mg/L.',
						'Mesure l’ammoniac, les nitrites et les nitrates tous les 2 à 3 jours.',
						'Quand l’ammoniac baisse, les nitrites montent. Continue d’alimenter le bac si l’ammoniac tombe à zéro trop vite.',
						'Quand l’ammoniac et les nitrites retombent à zéro en 24 heures après une nouvelle dose, le cycle tourne.',
						'Fais un gros changement d’eau (50 %) pour faire redescendre les nitrates avant d’introduire les poissons.'
					]
				},
				{
					h: 'Combien de temps ?',
					p: ['En général 4 à 6 semaines. L’eau chaude, une eau bien oxygénée et un matériau de filtration mûr (mousse venant d’un bac sain) raccourcissent le processus, mais il faut toujours vérifier avec les mesures.']
				},
				{ warn: 'Si les poissons arrivent avant la fin du cycle, ils subissent des pics d’ammoniac et de nitrites. Fais alors des changements d’eau fréquents et nourris très peu.' },
				{ tip: 'Les plantes en bonne santé consomment l’ammoniac et raccourcissent la période risquée, mais elles ne remplacent pas le cycle.' }
			],
			related: ['demarrer/premiers-poissons']
		},
		{
			slug: 'installation',
			title: 'Installer un bac pas à pas',
			summary: 'De l’emplacement à la mise en eau, sans erreur.',
			level: 'debutant',
			minutes: 4,
			blocks: [
				{
					steps: [
						'Pose le meuble, vérifie qu’il est de niveau et place une plaque de mousse sous le bac.',
						'Rince le sol et les décors à l’eau claire, sans savon.',
						'Étale le sol (3 à 6 cm), dispose roches et bois en les calant bien.',
						'Installe filtre et chauffage, sans les brancher.',
						'Remplis lentement en versant l’eau sur une assiette pour ne pas bouleverser le sol.',
						'Ajoute le conditionneur, plante, puis branche le matériel.',
						'Laisse tourner le bac et démarre le cyclage avant tout poisson.'
					]
				},
				{ tip: 'Prévois une boucle d’égouttage sur les câbles pour que l’eau ne coule pas vers les prises.' },
				{ warn: 'Ne branche jamais le chauffage hors de l’eau et attends quelques minutes après l’avoir immergé avant de l’allumer.' }
			],
			related: ['demarrer/cyclage-pas-a-pas', 'plantes/debuter']
		},
		{
			slug: 'eau-robinet',
			title: 'Eau du robinet, conditionneur et osmose',
			summary: 'Chlore, dureté, pH : ce que contient ton eau et comment la préparer.',
			level: 'intermediaire',
			minutes: 5,
			blocks: [
				{
					h: 'Le conditionneur',
					p: ['Il neutralise le chlore et les chloramines. Ajoute-le à l’eau neuve avant de l’introduire dans le bac. La plupart des produits agissent aussi sur certains métaux lourds.']
				},
				{
					h: 'Connaître son eau',
					p: ['Demande les valeurs à ton fournisseur d’eau ou mesure-les : GH (dureté totale), KH (dureté carbonatée), pH, nitrates. Une eau moyenne (GH 8 à 12, KH 6 à 10) convient à beaucoup d’espèces. Les poissons d’eaux noires (néons cardinaux, apistogramma) préfèrent une eau plus douce.']
				},
				{
					h: 'Adoucir ou durcir',
					list: [
						'Eau osmosée : très pure, sans minéraux. Mélange-la avec l’eau du robinet pour baisser la dureté.',
						'Reminéralisation : si tu utilises l’osmose seule, ajoute des sels pour remonter GH et KH.',
						'Pour durcir : ajoute des roches calcaires ou des sels de reminéralisation.'
					]
				},
				{ warn: 'Ne change pas brutalement le pH ni la dureté d’un bac peuplé. Procède par petites étapes sur plusieurs jours.' }
			],
			related: ['demarrer/parametres', 'entretien/changement-eau'],
			tool: { label: 'Calculateurs de mélange et de reminéralisation', href: '/outils' }
		},
		{
			slug: 'parametres',
			title: 'Les paramètres de l’eau',
			summary: 'Température, pH, GH, KH et composés azotés : valeurs cibles et rôle de chacun.',
			level: 'debutant',
			minutes: 5,
			blocks: [
				{
					h: 'Température',
					p: ['La plupart des poissons tropicaux vivent entre 24 et 27 °C. Plus important que la valeur exacte : la stabilité. Évite les variations de plus de 2 °C en une journée.']
				},
				{
					h: 'pH',
					p: ['Il mesure l’acidité. Un pH stable vaut mieux qu’un pH « parfait ». Beaucoup d’espèces de communauté tolèrent 6,5 à 7,5. Les eaux noires amazoniennes sont plus acides (5 à 6,5), les lacs africains plus basiques (7,8 à 9).']
				},
				{
					h: 'GH et KH',
					list: [
						'GH : dureté totale (calcium, magnésium). Les poissons d’eau douce, de la plupart des communautés, apprécient 6 à 12 °dGH.',
						'KH : dureté carbonatée, qui stabilise le pH. En dessous de 3 °dKH, le pH peut chuter brutalement.'
					]
				},
				{
					h: 'Ammoniac, nitrites, nitrates',
					list: [
						'Ammoniac : 0 mg/L. Tout ce qui est mesurable est un signal d’alarme.',
						'Nitrites : 0 mg/L.',
						'Nitrates : idéalement moins de 20 à 40 mg/L pour la plupart des poissons ; moins de 10 pour les espèces sensibles.'
					]
				},
				{ tip: 'Dans l’app, chaque paramètre a sa plage acceptable, modifiable selon ton bac. Les alertes se déclenchent quand une valeur sort de la plage ou dérive trop vite.' }
			],
			related: ['entretien/tests', 'demarrer/cycle-azote']
		},
		{
			slug: 'premiers-poissons',
			title: 'Introduire les premiers poissons',
			summary: 'Acclimatation, quantité, ordre d’arrivée : éviter le coup dur du premier mois.',
			level: 'debutant',
			minutes: 4,
			blocks: [
				{
					h: 'Combien de poissons à la fois ?',
					p: ['Ajoute-les par petits groupes, en laissant une à deux semaines entre deux arrivées. Le filtre doit s’adapter à la charge supplémentaire. Contrôle l’ammoniac et les nitrites après chaque arrivée.']
				},
				{
					h: 'L’acclimatation',
					steps: [
						'Éteins la lumière ou tamise-la.',
						'Fais flotter le sac fermé 15 à 20 minutes pour égaliser la température.',
						'Ajoute progressivement un peu d’eau du bac dans le sac, toutes les 5 minutes, pendant 20 à 30 minutes.',
						'Sors les poissons à l’épuisette et laisse l’eau du sac de côté.',
						'Ne nourris pas le premier jour.'
					]
				},
				{ tip: 'Pose-toi la question avant l’achat : la taille adulte, le groupe minimal et la compatibilité de chaque espèce. La fiche d’espèce de l’encyclopédie te les donne.' },
				{ warn: 'Ne mets jamais d’eau du sac d’achat dans ton bac : elle peut contenir des parasites ou des maladies.' }
			],
			related: ['sante/quarantaine', 'vivre/cohabitation']
		}
	]
};

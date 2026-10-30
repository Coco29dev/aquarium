import type { Theme } from './types';

// Contenu d'information générale. Il ne remplace pas l'avis d'un vétérinaire ou d'un aquariophile expérimenté :
// pour tout médicament, suivre la notice du produit (dosage, durée, compatibilité avec plantes et invertébrés).

export const SANTE: Theme = {
	slug: 'sante',
	title: 'Santé des poissons',
	summary: 'Prévenir, reconnaître et traiter les problèmes courants.',
	icon: 'flask',
	color: 'var(--red)',
	guides: [
		{
			slug: 'prevenir',
			title: 'Prévenir plutôt que soigner',
			summary: 'La plupart des maladies viennent du stress : qualité d’eau, alimentation, cohabitation.',
			level: 'debutant',
			minutes: 4,
			blocks: [
				{
					p: ['Les parasites et bactéries responsables des maladies courantes sont déjà présents dans beaucoup de bacs. Un poisson sain leur résiste ; un poisson stressé tombe malade. Prévenir revient donc à réduire le stress.']
				},
				{
					h: 'Les bons réflexes',
					list: [
						'Garde une eau stable : température régulière, ammoniac et nitrites à zéro, nitrates modérés.',
						'Respecte le groupe minimal et les compatibilités de chaque espèce.',
						'Ne surpeuple pas le bac.',
						'Nourris avec une alimentation variée et de qualité, en petites quantités.',
						'Mets en quarantaine tout nouveau poisson et toute plante suspecte.',
						'Observe tes poissons chaque jour : un poisson isolé, immobile ou qui nage bizarrement est un premier signe.'
					]
				},
				{ tip: 'Quand un poisson semble malade, teste d’abord l’eau avant de traiter : la majorité des « maladies » sont des intoxications ou du stress.' }
			],
			related: ['sante/quarantaine', 'sante/comportements']
		},
		{
			slug: 'quarantaine',
			title: 'La quarantaine',
			summary: 'Un petit bac pour observer les nouveaux arrivants.',
			level: 'intermediaire',
			minutes: 4,
			blocks: [
				{
					p: ['Un bac de quarantaine protège ton bac principal. Il n’a pas besoin d’être beau : 20 à 40 litres, chauffage, filtre à mousse mûr, quelques cachettes, pas de sol.']
				},
				{
					h: 'Durée et surveillance',
					list: [
						'Garde les nouveaux poissons 2 à 4 semaines.',
						'Observe l’appétit, les nageoires, la peau, la respiration.',
						'Nourris-les bien pour qu’ils reprennent des forces.',
						'Mesure l’ammoniac et les nitrites régulièrement : un bac de quarantaine cycle vite.'
					]
				},
				{ tip: 'Fais tourner le filtre à mousse dans ton bac principal : il sera déjà colonisé quand tu en auras besoin.' },
				{ warn: 'Ne passe pas le matériel d’un bac à l’autre sans le rincer : une épuisette peut transporter des maladies.' }
			],
			related: ['sante/pharmacie', 'demarrer/premiers-poissons']
		},
		{
			slug: 'pharmacie',
			title: 'Une pharmacie de base',
			summary: 'Ce qu’il est utile d’avoir à portée de main, sans faire de stock inutile.',
			level: 'intermediaire',
			minutes: 3,
			blocks: [
				{
					list: [
						'Conditionneur d’eau, tests d’ammoniac et de nitrites.',
						'Sel non iodé (gros sel ou sel d’aquarium) pour certains bains.',
						'Un anti-parasitaire à large spectre pour les poissons à écailles, selon recommandation locale.',
						'Un antibactérien en cas de pourriture des nageoires ou d’infection (selon conseil de professionnel).',
						'Un second thermomètre et un petit bac de quarantaine.'
					]
				},
				{ warn: 'Beaucoup de traitements sont toxiques pour les crevettes, les escargots, les plantes sensibles et certains poissons sans écailles (loches, corydoras, poissons-chats). Lis toujours la notice et demande conseil avant de traiter un bac planté.' },
				{ tip: 'Traite de préférence dans un bac de soins séparé quand c’est possible : tu protèges les plantes et les bactéries du filtre.' }
			],
			related: ['sante/quarantaine']
		},
		{
			slug: 'comportements',
			title: 'Ce que signalent les comportements',
			summary: 'Un poisson qui souffre l’exprime avant de tomber malade.',
			level: 'debutant',
			minutes: 4,
			blocks: [
				{
					list: [
						'À la surface, la bouche ouverte : manque d’oxygène, ammoniac ou nitrites. Teste l’eau et aère.',
						'Immobile dans un coin, nageoires serrées : stress, eau de mauvaise qualité, maladie débutante.',
						'Frotte ses flancs sur le décor : parasites externes (points blancs, velours).',
						'Opercules qui battent vite : problème de branchies (parasites, toxicité).',
						'Nage à l’envers, sur le flanc ou en spirale : trouble de la vessie natatoire ou intoxication.',
						'Refuse de manger plusieurs jours : stress, maladie, parfois un simple repos après transport.',
						'Se cache en permanence : intimidation, éclairage trop fort, bac trop vide.'
					]
				},
				{ tip: 'Quelques poissons sont naturellement nocturnes (poissons-chats, loches) : apprends le comportement normal de chaque espèce.' }
			],
			related: ['sante/prevenir', 'sante/ammoniac-nitrites']
		},
		{
			slug: 'ichtyo',
			title: 'Maladie des points blancs (ichtyo)',
			summary: 'Petits points blancs sur la peau et les nageoires. Très courante, curable si on agit tôt.',
			level: 'intermediaire',
			minutes: 4,
			blocks: [
				{
					h: 'Symptômes',
					list: ['Petits points blancs, comme des grains de sel, sur la peau et les nageoires.', 'Frottements sur le décor, nageoires serrées, respiration rapide.', 'Perte d’appétit.']
				},
				{
					h: 'Causes',
					p: ['Un parasite (Ichthyophthirius multifiliis) arrive avec un nouveau poisson ou à la suite d’un stress, comme une chute de température. Il se multiplie sur le poisson et dans l’eau.']
				},
				{
					h: 'Que faire',
					list: [
						'Monte progressivement la température vers 28 à 30 °C (si les poissons le tolèrent) : le cycle du parasite s’accélère.',
						'Traite avec un produit contre l’ichtyo, en suivant la notice, pendant toute la durée indiquée.',
						'Le sel est parfois utilisé, mais il est inadapté aux plantes, aux invertébrés et à certains poissons (poissons sans écailles).',
						'Aspire le sol pour retirer les kystes et améliore l’oxygénation.'
					]
				},
				{ warn: 'Continue le traitement après la disparition des points : le parasite est encore présent dans l’eau.' },
				{
					h: 'Prévention',
					p: ['Quarantaine des nouveaux poissons, température stable, éviter le stress.']
				}
			],
			related: ['sante/oodinium', 'sante/quarantaine']
		},
		{
			slug: 'oodinium',
			title: 'Maladie du velours (oodinium)',
			summary: 'Fine poussière dorée sur la peau, plus difficile à voir que les points blancs.',
			level: 'intermediaire',
			minutes: 3,
			blocks: [
				{
					h: 'Symptômes',
					list: ['Voile doré ou poudre fine, visible sous une lampe de poche.', 'Frottements, respiration rapide, nageoires collées.', 'Poissons qui se serrent près de la sortie du filtre.']
				},
				{
					h: 'Causes',
					p: ['Un parasite (Piscinoodinium) qui se fixe sur la peau et les branchies. Les poissons stressés ou fraîchement transportés sont les plus touchés.']
				},
				{
					h: 'Que faire',
					list: ['Traitement spécifique contre l’oodinium, en suivant la notice.', 'Baisse la lumière : le parasite a besoin de lumière.', 'Isole les poissons touchés si possible.', 'Fais des changements d’eau avant et après le traitement.']
				},
				{ warn: 'La maladie progresse vite et peut tuer en quelques jours : agis dès les premiers signes.' }
			],
			related: ['sante/ichtyo']
		},
		{
			slug: 'pourriture-nageoires',
			title: 'Pourriture des nageoires',
			summary: 'Nageoires effilochées, bordées de blanc ou de rouge : signe d’une eau de mauvaise qualité.',
			level: 'intermediaire',
			minutes: 3,
			blocks: [
				{
					h: 'Symptômes',
					list: ['Nageoires effilochées, rongées ou décolorées.', 'Bords blancs ou rougeâtres.', 'Dans les cas avancés, la base de la nageoire est atteinte.']
				},
				{
					h: 'Causes',
					p: ['Infection bactérienne favorisée par une eau chargée en déchets, par des blessures (mordillements, décor tranchant) ou par le stress.']
				},
				{
					h: 'Que faire',
					list: ['Teste l’eau et corrige-la : changements d’eau réguliers.', 'Retire les poissons agressifs ou les décors abîmés.', 'Dans les cas modérés, une eau propre suffit souvent ; sinon, un antibactérien adapté peut être nécessaire.']
				},
				{ tip: 'Les nageoires repoussent quand la cause disparaît.' }
			],
			related: ['sante/ammoniac-nitrites', 'sante/pharmacie']
		},
		{
			slug: 'mycose',
			title: 'Mycoses et filaments blancs',
			summary: 'Touffes cotonneuses sur la peau ou les nageoires.',
			level: 'intermediaire',
			minutes: 3,
			blocks: [
				{
					h: 'Symptômes',
					list: ['Touffes blanches, cotonneuses sur la peau, la bouche ou les nageoires.', 'Souvent à la suite d’une blessure.']
				},
				{
					h: 'Que faire',
					list: ['Améliore la qualité de l’eau.', 'Un traitement antifongique spécifique peut être nécessaire ; certains produits sont dangereux pour les invertébrés.', 'Retire les œufs non fécondés ou les restes de nourriture, qui nourrissent les champignons.']
				},
				{ warn: 'Ne confonds pas avec la columnariose, bactérienne : une lésion blanche autour de la bouche peut aussi être bactérienne et demande un autre traitement.' }
			],
			related: ['sante/columnariose']
		},
		{
			slug: 'columnariose',
			title: 'Columnariose (« bouche en coton »)',
			summary: 'Lésions blanchâtres à la bouche et sur le corps, évolution rapide.',
			level: 'avance',
			minutes: 3,
			blocks: [
				{
					h: 'Symptômes',
					list: ['Lésions blanc-grisâtre autour de la bouche, sur le dos ou sur les nageoires.', 'Peau qui semble « mangée ».', 'Respiration difficile.']
				},
				{
					h: 'Que faire',
					p: ['Cette infection bactérienne (Flavobacterium columnare) évolue vite. Isole le poisson, améliore l’eau et demande conseil pour un antibiotique adapté. Une température élevée favorise la bactérie.']
				},
				{ warn: 'Les antibiotiques détruisent aussi les bactéries du filtre : surveille l’ammoniac et les nitrites pendant le traitement.' }
			],
			related: ['sante/mycose', 'sante/quarantaine']
		},
		{
			slug: 'hydropisie',
			title: 'Hydropisie : ventre gonflé, écailles hérissées',
			summary: 'Un symptôme grave plus qu’une maladie : liquide dans le corps.',
			level: 'avance',
			minutes: 3,
			blocks: [
				{
					h: 'Symptômes',
					list: ['Ventre gonflé et écailles qui se dressent comme une pomme de pin.', 'Yeux parfois exorbités.', 'Perte d’appétit, léthargie.']
				},
				{
					h: 'Causes',
					p: ['Infection bactérienne ou défaillance des reins ou du foie, souvent à cause d’une eau de mauvaise qualité, d’une mauvaise alimentation ou d’un stress prolongé.']
				},
				{
					h: 'Que faire',
					list: ['Isole le poisson dans un bac de soins.', 'Améliore l’eau.', 'Un traitement antibactérien peut être tenté mais le pronostic est réservé.', 'Évite la propagation : retire le poisson mort rapidement.']
				},
				{ warn: 'Le pronostic est souvent mauvais. Si le poisson souffre beaucoup, l’euthanasie douce, avec une solution d’huile de girofle, est une option plus respectueuse.' }
			],
			related: ['sante/prevenir']
		},
		{
			slug: 'vessie-natatoire',
			title: 'Troubles de la vessie natatoire',
			summary: 'Poisson qui flotte, coule ou nage de travers.',
			level: 'intermediaire',
			minutes: 3,
			blocks: [
				{
					h: 'Symptômes',
					list: ['Nage de travers, à l’envers, ou reste au fond ou à la surface.', 'Plus fréquent chez les poissons rouges à corps rond et les bettas.']
				},
				{
					h: 'Causes',
					list: ['Constipation, suralimentation, nourriture sèche qui gonfle.', 'Eau trop froide.', 'Infection ou malformation.']
				},
				{
					h: 'Que faire',
					list: ['Mets le poisson à jeun 2 à 3 jours.', 'Propose un petit pois épluché et écrasé.', 'Vérifie la qualité de l’eau et la température.', 'Trempe les granulés avant de les distribuer.']
				}
			],
			related: ['vivre/nourrir']
		},
		{
			slug: 'parasites-internes',
			title: 'Vers et parasites internes',
			summary: 'Poisson qui maigrit alors qu’il mange, excréments filandreux.',
			level: 'avance',
			minutes: 3,
			blocks: [
				{
					h: 'Symptômes',
					list: ['Amaigrissement malgré l’appétit.', 'Excréments blancs, filandreux.', 'Ventre creux, yeux enfoncés.']
				},
				{
					h: 'Que faire',
					p: ['Un antiparasitaire interne à administrer dans la nourriture, selon la notice ou l’avis d’un professionnel. Traite tout le groupe. Améliore la nourriture pour que les poissons reprennent des forces.']
				},
				{ tip: 'Un poisson maigre peut aussi être victime de la concurrence pour la nourriture. Observe les repas.' }
			],
			related: ['sante/quarantaine']
		},
		{
			slug: 'ammoniac-nitrites',
			title: 'Intoxication à l’ammoniac ou aux nitrites',
			summary: 'La cause la plus fréquente de mort dans un bac jeune.',
			level: 'debutant',
			minutes: 3,
			blocks: [
				{
					h: 'Symptômes',
					list: ['Respiration rapide, poissons à la surface.', 'Branchies rouges ou brunâtres (nitrites).', 'Léthargie, perte d’appétit.']
				},
				{
					h: 'Urgence : que faire tout de suite',
					steps: ['Teste l’ammoniac et les nitrites.', 'Change 50 % de l’eau avec de l’eau conditionnée, à la même température.', 'Recommence le lendemain si les valeurs restent hautes.', 'Arrête de nourrir 24 heures.', 'Aère le bac.']
				},
				{ tip: 'Du sel (1 à 3 g/L) limite la toxicité des nitrites, si tes poissons le tolèrent. N’en mets pas dans un bac planté sans te renseigner.' },
				{ warn: 'N’utilise pas de produit qui « neutralise » durablement l’ammoniac en guise de solution : ils masquent le problème. Corrige la cause (surpopulation, filtre).' }
			],
			related: ['demarrer/cycle-azote', 'entretien/changement-eau']
		},
		{
			slug: 'trou-dans-la-tete',
			title: 'Trous dans la tête et lignes latérales',
			summary: 'Dépigmentation puis érosion autour de la tête, courante chez les discus et les cichlidés.',
			level: 'avance',
			minutes: 3,
			blocks: [
				{
					h: 'Symptômes',
					list: ['Petites fosses blanches sur la tête, puis lésions.', 'Excréments filandreux.', 'Perte d’appétit.']
				},
				{
					h: 'Causes possibles',
					list: ['Eau de mauvaise qualité, nitrates élevés.', 'Alimentation pauvre ou monotone.', 'Parasites (hexamita).']
				},
				{
					h: 'Que faire',
					p: ['Améliore l’eau avec des changements fréquents et varie l’alimentation. Un traitement antiparasitaire peut être nécessaire. Consulte un spécialiste pour les discus.']
				}
			],
			related: ['sante/prevenir']
		},
		{
			slug: 'mort-dun-poisson',
			title: 'Un poisson est mort : que faire ?',
			summary: 'Réagir calmement, comprendre pourquoi, protéger les autres.',
			level: 'debutant',
			minutes: 3,
			blocks: [
				{
					steps: [
						'Retire le poisson rapidement pour éviter la pollution et la contamination.',
						'Teste l’eau : ammoniac, nitrites, nitrates, pH, température.',
						'Observe les autres poissons : comportement, peau, appétit.',
						'Change 30 à 50 % d’eau si les valeurs sont mauvaises.',
						'Cherche la cause : eau, intimidation, maladie, âge.'
					]
				},
				{ tip: 'Note l’événement dans le journal du bac : en cherchant plus tard, tu retrouveras les dates et les valeurs.' }
			],
			related: ['sante/ammoniac-nitrites']
		}
	]
};

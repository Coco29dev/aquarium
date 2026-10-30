import type { Theme } from './types';

export const ENTRETIEN: Theme = {
	slug: 'entretien',
	title: 'Entretien du bac',
	summary: 'Changements d’eau, filtre, algues, vacances : la routine qui garde un bac sain.',
	icon: 'drop',
	color: 'var(--teal)',
	guides: [
		{
			slug: 'routine',
			title: 'Une routine d’entretien simple',
			summary: 'Ce qu’il faut faire chaque jour, chaque semaine, chaque mois.',
			level: 'debutant',
			minutes: 3,
			blocks: [
				{
					h: 'Chaque jour',
					list: ['Regarde les poissons : nage, couleurs, appétit.', 'Vérifie la température et le bon fonctionnement du filtre.', 'Nourris avec parcimonie : ce qui est mangé en deux minutes.']
				},
				{
					h: 'Chaque semaine',
					list: ['Change 20 à 30 % de l’eau en aspirant le sol.', 'Teste les nitrates (et au besoin les autres paramètres).', 'Nettoie la vitre avant.', 'Taille et retire les feuilles mortes.']
				},
				{
					h: 'Chaque mois',
					list: ['Rince le matériau de filtration dans l’eau du bac.', 'Contrôle le chauffage, les tuyaux et le joint des pompes.', 'Vérifie l’éclairage et l’état des tubes ou des LED.']
				},
				{ tip: 'Dans l’app, crée une tâche récurrente pour chaque rendez-vous : tu reçois un rappel et le journal garde l’historique.' }
			],
			related: ['entretien/changement-eau', 'entretien/filtre']
		},
		{
			slug: 'changement-eau',
			title: 'Changer l’eau comme il faut',
			summary: 'Quelle quantité, à quelle fréquence, et les erreurs à éviter.',
			level: 'debutant',
			minutes: 4,
			blocks: [
				{
					h: 'Pourquoi',
					p: ['Les changements d’eau évacuent les nitrates et renouvellent les minéraux. Aucun filtre ne les élimine seul.']
				},
				{
					h: 'Combien et à quelle fréquence',
					list: [
						'Bac de communauté bien planté : 20 à 30 % par semaine.',
						'Bac peu planté ou très peuplé : 30 à 50 % par semaine.',
						'Cichlidés d’eau dure, discus : plus souvent, parfois plusieurs fois par semaine.',
						'En cas de problème (ammoniac, nitrites) : 50 % tout de suite, puis réévalue.'
					]
				},
				{
					h: 'La procédure',
					steps: [
						'Débranche le chauffage si le niveau descend en dessous.',
						'Aspire l’eau en passant le tuyau sur le sol, sans enfoncer dans le sable.',
						'Prépare l’eau neuve à la même température (écart de moins de 2 °C) avec le conditionneur.',
						'Verse-la doucement, avec une assiette ou un seau à débit lent.',
						'Rebranche le chauffage.'
					]
				},
				{ warn: 'Évite de changer plus de 50 % d’un coup dans un bac peuplé, sauf urgence : les variations de dureté et de pH stressent les poissons.' }
			],
			related: ['demarrer/eau-robinet', 'entretien/routine'],
			tool: { label: 'Calculer un changement d’eau', href: '/outils' }
		},
		{
			slug: 'filtre',
			title: 'Entretenir le filtre',
			summary: 'Rincer sans détruire les bactéries utiles.',
			level: 'debutant',
			minutes: 3,
			blocks: [
				{
					p: ['Le filtre n’est pas un nettoyeur : il retient les déchets et héberge les bactéries. Un entretien trop zélé le rend inefficace ; pas d’entretien le colmate.']
				},
				{
					h: 'Quand',
					p: ['Tous les 1 à 2 mois, ou quand le débit baisse nettement.']
				},
				{
					h: 'Comment',
					steps: [
						'Prépare un seau avec de l’eau du bac prélevée pendant un changement d’eau.',
						'Rince les mousses et les matériaux dans cette eau, en les pressant doucement.',
						'Ne remplace jamais tous les matériaux d’un coup : garde au moins la moitié.',
						'Nettoie la turbine et les tuyaux avec une brosse.',
						'Remonte et relance.'
					]
				},
				{ warn: 'Ne rince pas les matériaux à l’eau du robinet : le chlore tue les bactéries.' },
				{ tip: 'Les charbons actifs s’épuisent en quelques semaines. Ils ne sont utiles qu’en cas de traitement à retirer.' }
			],
			related: ['demarrer/cycle-azote']
		},
		{
			slug: 'vitres-decor',
			title: 'Vitres, sol et décor',
			summary: 'Nettoyer sans bouleverser l’équilibre.',
			level: 'debutant',
			minutes: 3,
			blocks: [
				{
					h: 'Les vitres',
					p: ['Nettoie l’intérieur avec une raclette à lame ou une éponge réservée à l’aquarium. Pas de produit ménager. Un grain de sable coincé sous la lame raye la vitre : rince-la souvent.']
				},
				{
					h: 'Le sol',
					p: ['Aspire au tuyau pendant le changement d’eau, par zones, sans tout nettoyer d’un coup. Dans un bac planté, ne fouille pas les racines.']
				},
				{
					h: 'Le décor',
					p: ['Brosse les roches et les bois dans l’eau du bac. Ne les laisse pas tremper dans l’eau chlorée.']
				},
				{ tip: 'Quelques escargots ou crevettes aident à garder le décor propre, mais ne remplacent pas ton entretien.' }
			],
			related: ['entretien/algues']
		},
		{
			slug: 'tests',
			title: 'Tester l’eau : quoi, quand, comment',
			summary: 'Les bons réflexes pour des mesures fiables.',
			level: 'debutant',
			minutes: 3,
			blocks: [
				{
					h: 'Fréquence',
					list: [
						'Bac neuf ou en cyclage : ammoniac, nitrites, nitrates tous les 2 à 3 jours.',
						'Bac stable : nitrates et pH une fois par semaine ou par quinzaine.',
						'Après un incident (mort de poisson, médicament, nouvel arrivage) : tests complets.'
					]
				},
				{
					h: 'Pour des mesures fiables',
					list: [
						'Prélève l’eau toujours au même endroit, loin de la sortie du filtre.',
						'Respecte le temps de lecture indiqué.',
						'Lis les couleurs à la lumière du jour, sur fond blanc.',
						'Agite bien les flacons de nitrates avant usage.'
					]
				},
				{ tip: 'Note chaque mesure dans l’app : les tendances comptent plus que les valeurs isolées.' }
			],
			related: ['demarrer/parametres']
		},
		{
			slug: 'vacances',
			title: 'Partir en vacances',
			summary: 'Laisser son bac quelques jours ou quelques semaines.',
			level: 'debutant',
			minutes: 3,
			blocks: [
				{
					h: 'Jusqu’à une semaine',
					p: ['Un poisson adulte bien nourri supporte une semaine sans manger. Ne donne pas un repas copieux avant de partir. Fais un changement d’eau la veille.']
				},
				{
					h: 'Plus longtemps',
					list: ['Demande à quelqu’un de nourrir avec des portions pré-comptées (piluliers).', 'Utilise un distributeur automatique, testé plusieurs jours avant.', 'Les blocs de vacances se dissolvent mal et salissent l’eau : à éviter.']
				},
				{ tip: 'Un minuteur sur l’éclairage maintient le cycle jour/nuit. Vérifie le chauffage avant de partir.' }
			],
			related: ['entretien/chaleur-froid']
		},
		{
			slug: 'chaleur-froid',
			title: 'Chaleur d’été et coupure de courant',
			summary: 'Que faire quand la température sort de la plage.',
			level: 'intermediaire',
			minutes: 3,
			blocks: [
				{
					h: 'Canicule',
					list: ['Enlève le couvercle ou ouvre-le, ajoute un ventilateur qui souffle sur l’eau.', 'Éteins l’éclairage aux heures chaudes.', 'Ne glace pas le bac : change plutôt 10 à 20 % d’eau légèrement plus fraîche.', 'Augmente l’oxygénation (bulleur, sortie de filtre en surface).']
				},
				{
					h: 'Coupure de courant',
					list: ['Laisse le couvercle fermé et couvre le bac avec une couverture : l’eau garde sa chaleur plusieurs heures.', 'Un bulleur sur piles évite le manque d’oxygène.', 'À la remise en route, relance le filtre et vérifie ammoniac et nitrites.']
				},
				{ tip: 'Dans l’app, les alertes de température se déclenchent dès que la plage est dépassée.' }
			],
			related: ['entretien/vacances']
		},
		{
			slug: 'algues',
			title: 'Comprendre et gérer les algues',
			summary: 'Chaque type d’algue raconte un déséquilibre. Voilà comment les lire.',
			level: 'intermediaire',
			minutes: 6,
			blocks: [
				{
					p: ['Les algues sont normales dans un bac. Elles posent problème quand elles envahissent : c’est le signe d’un déséquilibre entre lumière, nutriments et plantes.']
				},
				{
					h: 'Algues vertes sur les vitres',
					p: ['Lumière trop forte ou trop longue. Réduis à 7 ou 8 heures, ajoute des plantes à croissance rapide et nettoie la vitre.']
				},
				{
					h: 'Algues brunes (diatomées)',
					p: ['Fréquentes dans un bac neuf. Elles disparaissent avec la maturité du bac. Un mangeur d’algues comme un otocinclus ou une néritine aide.']
				},
				{
					h: 'Algues en pinceau et barbe noire',
					p: ['Souvent liées à un manque de CO₂ ou à des nutriments instables. Réduis les nutriments, stabilise la fertilisation et taille les feuilles touchées.']
				},
				{
					h: 'Cyanobactéries (voile bleu-vert gluant)',
					p: ['Associées à une eau stagnante et riche en matière organique. Aspire-les, augmente le brassage, réduis la nourriture et change l’eau plus souvent.']
				},
				{
					h: 'Algues filamenteuses',
					p: ['Elles s’installent quand les plantes poussent mal. Retire-les à la main (en les enroulant sur une brosse), puis améliore la croissance des plantes.']
				},
				{ warn: 'Ne mets pas d’anti-algues chimique dans un bac planté : il peut tuer plantes et invertébrés. Corrige la cause.' }
			],
			related: ['plantes/lumiere', 'plantes/substrat-engrais']
		},
		{
			slug: 'eau-trouble',
			title: 'Eau trouble ou laiteuse',
			summary: 'D’où vient le trouble, et que faire.',
			level: 'debutant',
			minutes: 3,
			blocks: [
				{
					h: 'Blanc laiteux dans un bac neuf',
					p: ['Un développement de bactéries, normal pendant le cyclage. Ne change pas tout : laisse le bac se stabiliser.']
				},
				{
					h: 'Vert',
					p: ['Algues en suspension : trop de lumière, trop de nutriments. Couvre le bac quelques jours, réduis l’éclairage et change de l’eau. Un filtre UV ou un floculant peut aider.']
				},
				{
					h: 'Jaune ou brun',
					p: ['Tanins du bois flotté. Inoffensifs, ils acidifient légèrement l’eau. Un charbon actif ou des changements d’eau les atténuent.']
				},
				{
					h: 'Blanc après un changement',
					p: ['Poussière du sol mal rincé ou sable remué. Laisse le filtre travailler quelques heures.']
				}
			],
			related: ['entretien/algues']
		}
	]
};

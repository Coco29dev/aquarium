import type { Theme } from './types';

export const PLANTES: Theme = {
	slug: 'plantes',
	title: 'Plantes d’aquarium',
	summary: 'Lumière, substrat, CO₂, taille : cultiver des plantes sans galère.',
	icon: 'leaf',
	color: 'var(--green)',
	guides: [
		{
			slug: 'debuter',
			title: 'Débuter avec les plantes',
			summary: 'Quelles plantes choisir quand on commence, et comment les installer.',
			level: 'debutant',
			minutes: 4,
			blocks: [
				{
					h: 'Commence par des plantes faciles',
					p: ['Anubias, fougère de Java, cryptocorynes, vallisnéries, hygrophila et cornifle poussent sans CO₂ ni fertilisation lourde. Elles pardonnent beaucoup d’erreurs.']
				},
				{
					h: 'Planter',
					list: [
						'Plantes à tiges : enfonce le bas dans le sol, retire les feuilles du bas.',
						'Plantes à rosette : ne recouvre pas le cœur de la plante.',
						'Rhizomes (anubias, fougère) : fixe-les sur un bois ou une roche, sans les enterrer.',
						'Mousses : fixe-les avec du fil ou de la colle cyanoacrylate gel.'
					]
				},
				{ tip: 'Plante dense dès le départ : des plantes nombreuses limitent les algues en consommant les nutriments.' },
				{ warn: 'Mets les plantes neuves en quarantaine quelques jours : elles peuvent apporter escargots, algues ou résidus de traitement.' }
			],
			related: ['plantes/lumiere', 'plantes/substrat-engrais']
		},
		{
			slug: 'lumiere',
			title: 'La lumière : intensité et durée',
			summary: 'Trop ou trop peu : l’éclairage fait le succès d’un bac planté.',
			level: 'debutant',
			minutes: 3,
			blocks: [
				{
					h: 'Intensité',
					list: ['Faible : anubias, fougères, cryptocorynes, mousses.', 'Moyenne : vallisnéries, sagittaires, échinodorus, hygrophila.', 'Forte : plantes de tapis, rotala, plantes rouges. Elle impose CO₂ et fertilisation.']
				},
				{
					h: 'Durée',
					p: ['7 à 9 heures par jour suffisent. Un minuteur garde un rythme régulier. Une pause de midi de 2 à 3 heures réduit parfois les algues.']
				},
				{ tip: 'Quand tu augmentes la lumière, augmente progressivement les nutriments et le CO₂, sinon les algues prennent le dessus.' }
			],
			related: ['plantes/co2', 'entretien/algues']
		},
		{
			slug: 'substrat-engrais',
			title: 'Substrat et fertilisation',
			summary: 'Nourrir les plantes par les racines et par l’eau.',
			level: 'intermediaire',
			minutes: 4,
			blocks: [
				{
					h: 'Le substrat',
					p: ['Un sol nutritif (terre ou substrat commercial) sous 2 à 3 cm de sable ou de gravier fin nourrit les plantes à racines (échinodorus, cryptocorynes, vallisnéries). Un sol inerte demande des pastilles d’engrais racinaire.']
				},
				{
					h: 'Les engrais liquides',
					list: [
						'Macro-éléments : azote, phosphore, potassium. Les nitrates du bac en fournissent déjà.',
						'Micro-éléments et fer : pour les couleurs, surtout les plantes rouges.',
						'Dose : commence par la moitié de la dose indiquée et ajuste selon la croissance et les algues.'
					]
				},
				{ warn: 'Les engrais du commerce destinés aux plantes d’intérieur ne conviennent pas : ils contiennent souvent du cuivre, toxique pour les crevettes et escargots.' }
			],
			related: ['plantes/carences']
		},
		{
			slug: 'co2',
			title: 'Le CO₂ : utile, pas obligatoire',
			summary: 'Quand l’ajouter, comment le doser, quels risques.',
			level: 'avance',
			minutes: 4,
			blocks: [
				{
					p: ['Le CO₂ accélère la croissance et permet les plantes exigeantes. Il demande de la rigueur : un diffuseur, une régulation et un contrôle du pH ou d’un test de CO₂.']
				},
				{
					h: 'Repères',
					list: ['Cible : 20 à 30 mg/L de CO₂ dissous (test de goutte vert pâle).', 'Démarre doucement, quelques bulles par seconde, et augmente sur plusieurs jours.', 'Coupe le CO₂ la nuit ou une heure avant l’extinction.', 'Un bon brassage de surface évite le manque d’oxygène.']
				},
				{ warn: 'Trop de CO₂ asphyxie les poissons : s’ils restent en surface, coupe le CO₂ et aère le bac. Surveille les poissons les premiers jours.' },
				{ tip: 'Sans CO₂, choisis des plantes à faible exigence et une lumière modérée : le bac sera tout aussi beau.' }
			],
			related: ['plantes/lumiere']
		},
		{
			slug: 'taille-bouturage',
			title: 'Tailler et bouturer',
			summary: 'Garder des plantes denses et en forme.',
			level: 'intermediaire',
			minutes: 3,
			blocks: [
				{
					h: 'Plantes à tiges',
					p: ['Coupe la tête de la tige et replante-la ; la base repousse avec plusieurs nouvelles tiges. Retire les parties dénudées.']
				},
				{
					h: 'Plantes à rosette ou à stolons',
					p: ['Coupe les feuilles abîmées à la base. Sépare les stolons en plantules quand elles ont quelques feuilles.']
				},
				{
					h: 'Tapis',
					p: ['Taille régulièrement pour éviter l’étouffement et les algues. Retire ce que tu as coupé avec une épuisette.']
				},
				{ tip: 'Les boutures sont un excellent cadeau ou une monnaie d’échange dans les clubs d’aquariophilie.' }
			],
			related: ['plantes/debuter']
		},
		{
			slug: 'flottantes-mousses',
			title: 'Plantes flottantes et mousses',
			summary: 'Ombre, abris et épuration : deux familles faciles et utiles.',
			level: 'debutant',
			minutes: 3,
			blocks: [
				{
					h: 'Les plantes flottantes',
					p: ['Salvinia, limnobium, lentilles d’eau et laitue d’eau absorbent beaucoup de nutriments et ombragent. Les poissons timides les adorent. Limite-les pour ne pas priver les plantes du fond de lumière.']
				},
				{
					h: 'Les mousses',
					p: ['Mousse de Java, mousse de Noël, Fissidens : fixe-les sur du bois ou de la roche. Elles abritent alevins et crevettes. Rince-les de temps en temps pour éviter l’envasement.']
				},
				{ warn: 'Certaines plantes flottantes ou immergées sont envahissantes et interdites à la vente (par exemple la jacinthe d’eau, Cabomba caroliniana, Salvinia molesta). Ne jette jamais de plantes dans la nature.' }
			],
			related: ['plantes/debuter']
		},
		{
			slug: 'carences',
			title: 'Reconnaître les carences',
			summary: 'Ce que racontent les feuilles jaunes, trouées ou noircies.',
			level: 'intermediaire',
			minutes: 4,
			blocks: [
				{
					list: [
						'Feuilles jaunes anciennes, croissance lente : manque d’azote (nitrates trop bas).',
						'Feuilles jaunes nouvelles avec nervures vertes : manque de fer.',
						'Feuilles trouées, bords translucides : manque de potassium.',
						'Feuilles tordues, extrémités fripées : manque de calcium ou de magnésium.',
						'Feuilles pâles et croissance faible malgré la lumière : manque de CO₂.',
						'Plantes qui fondent après installation : adaptation à de nouveaux paramètres, normale pour les cryptocorynes.'
					]
				},
				{ tip: 'Corrige une seule chose à la fois et attends deux semaines avant de juger le résultat.' }
			],
			related: ['plantes/substrat-engrais']
		},
		{
			slug: 'hardscape',
			title: 'Composer un décor',
			summary: 'Bois, roches, sol et plantes : quelques règles de composition.',
			level: 'debutant',
			minutes: 3,
			blocks: [
				{
					list: [
						'Évite de centrer le point focal : place-le au tiers de la largeur du bac.',
						'Grandes plantes à l’arrière, moyennes au milieu, tapis à l’avant.',
						'Utilise un nombre impair de roches de tailles différentes.',
						'Laisse de la place pour nager au milieu.',
						'Teste les roches avec du vinaigre : si elle mousse, elle est calcaire et durcira l’eau.'
					]
				},
				{ tip: 'Trempe le bois flotté dans un seau avant de l’installer, pour qu’il coule et libère ses tanins.' }
			],
			related: ['plantes/debuter']
		}
	]
};

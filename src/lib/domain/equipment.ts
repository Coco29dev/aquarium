import type { Idea, Planting } from './ideas';
import { plantsOf } from './ideas';

// Matériel conseillé pour monter une idée de peuplement, avec une estimation de prix en euros.
// Les prix sont des ordres de grandeur du neuf en France (2026) : ils servent à chiffrer un projet, pas à acheter.

export type EquipmentCategory =
	| 'filtration'
	| 'chauffage'
	| 'eclairage'
	| 'substrat'
	| 'decor'
	| 'eau'
	| 'plantes'
	| 'brassage'
	| 'mesure'
	| 'securite'
	| 'temperature';

export interface EquipmentSuggestion {
	id: string;
	category: EquipmentCategory;
	label: string;
	/** Pourquoi, et quelle taille choisir. */
	detail: string;
	/** Fourchette de prix en euros pour le volume demandé. */
	price: [min: number, max: number];
	/** Indispensable : coché par défaut. Sinon, facultatif et décoché. */
	essential: boolean;
	/** Mots qui permettent de reconnaître un élément déjà présent dans le projet (sans accents, minuscules). */
	keywords: string[];
}

export const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
	filtration: 'Filtration',
	chauffage: 'Chauffage',
	eclairage: 'Éclairage',
	substrat: 'Sol et substrat',
	decor: 'Décor et cachettes',
	eau: 'Eau',
	plantes: 'Plantes',
	brassage: 'Courant et brassage',
	mesure: 'Mesure et tests',
	securite: 'Sécurité',
	temperature: 'Température'
};

const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);
const range = (min: number, max: number): [number, number] => {
	const low = roundTo(min, 5);
	return [low, Math.max(roundTo(max, 5), low + 5)];
};

/** Minuscules sans accents : « Éclairage » et « eclairage » se valent. */
export const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const has = (idea: Idea, ...tags: string[]) => tags.some((t) => idea.tags.includes(t));

/** Tarif par palier de volume : la première ligne dont le seuil dépasse le volume. */
function tier(volumeL: number, rows: [upTo: number, min: number, max: number][]): [number, number] {
	const row = rows.find(([upTo]) => volumeL < upTo) ?? rows[rows.length - 1];
	return range(row[1], row[2]);
}

const freshWater = (idea: Idea) => idea.water === 'douce' || idea.water === 'plantee';

export function equipmentFor(idea: Idea, volumeL: number, planting: Planting): EquipmentSuggestion[] {
	const plants = plantsOf(idea, planting);
	const planted = freshWater(idea) && plants.length > 0;
	const aquascape = has(idea, 'aquascaping');
	const hardWater = idea.conditions.ph[0] >= 7.5;
	const softWater = (idea.conditions.dgh && idea.conditions.dgh[1] <= 6) || idea.conditions.ph[1] < 6.6;
	const list: EquipmentSuggestion[] = [];
	const add = (s: EquipmentSuggestion) => list.push(s);

	if (freshWater(idea)) {
		// --- Eau douce -----------------------------------------------------------------------
		const dense = (idea.dense ?? 1) > 1;
		const flow = Math.round((volumeL * (dense ? 8 : has(idea, 'courant') ? 10 : 5)) / 10) * 10;
		add({
			id: 'filtre',
			category: 'filtration',
			label: volumeL < 60 ? 'Filtre interne ou à éponge' : 'Filtre extérieur',
			detail: `Débit d’environ ${flow} L/h${has(idea, 'crevettes') ? ' ; protège l’aspiration avec une éponge ou une grille fine' : ''}.`,
			price: tier(volumeL, [[40, 15, 35], [120, 60, 130], [300, 110, 260], [700, 250, 550], [Infinity, 450, 1000]]),
			essential: true,
			keywords: ['filtre', 'filtration', 'eheim', 'fluval', 'juwel']
		});
		if (!has(idea, 'sans chauffage')) {
			add({
				id: 'chauffage',
				category: 'chauffage',
				label: 'Chauffage réglable',
				detail: `Environ ${roundTo(volumeL * 0.7, 5)} W pour tenir ${idea.conditions.temp[0]} à ${idea.conditions.temp[1]} °C${volumeL > 350 ? ' (deux appareils, plus sûr)' : ''}.`,
				price: tier(volumeL, [[100, 15, 35], [300, 25, 60], [Infinity, 50, 140]]),
				essential: true,
				keywords: ['chauffage', 'chauffe', 'thermoplongeur']
			});
		}
		add({
			id: 'eclairage',
			category: 'eclairage',
			label: planted ? 'Rampe LED pour plantes' : 'Éclairage LED',
			detail: planted
				? `${aquascape ? 'Forte intensité, ' : 'Intensité moyenne, '}7 à 9 h par jour avec un minuteur. Longueur : celle du bac.`
				: 'Simple éclairage LED de la longueur du bac, avec minuteur.',
			price: planted
				? tier(volumeL, [[100, 40, 110], [250, 70, 200], [500, 140, 420], [Infinity, 300, 800]])
				: tier(volumeL, [[100, 20, 60], [250, 35, 100], [500, 70, 200], [Infinity, 150, 400]]),
			essential: true,
			keywords: ['eclairage', 'lumiere', 'led', 'rampe', 'lampe', 'spot']
		});
		const kg = Math.max(2, Math.round(volumeL / 8));
		const coral = hardWater;
		add({
			id: 'sol',
			category: 'substrat',
			label: coral ? 'Sable corallien ou aragonite' : has(idea, 'fond', 'sable') || (has(idea, 'banc') && !planted) ? 'Sable fin' : 'Gravier fin ou sable',
			detail: `Environ ${kg} kg pour 3 cm d’épaisseur${coral ? ' ; il tamponne l’eau dure et alcaline' : ''}.`,
			price: range(kg * (coral ? 1.4 : 0.8), kg * (coral ? 3 : 2)),
			essential: true,
			keywords: ['sol', 'sable', 'gravier', 'substrat', 'aragonite']
		});
		if (planted && (aquascape || (volumeL >= 100 && plants.some((p) => ['Rotala rotundifolia', 'Ludwigia repens', 'Alternanthera reineckii'].includes(p))))) {
			const litres = Math.max(3, Math.round(volumeL / 8));
			add({
				id: 'sol-nutritif',
				category: 'substrat',
				label: 'Sol nutritif sous le sable',
				detail: `Environ ${litres} L en sous-couche pour nourrir les racines.`,
				price: range(litres * 3, litres * 5),
				essential: aquascape,
				keywords: ['nutritif', 'sol actif', 'terreau']
			});
		}
		add({
			id: 'decor',
			category: 'decor',
			label: has(idea, 'cichlidés') && hardWater ? 'Roches et cachettes' : 'Racines, bois ou roches',
			detail: hardWater
				? 'Roches calcaires ou lisses empilées avec des grottes et des fentes.'
				: has(idea, 'eaux noires') || idea.region.includes('Amazonie')
					? 'Racines et bois, avec des feuilles mortes au sol.'
					: 'Racines, bois flotté ou roches neutres (teste-les au vinaigre : une roche qui mousse durcit l’eau).',
			price: range(10 + volumeL * 0.12, 25 + volumeL * 0.4),
			essential: true,
			keywords: ['decor', 'racine', 'bois', 'roche', 'pierre']
		});
		if (idea.slug === 'tanganyika-coquilles' || idea.slug === 'tanganyika-juliens') {
			add({
				id: 'coquilles',
				category: 'decor',
				label: 'Coquilles d’escargots vides',
				detail: 'Une par poisson et quelques-unes de plus : les petits Tanganyika y habitent.',
				price: range(10, 25),
				essential: true,
				keywords: ['coquille']
			});
		}
		if (has(idea, 'cichlidés nains')) {
			add({
				id: 'grottes',
				category: 'decor',
				label: 'Grottes (noix de coco, petits pots)',
				detail: 'Une cachette par femelle pour qu’elles puissent pondre.',
				price: range(5, 20),
				essential: true,
				keywords: ['grotte', 'noix de coco', 'pot']
			});
		}
		if (has(idea, 'eaux noires')) {
			add({
				id: 'feuilles',
				category: 'eau',
				label: 'Feuilles d’amandier ou de chêne',
				detail: 'Elles teintent l’eau et la rendent plus acide ; à renouveler régulièrement.',
				price: range(6, 15),
				essential: true,
				keywords: ['feuille', 'amandier', 'tourbe']
			});
		}
		if (softWater) {
			add({
				id: 'osmoseur',
				category: 'eau',
				label: 'Eau osmosée (osmoseur) et sels de reminéralisation',
				detail: `Pour viser GH ${idea.conditions.dgh?.[0] ?? 1} à ${idea.conditions.dgh?.[1] ?? 6} °dGH : l’eau du robinet est trop dure. Sans osmoseur, achète l’eau en bidons.`,
				price: range(110, 220),
				essential: true,
				keywords: ['osmos', 'remineral']
			});
		} else if (hardWater) {
			add({
				id: 'durete',
				category: 'eau',
				label: 'Sels de dureté et tampon pH',
				detail: 'Pour garder une eau dure et alcaline stable (GH 10 à 20, pH 7,8 à 8,6).',
				price: range(10, 30),
				essential: false,
				keywords: ['durete', 'tampon', 'sel']
			});
		}
		add({
			id: 'conditionneur',
			category: 'eau',
			label: 'Conditionneur d’eau et bactéries de démarrage',
			detail: 'Neutralise le chlore et amorce le cycle de l’azote.',
			price: range(15, 35),
			essential: true,
			keywords: ['conditionneur', 'anti-chlore', 'bacterie']
		});
		add({
			id: 'tests',
			category: 'mesure',
			label: 'Tests d’eau (pH, GH/KH, nitrites, nitrates) et thermomètre',
			detail: 'Indispensables pour suivre le cyclage et les changements d’eau.',
			price: range(30, 60),
			essential: true,
			keywords: ['test', 'thermometre', 'kit']
		});
		if (planted) {
			add({
				id: 'engrais',
				category: 'plantes',
				label: 'Engrais liquide complet',
				detail: aquascape ? 'Engrais complet avec macro et micro-éléments, dosé chaque semaine.' : 'Un flacon d’engrais pour plantes d’aquarium : la moitié de la dose au départ.',
				price: range(10, aquascape ? 35 : 20),
				essential: aquascape,
				keywords: ['engrais', 'fertilis']
			});
		}
		if (aquascape) {
			add({
				id: 'co2',
				category: 'plantes',
				label: 'Kit CO₂ (bouteille, détendeur, diffuseur)',
				detail: 'Pour un bac à lumière forte et plantes exigeantes. Prévois un test de CO₂ (goutte).',
				price: range(120, 350),
				essential: false,
				keywords: ['co2', 'detendeur']
			});
		}
		if (has(idea, 'courant') || (has(idea, 'actif') && volumeL >= 150)) {
			add({
				id: 'brassage',
				category: 'brassage',
				label: 'Pompe de brassage',
				detail: has(idea, 'courant') ? 'Crée le courant de rivière que ces poissons recherchent.' : 'Maintient l’eau en mouvement pour ces nageurs.',
				price: tier(volumeL, [[150, 25, 60], [400, 40, 110], [Infinity, 70, 200]]),
				essential: has(idea, 'courant'),
				keywords: ['pompe', 'brassage', 'courant']
			});
		}
		if (has(idea, 'killis', 'surface') || idea.stock.some(([, , r]) => r === 'surface') || idea.slug === 'torrent-asiatique' || idea.slug === 'killi-annuel') {
			add({
				id: 'couvercle',
				category: 'securite',
				label: 'Couvercle ou vitre de fermeture',
				detail: 'Ces poissons sautent : le bac doit être fermé, sans fente.',
				price: tier(volumeL, [[100, 15, 45], [300, 35, 110], [Infinity, 80, 260]]),
				essential: true,
				keywords: ['couvercle', 'vitre de fermeture', 'cache']
			});
		}
		if ((idea.conditions.temp[1] <= 24 && !has(idea, 'sans chauffage')) || idea.slug === 'torrent-asiatique') {
			add({
				id: 'refroidissement',
				category: 'temperature',
				label: 'Ventilateur de bac (ou refroidisseur)',
				detail: 'Garde l’eau sous 24 °C en été ; au-delà de 150 L, un refroidisseur est plus sûr.',
				price: volumeL < 150 ? range(15, 40) : range(180, 450),
				essential: false,
				keywords: ['ventilateur', 'refroidisseur']
			});
		}
		if (has(idea, 'crevettes') && volumeL < 120) {
			add({
				id: 'prefiltre',
				category: 'filtration',
				label: 'Éponge ou grille de protection d’aspiration',
				detail: 'Évite que les bébés crevettes soient aspirés.',
				price: range(5, 15),
				essential: true,
				keywords: ['eponge', 'grille', 'prefiltre']
			});
		}
		add({
			id: 'minuteur',
			category: 'eclairage',
			label: 'Minuteur électrique',
			detail: 'Régularise la durée d’éclairage (7 à 9 h) et limite les algues.',
			price: range(8, 20),
			essential: false,
			keywords: ['minuteur', 'programmateur']
		});
	} else {
		// --- Mer et récif ----------------------------------------------------------------------
		const reef = idea.water === 'recif';
		const coralHeavy = has(idea, 'SPS', 'LPS');
		add({
			id: 'ecumeur',
			category: 'filtration',
			label: 'Écumeur',
			detail: `Dimensionné pour au moins ${roundTo(volumeL * 1.5, 50)} L${reef ? ' (marge pour un récif)' : ''}.`,
			price: tier(volumeL, [[100, 60, 150], [250, 130, 320], [500, 250, 600], [1000, 450, 1100], [Infinity, 900, 2200]]),
			essential: true,
			keywords: ['ecumeur']
		});
		add({
			id: 'brassage',
			category: 'brassage',
			label: 'Pompes de brassage',
			detail: `Débit total d’environ ${roundTo(volumeL * (coralHeavy ? 20 : 10), 100)} L/h, réparti en deux pompes.`,
			price: tier(volumeL, [[100, 50, 110], [250, 100, 220], [500, 180, 400], [Infinity, 350, 900]]),
			essential: true,
			keywords: ['pompe', 'brassage', 'courant']
		});
		add({
			id: 'chauffage',
			category: 'chauffage',
			label: 'Chauffage réglable',
			detail: `Environ ${roundTo(volumeL * 0.7, 5)} W pour tenir ${idea.conditions.temp[0]} à ${idea.conditions.temp[1]} °C.`,
			price: tier(volumeL, [[100, 20, 50], [300, 35, 90], [Infinity, 70, 200]]),
			essential: true,
			keywords: ['chauffage', 'chauffe', 'thermoplongeur']
		});
		add({
			id: 'eclairage',
			category: 'eclairage',
			label: reef ? 'Éclairage LED récif' : 'Éclairage LED',
			detail: reef ? (coralHeavy ? 'Forte puissance, spectre bleu, variateur et programmation.' : 'Éclairage récif réglable, avec programmation du lever et du coucher.') : 'Simple éclairage blanc/bleu avec minuteur.',
			price: reef
				? tier(volumeL, [[100, 120, 380], [250, 280, 800], [500, 600, 1800], [Infinity, 1200, 3500]])
				: tier(volumeL, [[250, 50, 180], [600, 120, 400], [Infinity, 250, 900]]),
			essential: true,
			keywords: ['eclairage', 'lumiere', 'led', 'rampe']
		});
		const rockKg = Math.max(4, Math.round(volumeL / (reef ? 7 : 10)));
		add({
			id: 'roche',
			category: 'decor',
			label: 'Roche vive (ou roche sèche)',
			detail: `Environ ${rockKg} kg, soit un à deux kilos pour dix litres : elle sert de filtre biologique et de décor.`,
			price: range(rockKg * 7, rockKg * 14),
			essential: true,
			keywords: ['roche']
		});
		const sandKg = Math.max(4, Math.round(volumeL / 10));
		add({
			id: 'sable',
			category: 'substrat',
			label: 'Sable d’aragonite',
			detail: `Environ ${sandKg} kg pour 2 à 4 cm d’épaisseur.`,
			price: range(sandKg * 2, sandKg * 4),
			essential: true,
			keywords: ['sable', 'aragonite', 'sol']
		});
		add({
			id: 'osmoseur',
			category: 'eau',
			label: 'Osmoseur',
			detail: 'Indispensable pour l’eau de remise à niveau et la préparation de l’eau de mer.',
			price: range(120, 250),
			essential: true,
			keywords: ['osmos']
		});
		const saltKg = Math.round(volumeL * 0.035);
		add({
			id: 'sel',
			category: 'eau',
			label: 'Sel marin de qualité récif',
			detail: `Environ ${saltKg} kg pour le premier remplissage, puis pour les changements d’eau.`,
			price: range(saltKg * 2, saltKg * 4),
			essential: true,
			keywords: ['sel']
		});
		add({
			id: 'refractometre',
			category: 'mesure',
			label: 'Réfractomètre',
			detail: 'Mesure la salinité (densité 1,024 à 1,026) avec précision.',
			price: range(15, 70),
			essential: true,
			keywords: ['refractometre', 'densimetre']
		});
		add({
			id: 'tests',
			category: 'mesure',
			label: reef ? 'Tests (KH, calcium, magnésium, nitrates, phosphates)' : 'Tests (nitrites, nitrates, KH)',
			detail: reef ? 'Les coraux demandent un suivi hebdomadaire des éléments majeurs.' : 'Suivre le cycle de l’azote et la stabilité.',
			price: reef ? range(60, 150) : range(25, 60),
			essential: true,
			keywords: ['test', 'kit']
		});
		if (coralHeavy) {
			add({
				id: 'dosage',
				category: 'plantes',
				label: 'Dosage de calcium, magnésium et alcalinité',
				detail: 'Les coraux durs consomment ces éléments : pompes doseuses ou réacteur à calcaire.',
				price: range(150, 500),
				essential: has(idea, 'SPS'),
				keywords: ['dosage', 'doseuse', 'reacteur']
			});
		}
		if (idea.slug === 'hippocampes') {
			add({
				id: 'refroidisseur',
				category: 'temperature',
				label: 'Ventilateur ou refroidisseur',
				detail: 'Les hippocampes supportent mal plus de 25 °C : refroidis l’eau en été.',
				price: range(25, 120),
				essential: true,
				keywords: ['ventilateur', 'refroidisseur']
			});
		}
		add({
			id: 'couvercle',
			category: 'securite',
			label: 'Couvercle ou filet',
			detail: 'Évite les sauts de poissons et limite l’évaporation.',
			price: tier(volumeL, [[250, 20, 90], [Infinity, 60, 220]]),
			essential: true,
			keywords: ['couvercle', 'filet', 'vitre']
		});
		if (planting === 'mixte' && plants.length) {
			add({
				id: 'refuge',
				category: 'plantes',
				label: 'Macro-algues et lumière de refuge',
				detail: 'Chaetomorpha dans un bac annexe éclairé : elle consomme nitrates et phosphates.',
				price: range(25, 90),
				essential: false,
				keywords: ['refuge', 'algue', 'chaeto']
			});
		}
	}
	return list;
}

/** Une suggestion est « déjà là » si un élément du projet porte un de ses mots-clés. */
export function isOwned(suggestion: EquipmentSuggestion, items: { label: string }[]): boolean {
	return items.some((item) => {
		const label = fold(item.label);
		return suggestion.keywords.some((k) => label.includes(k));
	});
}

export function totalOf(selected: Pick<EquipmentSuggestion, 'price'>[]): [number, number] {
	return selected.reduce<[number, number]>((t, s) => [t[0] + s.price[0], t[1] + s.price[1]], [0, 0]);
}

/** Valeur retenue pour le budget du projet : le milieu de la fourchette, arrondi à 5 €. */
export const midPrice = (s: Pick<EquipmentSuggestion, 'price'>) => roundTo((s.price[0] + s.price[1]) / 2, 5);

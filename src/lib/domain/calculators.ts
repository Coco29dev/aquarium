// Calculateurs d'aquariophilie. Fonctions pures, unités métriques (L, cm, mg/L, °dGH, ppt).

export class CalcError extends Error {}

function positive(value: number, label: string): void {
	if (!Number.isFinite(value) || value <= 0) throw new CalcError(`${label} doit être supérieur à 0.`);
}
function nonNegative(value: number, label: string): void {
	if (!Number.isFinite(value) || value < 0) throw new CalcError(`${label} doit être positif ou nul.`);
}

const round = (value: number, decimals = 2) => {
	const f = 10 ** decimals;
	return Math.round(value * f) / f;
};

// --- Volume réel -----------------------------------------------------------

export interface RealVolumeInput {
	lengthCm: number;
	widthCm: number;
	heightCm: number;
	glassMm: number;
	/** Distance entre le niveau d'eau et le haut de la cuve. */
	freeboardCm: number;
	/** Volume occupé par sol, roches, décor (litres). */
	displacedL: number;
}

export function realVolume(i: RealVolumeInput) {
	positive(i.lengthCm, 'La longueur');
	positive(i.widthCm, 'La largeur');
	positive(i.heightCm, 'La hauteur');
	nonNegative(i.glassMm, "L'épaisseur du verre");
	nonNegative(i.freeboardCm, 'La marge au-dessus du niveau');
	nonNegative(i.displacedL, 'Le volume du décor');

	const glassCm = i.glassMm / 10;
	const innerLength = i.lengthCm - 2 * glassCm;
	const innerWidth = i.widthCm - 2 * glassCm;
	const waterHeight = i.heightCm - glassCm - i.freeboardCm;
	if (innerLength <= 0 || innerWidth <= 0 || waterHeight <= 0) {
		throw new CalcError('Dimensions incohérentes : le verre et la marge laissent un volume nul.');
	}
	const grossL = (i.lengthCm * i.widthCm * i.heightCm) / 1000;
	const waterL = (innerLength * innerWidth * waterHeight) / 1000;
	const netL = waterL - i.displacedL;
	if (netL <= 0) throw new CalcError('Le décor occupe plus que le volume d’eau.');
	return { grossL: round(grossL, 1), waterL: round(waterL, 1), netL: round(netL, 1) };
}

// --- Changement d'eau ------------------------------------------------------

export function waterChangeLitres(volumeL: number, percent: number) {
	positive(volumeL, 'Le volume');
	if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
		throw new CalcError('Le pourcentage doit être compris entre 0 et 100.');
	}
	return { litres: round((volumeL * percent) / 100, 1) };
}

/** Valeur obtenue après avoir remplacé `percent` % de l'eau par une eau à `freshValue`. */
export function afterWaterChange(current: number, freshValue: number, percent: number): number {
	return round(current * (1 - percent / 100) + freshValue * (percent / 100), 2);
}

/** Pourcentage à changer pour passer de `current` à `target` avec une eau neuve à `fresh`. */
export function percentToReach(current: number, target: number, fresh: number, volumeL: number) {
	positive(volumeL, 'Le volume');
	nonNegative(current, 'La valeur actuelle');
	nonNegative(target, 'La valeur cible');
	nonNegative(fresh, "La valeur de l'eau neuve");
	if (target >= current) throw new CalcError('La cible doit être inférieure à la valeur actuelle.');
	if (fresh >= target) throw new CalcError("L'eau neuve doit être plus basse que la cible, sinon elle est inatteignable.");
	const fraction = (current - target) / (current - fresh);
	return { percent: round(fraction * 100, 1), litres: round(fraction * volumeL, 1) };
}

// --- Dosage ----------------------------------------------------------------

/**
 * Dose d'un produit pour relever un paramètre.
 * `concentration` : quantité de paramètre apportée par mL de produit pour 1 L d'eau
 * (ex. « 1 mL fait monter le KH de 0,5 °dKH dans 100 L » → 0,5 × 100 = 50 par mL).
 * On raisonne donc en « unités × litres par mL ».
 */
export function dosageMl(volumeL: number, increase: number, unitsLitresPerMl: number) {
	positive(volumeL, 'Le volume');
	positive(increase, "L'augmentation visée");
	positive(unitsLitresPerMl, 'La puissance du produit');
	return { ml: round((increase * volumeL) / unitsLitresPerMl, 2) };
}

/** Effet d'une dose donnée dans un volume donné. */
export function dosageEffect(volumeL: number, ml: number, unitsLitresPerMl: number) {
	positive(volumeL, 'Le volume');
	positive(ml, 'La dose');
	positive(unitsLitresPerMl, 'La puissance du produit');
	return { increase: round((ml * unitsLitresPerMl) / volumeL, 3) };
}

// --- Reminéralisation ------------------------------------------------------

/** Mélange eau du robinet / eau osmosée pour atteindre une dureté cible. */
export function tapRoMix(volumeL: number, targetGh: number, tapGh: number, roGh = 0) {
	positive(volumeL, 'Le volume');
	nonNegative(targetGh, 'Le GH cible');
	nonNegative(tapGh, 'Le GH du robinet');
	nonNegative(roGh, "Le GH de l'osmose");
	if (tapGh <= roGh) throw new CalcError("L'eau du robinet doit être plus dure que l'osmose.");
	if (targetGh < roGh || targetGh > tapGh) {
		throw new CalcError(`La cible doit être entre ${roGh} et ${tapGh} °dGH pour un simple mélange.`);
	}
	const tapFraction = (targetGh - roGh) / (tapGh - roGh);
	return {
		tapL: round(volumeL * tapFraction, 1),
		roL: round(volumeL * (1 - tapFraction), 1),
		tapPercent: round(tapFraction * 100, 0)
	};
}

/** Sels de reminéralisation pour monter de `fromGh` à `toGh` ; `gramsPerLitrePerDegree` vient du produit. */
export function remineralisation(volumeL: number, fromGh: number, toGh: number, gramsPerLitrePerDegree: number) {
	positive(volumeL, 'Le volume');
	nonNegative(fromGh, 'Le GH de départ');
	positive(gramsPerLitrePerDegree, 'La dose du produit');
	if (toGh <= fromGh) throw new CalcError('Le GH visé doit être supérieur au GH de départ.');
	return { grams: round((toGh - fromGh) * volumeL * gramsPerLitrePerDegree, 1) };
}

// --- Salinité --------------------------------------------------------------

// Approximation linéaire à 25 °C pour l'eau de mer (1,0264 ≈ 35 ppt) : indicative, ±0,5 ppt.
const PPT_PER_SG_UNIT = 35 / 0.0264;

export const sgToPpt = (sg: number) => round((sg - 1) * PPT_PER_SG_UNIT, 1);
export const pptToSg = (ppt: number) => round(1 + ppt / PPT_PER_SG_UNIT, 4);

/** Sel à dissoudre pour préparer `volumeL` d'eau de mer à `targetPpt` (≈ 1 g de sel par ppt et par litre). */
export function saltForBatch(volumeL: number, targetPpt: number) {
	positive(volumeL, 'Le volume');
	positive(targetPpt, 'La salinité visée');
	if (targetPpt > 50) throw new CalcError('Salinité visée irréaliste (> 50 ppt).');
	return { grams: round(volumeL * targetPpt, 0), kg: round((volumeL * targetPpt) / 1000, 2) };
}

/**
 * Pour passer de `currentPpt` à `targetPpt` dans `volumeL`, quantité d'eau à retirer puis à remplacer
 * par de l'eau à `freshPpt` (0 = eau osmosée, pour baisser ; ou eau salée plus forte pour monter).
 */
export function salinityAdjust(volumeL: number, currentPpt: number, targetPpt: number, freshPpt: number) {
	positive(volumeL, 'Le volume');
	nonNegative(currentPpt, 'La salinité actuelle');
	positive(targetPpt, 'La salinité visée');
	nonNegative(freshPpt, "La salinité de l'eau ajoutée");
	if (currentPpt === targetPpt) throw new CalcError('La salinité est déjà à la cible.');
	const lowering = targetPpt < currentPpt;
	if (lowering ? freshPpt >= targetPpt : freshPpt <= targetPpt) {
		throw new CalcError("L'eau ajoutée ne permet pas d'atteindre la cible.");
	}
	const litres = (volumeL * (currentPpt - targetPpt)) / (currentPpt - freshPpt);
	return { replaceL: round(litres, 1), direction: lowering ? ('baisser' as const) : ('monter' as const) };
}

import type { Parameter, WaterType } from './types';

export type ParameterTemplate = Pick<
	Parameter,
	'key' | 'name' | 'unit' | 'min' | 'max' | 'driftPerWeek' | 'decimals' | 'step'
>;

const t = (
	key: string,
	name: string,
	unit: string,
	min: number | null,
	max: number | null,
	driftPerWeek: number | null,
	decimals = 1,
	step = 0.1
): ParameterTemplate => ({ key, name, unit, min, max, driftPerWeek, decimals, step });

const nh3 = t('nh3', 'Ammoniac (NH3/NH4)', 'mg/L', 0, 0.05, null, 2, 0.05);
const no2 = t('no2', 'Nitrites (NO2)', 'mg/L', 0, 0.1, null, 2, 0.05);

// Valeurs de départ raisonnables ; tout reste modifiable aquarium par aquarium.
export const PARAMETER_TEMPLATES: Record<WaterType, ParameterTemplate[]> = {
	douce: [
		t('temp', 'Température', '°C', 22, 26, 2),
		t('ph', 'pH', '', 6.5, 7.8, 0.5, 1, 0.1),
		t('gh', 'GH', '°dGH', 4, 12, 3, 0, 1),
		t('kh', 'KH', '°dKH', 3, 10, 2, 0, 1),
		nh3,
		no2,
		t('no3', 'Nitrates (NO3)', 'mg/L', 0, 40, 20, 0, 5)
	],
	plantee: [
		t('temp', 'Température', '°C', 22, 27, 2),
		t('ph', 'pH', '', 6, 7.2, 0.4, 1, 0.1),
		t('gh', 'GH', '°dGH', 3, 8, 2, 0, 1),
		t('kh', 'KH', '°dKH', 2, 6, 1.5, 0, 1),
		nh3,
		no2,
		t('no3', 'Nitrates (NO3)', 'mg/L', 5, 25, 15, 0, 5),
		t('po4', 'Phosphates (PO4)', 'mg/L', 0.1, 1, 0.5, 2, 0.05)
	],
	mer: [
		t('temp', 'Température', '°C', 24, 27, 2),
		t('salinity', 'Densité', 'SG', 1.023, 1.025, 0.001, 3, 0.001),
		t('ph', 'pH', '', 8, 8.4, 0.3, 1, 0.1),
		t('kh', 'KH', '°dKH', 7, 12, 1.5, 1, 0.5),
		nh3,
		no2,
		t('no3', 'Nitrates (NO3)', 'mg/L', 0, 20, 10, 0, 5)
	],
	recif: [
		t('temp', 'Température', '°C', 24, 27, 1.5),
		t('salinity', 'Densité', 'SG', 1.024, 1.026, 0.001, 3, 0.001),
		t('ph', 'pH', '', 8, 8.4, 0.3, 1, 0.1),
		t('kh', 'KH', '°dKH', 7, 9, 1, 1, 0.5),
		t('ca', 'Calcium', 'mg/L', 400, 450, 30, 0, 10),
		t('mg', 'Magnésium', 'mg/L', 1250, 1400, 100, 0, 10),
		nh3,
		no2,
		t('no3', 'Nitrates (NO3)', 'mg/L', 0, 10, 5, 1, 0.5),
		t('po4', 'Phosphates (PO4)', 'mg/L', 0, 0.1, 0.05, 2, 0.01)
	]
};

export const TASK_KINDS = [
	{ value: 'eau', label: "Changement d'eau", everyDays: 7 },
	{ value: 'filtre', label: 'Nettoyage du filtre', everyDays: 30 },
	{ value: 'test', label: 'Tests', everyDays: 7 },
	{ value: 'dosage', label: 'Dosage', everyDays: 1 },
	{ value: 'autre', label: 'Autre', everyDays: 7 }
] as const;

import { describe, expect, it } from 'vitest';
import {
	CalcError,
	afterWaterChange,
	dosageEffect,
	dosageMl,
	percentToReach,
	pptToSg,
	realVolume,
	remineralisation,
	saltForBatch,
	salinityAdjust,
	sgToPpt,
	tapRoMix,
	waterChangeLitres
} from './calculators';

describe('realVolume', () => {
	it('calcule volume brut, utile et net', () => {
		const v = realVolume({ lengthCm: 100, widthCm: 40, heightCm: 50, glassMm: 8, freeboardCm: 3, displacedL: 15 });
		expect(v.grossL).toBe(200);
		expect(v.waterL).toBeCloseTo(((100 - 1.6) * (40 - 1.6) * (50 - 0.8 - 3)) / 1000, 0);
		expect(v.netL).toBeCloseTo(v.waterL - 15, 1);
	});
	it('refuse les dimensions absurdes', () => {
		expect(() => realVolume({ lengthCm: 0, widthCm: 40, heightCm: 50, glassMm: 8, freeboardCm: 3, displacedL: 0 })).toThrow(CalcError);
		expect(() => realVolume({ lengthCm: 100, widthCm: 40, heightCm: 5, glassMm: 8, freeboardCm: 10, displacedL: 0 })).toThrow(CalcError);
		expect(() => realVolume({ lengthCm: 100, widthCm: 40, heightCm: 50, glassMm: 8, freeboardCm: 3, displacedL: 500 })).toThrow(CalcError);
	});
});

describe('changement d’eau', () => {
	it('litres à changer', () => {
		expect(waterChangeLitres(200, 25).litres).toBe(50);
		expect(() => waterChangeLitres(200, 0)).toThrow(CalcError);
		expect(() => waterChangeLitres(200, 120)).toThrow(CalcError);
	});
	it('valeur après changement', () => {
		expect(afterWaterChange(40, 5, 50)).toBe(22.5);
	});
	it('pourcentage pour atteindre une cible', () => {
		const r = percentToReach(40, 20, 0, 200);
		expect(r.percent).toBe(50);
		expect(r.litres).toBe(100);
		expect(percentToReach(40, 20, 10, 100).percent).toBeCloseTo(66.7, 1);
	});
	it('refuse une cible inatteignable', () => {
		expect(() => percentToReach(40, 50, 0, 100)).toThrow(CalcError);
		expect(() => percentToReach(40, 20, 25, 100)).toThrow(CalcError);
	});
});

describe('dosage', () => {
	it('dose et effet sont réciproques', () => {
		// 1 mL relève de 1 °dKH dans 100 L → puissance 100
		const dose = dosageMl(200, 2, 100);
		expect(dose.ml).toBe(4);
		expect(dosageEffect(200, dose.ml, 100).increase).toBe(2);
	});
	it('refuse les valeurs nulles', () => {
		expect(() => dosageMl(0, 1, 1)).toThrow(CalcError);
		expect(() => dosageMl(100, 1, 0)).toThrow(CalcError);
	});
});

describe('reminéralisation', () => {
	it('mélange robinet / osmose', () => {
		const mix = tapRoMix(100, 6, 15, 0);
		expect(mix.tapL).toBe(40);
		expect(mix.roL).toBe(60);
		expect(mix.tapPercent).toBe(40);
	});
	it('refuse une cible hors mélange', () => {
		expect(() => tapRoMix(100, 20, 15, 0)).toThrow(CalcError);
		expect(() => tapRoMix(100, 5, 0, 0)).toThrow(CalcError);
	});
	it('masse de sels', () => {
		expect(remineralisation(100, 2, 6, 0.02).grams).toBe(8);
		expect(() => remineralisation(100, 6, 6, 0.02)).toThrow(CalcError);
	});
});

describe('salinité', () => {
	it('convertit densité et ppt dans les deux sens', () => {
		expect(sgToPpt(1.0264)).toBeCloseTo(35, 0);
		expect(pptToSg(35)).toBeCloseTo(1.0264, 3);
		expect(sgToPpt(pptToSg(33))).toBeCloseTo(33, 0);
	});
	it('sel pour un bac préparé', () => {
		expect(saltForBatch(100, 35).grams).toBe(3500);
		expect(saltForBatch(100, 35).kg).toBe(3.5);
		expect(() => saltForBatch(100, 80)).toThrow(CalcError);
	});
	it('baisser la salinité avec de l’eau osmosée', () => {
		const r = salinityAdjust(100, 38, 35, 0);
		expect(r.direction).toBe('baisser');
		expect(r.replaceL).toBeCloseTo(7.9, 1);
	});
	it('monter la salinité avec une eau plus salée', () => {
		const r = salinityAdjust(100, 30, 35, 45);
		expect(r.direction).toBe('monter');
		expect(r.replaceL).toBeCloseTo(33.3, 1);
	});
	it('refuse les cas impossibles', () => {
		expect(() => salinityAdjust(100, 38, 35, 36)).toThrow(CalcError);
		expect(() => salinityAdjust(100, 35, 35, 0)).toThrow(CalcError);
	});
});

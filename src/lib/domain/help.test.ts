import { describe, expect, it } from 'vitest';
import { buildHelpText, type HelpInput } from './help';
import { DAY_MS } from './dates';
import type { Aquarium, AquariumEvent, Measurement, Parameter, Task } from '../types';

const NOW = Date.parse('2026-10-30T10:00:00Z');
const ago = (days: number) => new Date(NOW - days * DAY_MS).toISOString();

const aquarium: Aquarium = {
	id: 1,
	name: 'Salon',
	waterType: 'plantee',
	volumeL: 240,
	startedOn: '2025-03-12',
	coverPhotoId: null,
	stage: 'actif'
};
const param = (id: number, key: string, name: string, unit: string, min: number | null, max: number | null, decimals = 1): Parameter => ({
	id,
	aquariumId: 1,
	key,
	name,
	unit,
	min,
	max,
	driftPerWeek: null,
	decimals,
	step: 0.1,
	position: id
});
const parameters = [param(1, 'ph', 'pH', '', 6, 7.2), param(2, 'no3', 'Nitrates (NO3)', 'mg/L', 5, 25, 0), param(3, 'kh', 'KH', '°dKH', 2, 6, 0)];
const m = (parameterId: number, value: number, daysAgo: number): Measurement => ({ parameterId, aquariumId: 1, value, measuredAt: ago(daysAgo) });
// Nitrates qui montent jusqu'au-dessus de la plage ; pH stable ; KH jamais mesuré.
const measurements = [
	m(1, 6.8, 6), m(1, 6.9, 3), m(1, 6.9, 0),
	m(2, 14, 14), m(2, 16, 10), m(2, 20, 6), m(2, 24, 3), m(2, 28, 0)
];
const task = (id: number, kind: string, title: string): Task => ({ id, aquariumId: 1, title, kind, everyDays: 7, nextDue: '2026-11-05', active: true });
const events: AquariumEvent[] = [
	{ aquariumId: 1, kind: 'changement_eau', at: ago(7), payload: { percent: 30, litres: 72, source: 'osmose' } },
	{ aquariumId: 1, kind: 'dosage', at: ago(2), payload: { product: 'Engrais NPK', amount: 2, unit: 'mL' } },
	{ aquariumId: 1, kind: 'habitant_depart', at: ago(5), payload: { species: 'Néon cardinal', quantity: 1, cause: 'mort' } }
];

const base = (over: Partial<HelpInput> = {}): HelpInput => ({
	view: {
		aquariums: [aquarium],
		parameters,
		measurements,
		tasks: [task(1, 'eau', 'Changement d’eau'), task(2, 'filtre', 'Nettoyer le préfiltre')],
		completions: [
			{ taskId: 1, doneAt: ago(7) },
			{ taskId: 2, doneAt: ago(4) }
		],
		events
	},
	aquariumId: 1,
	inhabitants: [
		{ kind: 'faune', species: 'Néon cardinal', quantity: 14, arrivedOn: '2025-05-02' },
		{ kind: 'faune', species: 'Crevette Amano', quantity: 6, arrivedOn: '2026-10-25' },
		{ kind: 'flore', species: 'Rotala rotundifolia', quantity: 3, arrivedOn: '2025-03-20' },
		{ kind: 'faune', species: 'Ancien', quantity: 2, arrivedOn: '2025-01-01', leftOn: '2026-09-01' }
	],
	equipment: [
		{ name: 'Filtre externe Oase 350', category: 'filtre' },
		{ name: 'Rampe LED', category: 'eclairage' },
		{ name: 'Autre', category: 'autre' }
	],
	days: 14,
	include: { params: true, stock: true, equipment: true, actions: true, alerts: true },
	question: 'Mes nitrates montent malgré les changements d’eau, que faire ?',
	now: NOW,
	...over
});

describe('buildHelpText', () => {
	it('produit un résumé complet et stable', () => {
		const text = buildHelpText(base());
		expect(text).toMatchInlineSnapshot(`
			"**Eau douce plantée · 240 L · en eau depuis 20 mois**

			**Ma question**
			Mes nitrates montent malgré les changements d’eau, que faire ?

			**Paramètres**
			| Paramètre | Dernière valeur | Mesurée | Plage visée | Tendance 7 j | État |
			| --- | --- | --- | --- | --- | --- |
			| pH | 6,9 | aujourd'hui | 6,0–7,2 | stable | dans la plage |
			| Nitrates (NO3) | 28 mg/L | aujourd'hui | 5–25 | ↑ 9 mg/L | hors plage (au-dessus) |

			**Mesures des 14 derniers jours**
			- Nitrates (NO3) (mg/L) : 14 (16 oct.), 16 (20 oct.), 20 (24 oct.), 24 (27 oct.), 28 (30 oct.)

			**Alertes en cours**
			- Nitrates (NO3) à 28 mg/L : au-dessus de 25

			**Peuplement**
			- 14 × Néon cardinal (arrivé le 2 mai)
			- 6 × Crevette Amano — **arrivé il y a 5 j**
			- 3 × Rotala rotundifolia (arrivé le 20 mars)

			Départs et pertes des 14 derniers jours :
			- 25 oct. : 1 × Néon cardinal · mort

			**Matériel**
			- Filtre externe Oase 350 (filtre)
			- Rampe LED (eclairage)
			- Autre

			**Dernières actions (14 jours)**
			Dernier changement d’eau : il y a 7 j.
			- 28 oct. : Dosage · Engrais NPK · 2 mL
			- 26 oct. : Nettoyer le préfiltre
			- 23 oct. : Changement d'eau · 30 % (72 L) · eau d'osmose

			_Résumé généré avec l’appli Aquarium._"
		`);
	});

	it('ne contient pas le nom du bac', () => {
		expect(buildHelpText(base())).not.toContain('Salon');
	});

	it('respecte les options d’inclusion', () => {
		const text = buildHelpText(base({ include: { params: false, stock: false, equipment: false, actions: false, alerts: false } }));
		expect(text).toContain('Ma question');
		for (const section of ['**Paramètres**', '**Peuplement**', '**Matériel**', '**Dernières actions', '**Alertes en cours**']) {
			expect(text).not.toContain(section);
		}
	});

	it('omet la question quand elle est vide', () => {
		expect(buildHelpText(base({ question: '   ' }))).not.toContain('Ma question');
	});

	it('met en évidence une arrivée récente et liste les pertes de la période', () => {
		const text = buildHelpText(base());
		expect(text).toContain('**arrivé il y a 5 j**');
		expect(text).toContain('Néon cardinal');
		expect(text).toMatch(/Départs et pertes[\s\S]*1 × Néon cardinal · mort/);
		expect(text).not.toContain('2 × Ancien'); // parti : absent du peuplement actuel
	});

	it('n’affiche pas les changements d’eau en double', () => {
		const text = buildHelpText(base());
		expect(text.match(/Changement d'eau/g)?.length).toBe(1);
		expect(text).toContain('Dernier changement d’eau : il y a 7 j.');
	});

	it('limite le matériel et ignore la catégorie « autre »', () => {
		const many = Array.from({ length: 12 }, (_, i) => ({ name: `Objet ${i}`, category: 'autre' }));
		const text = buildHelpText(base({ equipment: many }));
		expect(text).toContain('- Objet 7');
		expect(text).not.toContain('- Objet 8');
		expect(text).toContain('… et 4 autres');
	});

	it('décrit un bac en cyclage avec les mesures du cycle de l’azote', () => {
		const nh3 = param(4, 'nh3', 'Ammoniac', 'mg/L', 0, 0.05, 2);
		const cycling = { ...aquarium, stage: 'cyclage' as const, startedOn: '2026-10-12' };
		const text = buildHelpText(
			base({
				view: { aquariums: [cycling], parameters: [nh3], measurements: [{ parameterId: 4, aquariumId: 1, value: 0.5, measuredAt: ago(1) }], tasks: [], completions: [], events: [] },
				question: ''
			})
		);
		expect(text).toContain('cyclage en cours');
		expect(text).toContain('en eau depuis 18 jours');
		expect(text).toContain('Mesures des 14 derniers jours');
	});

	it('renvoie une chaîne vide pour un bac inconnu', () => {
		expect(buildHelpText(base({ aquariumId: 99 }))).toBe('');
	});
});

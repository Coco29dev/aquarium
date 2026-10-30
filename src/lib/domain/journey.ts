// Parcours d'un bac : la suite d'étapes qui accompagne un bac selon sa situation.
// - 'projet'  : le bac n'est pas encore en eau (on réfléchit, on liste, on chiffre) ;
// - 'cyclage' : le bac est en eau, le cycle de l'azote se met en place, pas encore de poissons ;
// - 'actif'   : le bac vit, on installe la routine.
// Les étapes se cochent seules quand les données le montrent. Fonctions pures, testées.
//
// Convention des liens d'action (`action.href`) pour les écrans :
//   `?etape=mise-en-eau`  sur la fiche du bac : lancer la mise en eau (projet → cyclage) ;
//   `?etape=actif`        sur la fiche du bac : passer en bac actif (cyclage → actif) ;
//   `/aquariums/<id>/projet`      : liste de projet (matériel, budget, espèces souhaitées) ;
//   `/aquariums/<id>/peuplement`  : simulateur de peuplement ;
//   autres : onglets existants du bac (réglages, tâches, inventaire, journal).

import { dayInParis, daysBetween } from './dates';
import type { CyclingStatus } from './cycling';
import type {
	Aquarium,
	AquariumEvent,
	AquariumStage,
	Measurement,
	Parameter,
	ProjectItem,
	Task,
	WaterType
} from '../types';

export interface JourneyStep {
	id: string;
	title: string;
	detail?: string;
	status: 'done' | 'current' | 'todo';
	action?: { label: string; href: string };
}

export interface JourneyInput {
	aquarium: Pick<Aquarium, 'id' | 'stage' | 'startedOn' | 'volumeL' | 'waterType' | 'coverPhotoId'>;
	parameters: Parameter[];
	measurements: Measurement[];
	tasks: Task[];
	events: AquariumEvent[];
	inhabitantsCount: number;
	projectItems: ProjectItem[];
	cycling: CyclingStatus | null;
	today: string;
}

/** Intitulés des étapes de projet qui ne se déduisent pas des données : l'écran de création les crée à cocher. */
export const PROJECT_CHECK_ITEMS = {
	compatibility: 'Vérifier la compatibilité',
	planning: 'Planifier la mise en eau'
} as const;

// Même seuil que le coach de cyclage : en dessous, la valeur compte pour nulle (limite des tests colorimétriques).
const ZERO = 0.05;

const SALT: WaterType[] = ['mer', 'recif'];

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Premiers paramètres à mesurer selon le type d'eau, en toutes lettres. */
export function firstMeasurementsLabel(waterType: WaterType): string {
	switch (waterType) {
		case 'recif':
			return 'densité, température, pH, KH, calcium, magnésium, nitrates et phosphates';
		case 'mer':
			return 'densité, température, pH, KH et nitrates';
		case 'plantee':
			return 'pH, GH, KH, nitrates et phosphates';
		default:
			return 'pH, GH, KH et nitrates';
	}
}

/**
 * Jour où le cycle en cours a commencé : la plus récente des dates « Mise en eau » / « Cyclage relancé »
 * du journal, sinon la date de mise en eau du bac.
 */
export function cycleStartDay(aquarium: Pick<Aquarium, 'startedOn'>, events: AquariumEvent[]): string | null {
	let best: string | null = aquarium.startedOn;
	for (const e of events) {
		if (e.kind !== 'etape') continue;
		const label = String((e.payload as { label?: unknown })?.label ?? '');
		if (label !== 'Mise en eau' && label !== 'Cyclage relancé') continue;
		const day = dayInParis(e.at);
		if (!best || day > best) best = day;
	}
	return best;
}

interface Series {
	nh3: number[];
	no2: number[];
	no3: number[];
	/** Jours distincts où au moins un des trois a été mesuré. */
	days: Set<string>;
}

function cycleSeries(input: JourneyInput, since: string | null): Series {
	const keyOf = new Map(input.parameters.map((p) => [p.id, p.key]));
	const out: Series = { nh3: [], no2: [], no3: [], days: new Set() };
	const sorted = [...input.measurements]
		.filter((m) => m.aquariumId === input.aquarium.id)
		.sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
	for (const m of sorted) {
		const day = dayInParis(m.measuredAt);
		if (since && day < since) continue;
		const key = keyOf.get(m.parameterId);
		if (key === 'nh3' || key === 'no2' || key === 'no3') {
			out[key].push(m.value);
			out.days.add(day);
		}
	}
	return out;
}

/** Marque la première étape non faite comme « en cours », les suivantes comme « à venir ». */
function sequence(steps: (Omit<JourneyStep, 'status'> & { done: boolean; keepAction?: boolean })[]): JourneyStep[] {
	let currentSet = false;
	return steps.map(({ done, keepAction, ...step }) => {
		if (done) return { ...step, status: 'done' };
		if (!currentSet) {
			currentSet = true;
			return { ...step, status: 'current' };
		}
		// Une action n'a de sens que sur l'étape en cours, sauf celles qu'on peut toujours déclencher
		// (lancer la mise en eau, passer en bac actif).
		if (keepAction) return { ...step, status: 'todo' };
		const { action: _action, ...rest } = step;
		return { ...rest, status: 'todo' };
	});
}

function projectSteps(input: JourneyInput): JourneyStep[] {
	const { aquarium: a, projectItems: items } = input;
	const id = a.id;
	const byKind = (kind: ProjectItem['kind']) => items.filter((i) => i.kind === kind);
	const check = (needle: string) =>
		items.some((i) => i.kind === 'etape' && i.done && normalize(i.label).includes(normalize(needle)));
	const equipment = byKind('equipement');
	const species = byKind('espece');
	const budgeted = items.some((i) => (i.kind === 'budget' || i.kind === 'equipement') && (i.amount ?? 0) > 0);
	const total = items.reduce((sum, i) => sum + (i.kind === 'budget' || i.kind === 'equipement' ? (i.amount ?? 0) : 0), 0);
	const volume = a.volumeL ?? 0;

	return sequence([
		{
			id: 'volume',
			title: 'Choisir le volume',
			detail: volume > 0 ? `${volume} L` : 'Le volume décide des espèces possibles et du matériel.',
			done: volume > 0,
			action: { label: 'Renseigner le volume', href: `/aquariums/${id}/reglages` }
		},
		{
			id: 'materiel',
			title: 'Lister le matériel',
			detail: equipment.length
				? `${equipment.length} élément${equipment.length > 1 ? 's' : ''} sur la liste.`
				: 'Filtre, chauffage, éclairage, décor… tout ce qu’il faut acheter.',
			done: equipment.length > 0,
			action: { label: 'Ouvrir la liste', href: `/aquariums/${id}/projet` }
		},
		{
			id: 'budget',
			title: 'Estimer le budget',
			detail: budgeted ? `Budget estimé : ${Math.round(total)} €.` : 'Ajoute les prix pour connaître le coût total.',
			done: budgeted,
			action: { label: 'Chiffrer le projet', href: `/aquariums/${id}/projet` }
		},
		{
			id: 'especes',
			title: 'Souhaits d’espèces',
			detail: species.length
				? `${species.length} espèce${species.length > 1 ? 's' : ''} souhaitée${species.length > 1 ? 's' : ''}.`
				: 'Les animaux et plantes que tu veux accueillir.',
			done: species.length > 0,
			action: { label: 'Choisir des espèces', href: `/aquariums/${id}/projet` }
		},
		{
			id: 'compatibilite',
			title: PROJECT_CHECK_ITEMS.compatibility,
			detail: 'Le simulateur compare température, pH, taille et caractère des espèces choisies.',
			done: check('compatib'),
			action: { label: 'Ouvrir le simulateur', href: `/aquariums/${id}/peuplement` }
		},
		{
			id: 'mise-en-eau',
			title: PROJECT_CHECK_ITEMS.planning,
			detail: 'Quand tout est prêt, lance la mise en eau : le cyclage démarre.',
			done: false,
			keepAction: true,
			action: { label: 'Lancer la mise en eau', href: `?etape=mise-en-eau` }
		}
	]);
}

function cyclingSteps(input: JourneyInput): JourneyStep[] {
	const { aquarium: a, today, events, cycling } = input;
	const id = a.id;
	const since = cycleStartDay(a, events);
	const s = cycleSeries(input, since);
	const salt = SALT.includes(a.waterType);
	const age = since ? Math.max(0, daysBetween(since, today)) : null;

	const everSeen = (list: number[]) => list.some((v) => v > ZERO);
	const lastOf = (list: number[]) => (list.length ? list[list.length - 1] : null);
	const ammoniaPeakPassed = everSeen(s.nh3) && (lastOf(s.nh3) ?? 1) <= ZERO;
	const nitritePeakPassed = everSeen(s.no2) && (lastOf(s.no2) ?? 1) <= ZERO;
	const nitrates = (lastOf(s.no3) ?? 0) > 0;
	const cycleStarted = everSeen(s.nh3) || everSeen(s.no2) || nitrates;
	const waterChanged = events.some(
		(e) => e.aquariumId === a.id && e.kind === 'changement_eau' && (!since || dayInParis(e.at) >= since)
	);
	const ready = Boolean(cycling?.ready);

	return sequence([
		{
			id: 'mise-en-eau',
			title: 'Mise en eau',
			detail: age != null ? `Jour ${age} du cyclage.` : 'Le bac est rempli, le cycle peut commencer.',
			done: true
		},
		{
			id: 'source-ammoniac',
			title: 'Source d’ammoniac',
			detail: cycleStarted
				? 'Le cycle a démarré : on voit de l’ammoniac, des nitrites ou des nitrates.'
				: 'Un peu d’aliment ou d’ammoniaque pure nourrit les premières bactéries.',
			done: cycleStarted,
			action: { label: 'Saisir un test', href: `/mesurer?bac=${id}` }
		},
		{
			id: 'premiers-tests',
			title: 'Premiers tests, tous les 2 jours',
			detail:
				s.days.size > 0
					? `${s.days.size} jour${s.days.size > 1 ? 's' : ''} de tests. ${salt ? 'Ajoute la densité à chaque série.' : 'Ammoniac, nitrites et nitrates.'}`
					: salt
						? 'Ammoniac, nitrites, nitrates et densité.'
						: 'Ammoniac, nitrites et nitrates.',
			done: s.days.size >= 3,
			action: { label: 'Saisir un test', href: `/mesurer?bac=${id}` }
		},
		{
			id: 'pic-ammoniac',
			title: 'Pic d’ammoniac',
			detail: ammoniaPeakPassed ? 'Passé : l’ammoniac est de retour à zéro.' : 'L’ammoniac monte puis retombe quand les bactéries s’installent.',
			done: ammoniaPeakPassed
		},
		{
			id: 'pic-nitrites',
			title: 'Pic de nitrites',
			detail: nitritePeakPassed ? 'Passé : les nitrites sont retombés à zéro.' : 'Les nitrites montent à leur tour, c’est la phase la plus longue.',
			done: nitritePeakPassed
		},
		{
			id: 'nitrates',
			title: 'Nitrates présents',
			detail: nitrates ? 'Les nitrates apparaissent : le cycle tourne.' : 'Ils prouvent que les deux populations de bactéries travaillent.',
			done: nitrates
		},
		{
			id: 'changement-eau',
			title: 'Changement d’eau avant les poissons',
			detail: waterChanged ? 'Fait : les nitrates sont ramenés à un niveau raisonnable.' : 'Un changement d’eau abaisse les nitrates avant d’introduire les animaux.',
			done: waterChanged,
			action: { label: 'Voir les tâches', href: `/aquariums/${id}/taches` }
		},
		{
			id: 'premiers-poissons',
			title: 'Premiers poissons',
			detail: ready
				? 'Ammoniaque et nitrites sont à zéro de façon stable : le bac peut recevoir ses premiers habitants.'
				: 'Quand le coach dit que le cyclage est terminé, passe en bac actif.',
			done: false,
			keepAction: ready,
			action: ready ? { label: 'Passer en bac actif', href: `?etape=actif` } : undefined
		}
	]);
}

function activeSteps(input: JourneyInput): JourneyStep[] {
	const { aquarium: a, tasks, events, inhabitantsCount } = input;
	const id = a.id;
	const own = tasks.filter((t) => t.aquariumId === id && t.active);
	const has = (kind: string) => own.some((t) => t.kind === kind);
	const missing = [!has('eau') && 'changement d’eau', !has('test') && 'tests', !has('filtre') && 'nettoyage du filtre'].filter(Boolean);
	const measuredParams = new Set(input.measurements.filter((m) => m.aquariumId === id).map((m) => m.parameterId));
	const waterChanged = events.some((e) => e.aquariumId === id && e.kind === 'changement_eau');

	return sequence([
		{
			id: 'routine',
			title: 'Installer la routine d’entretien',
			detail: missing.length ? `Il manque : ${missing.join(', ')}.` : 'Changement d’eau, tests et filtre sont planifiés.',
			done: missing.length === 0,
			action: { label: 'Planifier', href: `/aquariums/${id}/taches` }
		},
		{
			id: 'premieres-mesures',
			title: 'Premières mesures',
			detail: measuredParams.size >= 3 ? `${measuredParams.size} paramètres mesurés.` : `À mesurer pour démarrer : ${firstMeasurementsLabel(a.waterType)}.`,
			done: measuredParams.size >= 3,
			action: { label: 'Saisir des mesures', href: `/mesurer?bac=${id}` }
		},
		{
			id: 'premier-habitant',
			title: 'Premier habitant',
			detail: inhabitantsCount > 0 ? `${inhabitantsCount} habitant${inhabitantsCount > 1 ? 's' : ''} enregistré${inhabitantsCount > 1 ? 's' : ''}.` : 'Enregistre ce qui vit dans le bac pour suivre la charge biologique.',
			done: inhabitantsCount > 0,
			action: { label: 'Ajouter', href: `/aquariums/${id}/inventaire` }
		},
		{
			id: 'couverture',
			title: 'Photo de couverture',
			detail: a.coverPhotoId != null ? 'Le bac a sa photo.' : 'Choisis une photo du journal pour habiller la fiche du bac.',
			done: a.coverPhotoId != null,
			action: { label: 'Ouvrir le journal', href: `/aquariums/${id}/journal` }
		},
		{
			id: 'premier-changement-eau',
			title: 'Premier changement d’eau enregistré',
			detail: waterChanged ? 'Le journal garde la trace de tes changements d’eau.' : 'Coche la tâche de changement d’eau : le journal s’en souvient.',
			done: waterChanged,
			action: { label: 'Voir les tâches', href: `/aquariums/${id}/taches` }
		}
	]);
}

/** Les étapes du parcours d'un bac, dans l'ordre, avec leur état. */
export function journeySteps(input: JourneyInput): JourneyStep[] {
	const stage: AquariumStage = input.aquarium.stage ?? 'actif';
	if (stage === 'projet') return projectSteps(input);
	if (stage === 'cyclage') return cyclingSteps(input);
	return activeSteps(input);
}

/** Avancement du parcours : étapes faites sur le total, et la prochaine à faire. */
export function journeyProgress(steps: JourneyStep[]): { done: number; total: number; next: JourneyStep | null } {
	return { done: steps.filter((s) => s.status === 'done').length, total: steps.length, next: steps.find((s) => s.status === 'current') ?? null };
}

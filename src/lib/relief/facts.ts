import { fmt } from '$lib/ui';
import type { Aquarium, Snapshot } from '$lib/types';

/** Valeur vedette d'un bac (température) et deux repères (pH, nitrates ou densité), pour ses cartes. */
export function tankFacts(view: Pick<Snapshot, 'parameters' | 'measurements'>, aquarium: Pick<Aquarium, 'id'>) {
	const pick = (key: string) => {
		const p = view.parameters.find((x) => x.aquariumId === aquarium.id && x.key === key);
		if (!p) return null;
		let last: number | null = null;
		for (let i = view.measurements.length - 1; i >= 0; i--) {
			if (view.measurements[i].parameterId === p.id) {
				last = view.measurements[i].value;
				break;
			}
		}
		return last == null ? null : { p, value: fmt(last, p.decimals) };
	};
	const temp = pick('temp');
	const stats = ['ph', 'no3', 'salinity']
		.map(pick)
		.filter((x): x is NonNullable<typeof x> => Boolean(x))
		.slice(0, 2)
		.map(({ p, value }) => ({
			label: p.key === 'no3' ? 'NO₃' : p.key === 'ph' ? 'pH' : 'Dens.',
			value,
			unit: p.key === 'no3' ? p.unit : ''
		}));
	return { big: temp ? { label: 'Température', value: temp.value, unit: temp.p.unit } : null, stats };
}

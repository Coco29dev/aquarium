import { sendToAll } from './push';

// Minuteurs de réactif (pas à pas des tests) : notification push à la fin du délai, même app fermée.
// Les minuteurs vivent en mémoire du serveur : un redémarrage ou un déploiement les perd (quelques minutes
// au plus, acceptable ici). L'appli affiche de son côté un compte à rebours local.

export const MIN_SECONDS = 10;
export const MAX_SECONDS = 3600;
export const MAX_PENDING = 10;
const LABEL_MAX = 80;

export interface TimerInput {
	seconds: number;
	label: string;
	url: string;
}

export interface PendingTimer {
	id: number;
	label: string;
	url: string;
	endsAt: string;
}

export type ParsedTimer = { ok: true; value: TimerInput } | { ok: false; message: string };

/** Valide le corps d'une demande de minuteur (durée entière de 10 s à 1 h, libellé, lien interne). */
export function parseTimer(body: unknown): ParsedTimer {
	if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, message: 'Corps JSON attendu.' };
	const { seconds, label, url } = body as Record<string, unknown>;
	if (typeof seconds !== 'number' || !Number.isInteger(seconds) || seconds < MIN_SECONDS || seconds > MAX_SECONDS) {
		return { ok: false, message: `La durée doit être un nombre entier de secondes, de ${MIN_SECONDS} à ${MAX_SECONDS}.` };
	}
	if (typeof label !== 'string' || !label.trim()) return { ok: false, message: 'Donne un libellé au minuteur.' };
	if (label.trim().length > LABEL_MAX) return { ok: false, message: `Libellé trop long (${LABEL_MAX} caractères au plus).` };
	let target = '/mesurer';
	if (url !== undefined && url !== null && url !== '') {
		// Lien interne uniquement : jamais d'adresse externe dans une notification de l'appli.
		if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//') || url.length > 200) {
			return { ok: false, message: "Le lien doit être une adresse de l'appli, par exemple /mesurer." };
		}
		target = url;
	}
	return { ok: true, value: { seconds, label: label.trim(), url: target } };
}

interface Deps {
	send: (payload: { title: string; body: string; url: string }) => Promise<unknown>;
	setTimer: (fn: () => void, ms: number) => unknown;
	clearTimer: (handle: unknown) => void;
	now: () => number;
}

export function createTimers(deps: Deps) {
	let nextId = 1;
	const pending = new Map<number, PendingTimer & { handle: unknown }>();

	return {
		start(input: TimerInput): { id: number; endsAt: string } {
			if (pending.size >= MAX_PENDING) throw new Error(`Dix minuteurs en cours au plus : annule-en un avant d'en lancer un autre.`);
			const id = nextId++;
			const endsAt = new Date(deps.now() + input.seconds * 1000).toISOString();
			const handle = deps.setTimer(() => {
				pending.delete(id);
				void deps.send({ title: 'Minuteur', body: `${input.label} : minuteur terminé`, url: input.url }).catch((e) => console.error('[minuteur]', e));
			}, input.seconds * 1000);
			pending.set(id, { id, label: input.label, url: input.url, endsAt, handle });
			return { id, endsAt };
		},
		list(): PendingTimer[] {
			return [...pending.values()].map(({ handle: _handle, ...t }) => t).sort((a, b) => a.endsAt.localeCompare(b.endsAt));
		},
		cancel(id: number): boolean {
			const t = pending.get(id);
			if (!t) return false;
			deps.clearTimer(t.handle);
			pending.delete(id);
			return true;
		}
	};
}

/** Registre du serveur. */
export const timers = createTimers({ send: sendToAll, setTimer: setTimeout, clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>), now: Date.now });

import { dayInParis, daysBetween } from '$lib/domain/dates';

// Horloge vivante : l'heure et le jour de Paris, mis à jour tant que l'appli est ouverte. Sur iPhone,
// une PWA reprise le lendemain n'est pas rechargée : sans horloge, l'accueil dirait encore « Bonsoir »
// avec le ruban de la veille. Un tick par minute (seulement quand l'écran est visible), plus un tick à
// chaque retour au premier plan.

/** Heure (0–23) à Paris pour un instant. */
export function parisHour(ms: number): number {
	const part = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Paris' })
		.formatToParts(new Date(ms))
		.find((p) => p.type === 'hour');
	return Number(part?.value ?? 12);
}

/** Heure de Paris avec les minutes en fraction (17 h 30 → 17,5) : le ciel de la scène glisse minute par minute. */
export function parisHourFraction(ms: number): number {
	const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Paris' }).formatToParts(new Date(ms));
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
	return get('hour') + get('minute') / 60;
}

/** Jours entiers écoulés depuis la dernière ouverture (0 si inconnue ou le même jour). */
export function daysAway(lastDay: string | null | undefined, today: string): number {
	if (!lastDay) return 0;
	return Math.max(0, daysBetween(lastDay, today));
}

const STORAGE_KEY = 'lastOpenDay';
const TICK_MS = 60_000;

class Clock {
	/** Instant courant (ms), rafraîchi à la minute. */
	now = $state(Date.now());
	today = $derived(dayInParis(this.now));
	hour = $derived(parisHour(this.now));
	/** Heure avec minutes (17,5 = 17 h 30), pour le ciel de la scène : elle n'a alors pas besoin de sa propre minuterie. */
	hourFraction = $derived(parisHourFraction(this.now));
	/** Jours d'absence avant la dernière ouverture : sert à la salutation « Content de te revoir ». */
	away = $state(0);

	#day = '';
	#timer: ReturnType<typeof setInterval> | undefined;
	#started = false;

	/** Pose l'instant (appelé par les tests et par le tick). */
	set(ms: number) {
		this.now = ms;
		const day = dayInParis(ms);
		if (!this.#day) {
			// Première mesure de la session : on compare au dernier jour d'ouverture gardé sur l'appareil.
			this.#day = readLastDay() ?? day;
		}
		if (day !== this.#day) {
			this.away = daysAway(this.#day, day);
			this.#day = day;
			writeLastDay(day);
		} else if (readLastDay() !== day) writeLastDay(day);
	}

	tick = () => this.set(Date.now());

	/** Démarre les mises à jour (une seule fois). */
	start() {
		if (this.#started || typeof document === 'undefined') return;
		this.#started = true;
		const run = () => {
			clearInterval(this.#timer);
			if (document.visibilityState === 'visible') {
				this.tick();
				this.#timer = setInterval(this.tick, TICK_MS);
			}
		};
		document.addEventListener('visibilitychange', run);
		addEventListener('pageshow', run);
		run();
	}
}

function readLastDay(): string | null {
	try {
		return localStorage.getItem(STORAGE_KEY);
	} catch {
		return null;
	}
}
function writeLastDay(day: string) {
	try {
		localStorage.setItem(STORAGE_KEY, day);
	} catch {
		// Stockage indisponible : la salutation de retour ne s'affichera simplement pas.
	}
}

export const clock = new Clock();
if (typeof window !== 'undefined') clock.start();

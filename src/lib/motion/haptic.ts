/**
 * Retour tactile. iOS n'offre pas `navigator.vibrate` ; en revanche Safari (17.4+) fait « tic » quand
 * on bascule un <input type="checkbox" switch>. On en garde un caché dans <head> et on clique son
 * <label> : il faut un geste de l'utilisateur en cours (clic, pointerup), sinon rien ne se passe.
 * L'astuce n'est pas documentée : tout échec reste silencieux, et le retour tactile n'est jamais
 * le seul signe d'une action (le texte, l'icône ou la couleur la disent déjà).
 */
export type HapticKind = 'tick' | 'confirm' | 'warn';

const VIBRATION: Record<HapticKind, number[]> = { tick: [8], confirm: [10, 40, 10], warn: [30, 40, 30, 40, 30] };
const STORAGE_KEY = 'haptics';

let enabled = true;
let label: HTMLLabelElement | null = null;

function readPreference(): boolean {
	try {
		return localStorage.getItem(STORAGE_KEY) !== 'off';
	} catch {
		return true;
	}
}

if (typeof window !== 'undefined') enabled = readPreference();

/** Active ou coupe le retour tactile (Réglages › Affichage) ; le choix est gardé sur l'appareil. */
export function setHaptics(on: boolean) {
	enabled = on;
	try {
		if (on) localStorage.removeItem(STORAGE_KEY);
		else localStorage.setItem(STORAGE_KEY, 'off');
	} catch {
		// Stockage indisponible : le choix vaut pour cette session.
	}
}

export const hapticsEnabled = () => enabled;

/** Le navigateur sait-il produire un retour tactile (interrupteur natif ou vibration) ? */
export function hapticsSupported(): boolean {
	if (typeof window === 'undefined') return false;
	return 'switch' in HTMLInputElement.prototype || typeof navigator.vibrate === 'function';
}

function pulse() {
	if (!label) {
		label = document.createElement('label');
		label.ariaHidden = 'true';
		label.style.display = 'none';
		const input = document.createElement('input');
		input.type = 'checkbox';
		input.setAttribute('switch', '');
		label.append(input);
		document.head.append(label);
	}
	label.click();
}

/** À appeler depuis un geste de l'utilisateur. `tick` : un appui léger ; `confirm` : c'est fait ; `warn` : attention. */
export function haptic(kind: HapticKind = 'tick') {
	if (!enabled || typeof document === 'undefined') return;
	try {
		if ('switch' in HTMLInputElement.prototype) {
			pulse();
			if (kind === 'confirm') setTimeout(pulse, 90);
			if (kind === 'warn') {
				setTimeout(pulse, 90);
				setTimeout(pulse, 180);
			}
		} else {
			navigator.vibrate?.(VIBRATION[kind]);
		}
	} catch {
		// Pas de retour tactile sur cet appareil.
	}
}

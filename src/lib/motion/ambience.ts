/**
 * Réglage « Ambiance animée » (Réglages › Affichage) : bulles, vagues et poissons des scènes.
 * Le choix est gardé sur l'appareil ; app.html le relit avant l'affichage pour éviter un clignotement,
 * et layout.css coupe les mouvements quand <html data-ambient="off">.
 */
const STORAGE_KEY = 'ambient';

export function ambienceEnabled(): boolean {
	try {
		return localStorage.getItem(STORAGE_KEY) !== 'off';
	} catch {
		return true;
	}
}

export function setAmbience(on: boolean) {
	try {
		if (on) localStorage.removeItem(STORAGE_KEY);
		else localStorage.setItem(STORAGE_KEY, 'off');
	} catch {
		// Stockage indisponible : le choix vaut pour cette session.
	}
	if (on) delete document.documentElement.dataset.ambient;
	else document.documentElement.dataset.ambient = 'off';
}

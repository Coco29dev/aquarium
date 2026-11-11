/**
 * Voile de démarrage : app.html pose #boot, la même image que l'écran de lancement d'iOS (eau lagon, halo,
 * poisson de la marque sans texte), jusqu'à ce que l'appli ait ses données. On le retire en fondu (300 ms) ;
 * app.html garde un minuteur de sécurité de 4 s si l'appli ne démarrait pas. Si l'écran de lancement change
 * (scripts/make-splash.mjs), le dessin du voile dans app.html doit suivre.
 */
export function hideBoot() {
	const veil = document.getElementById('boot');
	if (!veil || veil.classList.contains('leaving')) return;
	veil.classList.add('leaving');
	setTimeout(() => veil.remove(), 340);
}

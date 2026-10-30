import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// L'ancienne adresse reste valable (liens, raccourcis, recherche) : elle mène à l'encyclopédie.
export const load: PageLoad = ({ url }) => {
	redirect(308, `/encyclopedie/especes${url.search}`);
};

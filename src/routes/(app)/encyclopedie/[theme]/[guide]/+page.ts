import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { guideOf } from '$lib/content';

export const load: PageLoad = ({ params }) => {
	const hit = guideOf(params.theme, params.guide);
	if (!hit) error(404, 'Guide introuvable');
	return hit;
};

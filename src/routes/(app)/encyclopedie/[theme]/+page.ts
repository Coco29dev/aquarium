import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { themeOf } from '$lib/content';

export const load: PageLoad = ({ params }) => {
	const theme = themeOf(params.theme);
	if (!theme) error(404, 'Thème introuvable');
	return { theme };
};

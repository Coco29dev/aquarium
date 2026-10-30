import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	SESSION_COOKIE,
	SESSION_MAX_AGE,
	checkPassword,
	createSessionToken,
	loginLockRemainingSeconds,
	recordLoginFailure,
	recordLoginSuccess
} from '$lib/server/session';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.authenticated) redirect(303, '/');
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const locked = loginLockRemainingSeconds();
		if (locked > 0) {
			return fail(429, { error: `Trop d'essais. Réessayez dans ${locked} s.` });
		}

		const form = await request.formData();
		const candidate = String(form.get('password') ?? '');

		if (!checkPassword(candidate)) {
			recordLoginFailure();
			return fail(401, { error: 'Mot de passe incorrect.' });
		}

		recordLoginSuccess();
		cookies.set(SESSION_COOKIE, createSessionToken(), {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			secure: url.protocol === 'https:',
			maxAge: SESSION_MAX_AGE
		});
		redirect(303, '/');
	}
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { vapidPublicKey } from '$lib/server/push';

export const GET: RequestHandler = () => json({ publicKey: vapidPublicKey() });

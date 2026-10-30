import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_PENDING, createTimers, parseTimer } from './timers';

describe('parseTimer', () => {
	it('accepte une durée, un libellé et un lien interne', () => {
		expect(parseTimer({ seconds: 300, label: ' Nitrates ' })).toEqual({ ok: true, value: { seconds: 300, label: 'Nitrates', url: '/mesurer' } });
		expect(parseTimer({ seconds: 60, label: 'KH', url: '/mesurer/pas-a-pas?bac=1' })).toMatchObject({ ok: true });
	});
	it('refuse les durées hors limites ou non entières', () => {
		for (const seconds of [9, 3601, 12.5, '300', null]) expect(parseTimer({ seconds, label: 'x' }).ok).toBe(false);
		expect(parseTimer({ seconds: 10, label: 'x' }).ok).toBe(true);
		expect(parseTimer({ seconds: 3600, label: 'x' }).ok).toBe(true);
	});
	it('refuse un libellé vide ou trop long', () => {
		expect(parseTimer({ seconds: 60, label: '  ' }).ok).toBe(false);
		expect(parseTimer({ seconds: 60, label: 'x'.repeat(81) }).ok).toBe(false);
	});
	it('refuse les liens externes', () => {
		for (const url of ['https://evil.example', '//evil.example', 'mesurer']) {
			expect(parseTimer({ seconds: 60, label: 'x', url }).ok).toBe(false);
		}
	});
	it('refuse un corps qui n’est pas un objet', () => {
		expect(parseTimer(null).ok).toBe(false);
		expect(parseTimer([]).ok).toBe(false);
	});
});

describe('createTimers', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	const make = () => {
		const send = vi.fn().mockResolvedValue(undefined);
		const timers = createTimers({ send, setTimer: setTimeout, clearTimer: (h) => clearTimeout(h as never), now: Date.now });
		return { send, timers };
	};

	it('envoie la notification à l’échéance, une seule fois', () => {
		const { send, timers } = make();
		const { endsAt } = timers.start({ seconds: 300, label: 'Nitrates', url: '/mesurer' });
		expect(new Date(endsAt).getTime()).toBe(Date.now() + 300_000);
		vi.advanceTimersByTime(299_000);
		expect(send).not.toHaveBeenCalled();
		vi.advanceTimersByTime(2_000);
		expect(send).toHaveBeenCalledTimes(1);
		expect(send).toHaveBeenCalledWith({ title: 'Minuteur', body: 'Nitrates : minuteur terminé', url: '/mesurer' });
		vi.advanceTimersByTime(600_000);
		expect(send).toHaveBeenCalledTimes(1);
		expect(timers.list()).toEqual([]);
	});
	it('permet d’annuler un minuteur', () => {
		const { send, timers } = make();
		const { id } = timers.start({ seconds: 60, label: 'KH', url: '/mesurer' });
		expect(timers.list()).toHaveLength(1);
		expect(timers.cancel(id)).toBe(true);
		expect(timers.cancel(id)).toBe(false);
		vi.advanceTimersByTime(120_000);
		expect(send).not.toHaveBeenCalled();
	});
	it('limite le nombre de minuteurs simultanés', () => {
		const { timers } = make();
		for (let i = 0; i < MAX_PENDING; i++) timers.start({ seconds: 60, label: `t${i}`, url: '/mesurer' });
		expect(() => timers.start({ seconds: 60, label: 'trop', url: '/mesurer' })).toThrow(/Dix minuteurs/);
	});
	it('liste les minuteurs par échéance', () => {
		const { timers } = make();
		timers.start({ seconds: 600, label: 'long', url: '/mesurer' });
		timers.start({ seconds: 30, label: 'court', url: '/mesurer' });
		expect(timers.list().map((t) => t.label)).toEqual(['court', 'long']);
	});
});

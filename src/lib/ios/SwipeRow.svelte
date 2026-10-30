<script lang="ts" module>
	import type { IconName } from '$lib/components/Icon.svelte';

	export interface SwipeAction {
		label: string;
		icon?: IconName;
		/** Couleur de fond du bouton, ex. 'var(--green)'. */
		color: string;
		onaction: () => void;
	}

	// Une seule ligne ouverte à la fois, comme dans Mail.
	let closeOpen: (() => void) | null = null;
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';

	/**
	 * Ligne de liste qu'on fait glisser pour révéler des actions (façon Mail) :
	 * vers la droite les actions `leading`, vers la gauche les actions `trailing`.
	 * Glisser jusqu'au bout déclenche la première action. À placer dans un <Section>.
	 */
	interface Props {
		leading?: SwipeAction[];
		trailing?: SwipeAction[];
		children: Snippet;
		class?: string;
	}
	let { leading = [], trailing = [], children, class: cls = '' }: Props = $props();

	const BUTTON = 74;

	let row = $state<HTMLElement>();
	let offset = $state(0);
	let animating = $state(false);
	/** Glissement complet en cours : la première action occupe toute la place. */
	let full = $state(false);

	let startX = 0;
	let startY = 0;
	let base = 0;
	let pressed = false;
	let axis: 'x' | 'y' | null = null;
	let moved = false;
	let lastX = 0;
	let lastT = 0;
	let speed = 0;

	const width = () => row?.offsetWidth ?? 360;
	const reveal = (side: 'leading' | 'trailing') => (side === 'leading' ? leading.length : trailing.length) * BUTTON;

	function settle(to: number) {
		animating = true;
		offset = to;
		full = false;
		if (to === 0) {
			if (closeOpen === close) closeOpen = null;
		} else {
			if (closeOpen && closeOpen !== close) closeOpen();
			closeOpen = close;
		}
	}

	function close() {
		settle(0);
	}

	function down(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		pressed = true;
		startX = lastX = e.clientX;
		startY = e.clientY;
		lastT = performance.now();
		base = offset;
		axis = null;
		moved = false;
		speed = 0;
	}

	function move(e: PointerEvent) {
		if (!pressed || axis === 'y') return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		if (axis === null) {
			if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
			axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
			if (axis === 'y') return;
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
			if (closeOpen && closeOpen !== close) closeOpen();
		}
		moved = true;
		animating = false;
		const now = performance.now();
		speed = (e.clientX - lastX) / Math.max(1, now - lastT);
		lastX = e.clientX;
		lastT = now;

		let next = base + dx;
		// Pas d'actions de ce côté : résistance, la ligne revient.
		if (next > 0 && !leading.length) next = next / 6;
		if (next < 0 && !trailing.length) next = next / 6;
		const w = width();
		const limit = w - 24;
		if (Math.abs(next) > limit) next = Math.sign(next) * (limit + (Math.abs(next) - limit) / 4);
		offset = next;
		full = Math.abs(next) > w * 0.62 && (next > 0 ? leading.length > 0 : trailing.length > 0);
	}

	function up() {
		const wasDragging = pressed && axis === 'x';
		pressed = false;
		if (!wasDragging) return;
		const side = offset > 0 ? 'leading' : 'trailing';
		const actions = side === 'leading' ? leading : trailing;
		if (!actions.length) return settle(0);
		const flick = Math.abs(speed) > 0.9 && Math.sign(speed) === Math.sign(offset) && Math.abs(offset) > reveal(side) * 0.9;
		if (full || flick) {
			// Glissement complet : la ligne file jusqu'au bord, l'action part, puis la ligne revient.
			animating = true;
			full = true;
			offset = Math.sign(offset) * width();
			setTimeout(() => {
				actions[0].onaction();
				settle(0);
			}, 220);
			return;
		}
		const open = reveal(side);
		settle(Math.abs(offset) > open / 2 ? Math.sign(offset) * open : 0);
	}

	function run(action: SwipeAction) {
		action.onaction();
		settle(0);
	}

	// Toucher ailleurs referme la ligne ouverte.
	$effect(() => {
		if (offset === 0) return;
		const outside = (e: PointerEvent) => {
			if (row && !row.contains(e.target as Node)) close();
		};
		addEventListener('pointerdown', outside, true);
		return () => removeEventListener('pointerdown', outside, true);
	});

	// Un clic qui suit un glissement ne doit pas ouvrir la ligne.
	function click(e: MouseEvent) {
		if (moved || offset !== 0) {
			e.preventDefault();
			e.stopPropagation();
			if (!moved) close();
		}
		moved = false;
	}

	const ease = 'cubic-bezier(0.25, 0.9, 0.3, 1.08)';
	const pad = (n: number) => Math.max(0, n);
</script>

<li bind:this={row} class="relative overflow-hidden {cls}">
	{#if offset > 0 && leading.length}
		<div class="absolute inset-y-0 left-0 flex" style="width: {pad(offset)}px">
			{#each leading as a, i (a.label)}
				<button
					type="button"
					class="flex h-full flex-col items-center justify-center gap-1 overflow-hidden text-white"
					style="background: {a.color}; width: {full ? (i === 0 ? pad(offset) : 0) : pad(offset) / leading.length}px; transition: {animating ? `width 300ms ${ease}` : 'none'}"
					onclick={() => run(a)}
				>
					{#if a.icon}<Icon name={a.icon} size={22} weight={2.2} />{/if}
					<span class="caption1 font-semibold">{a.label}</span>
				</button>
			{/each}
		</div>
	{/if}
	{#if offset < 0 && trailing.length}
		<div class="absolute inset-y-0 right-0 flex flex-row-reverse" style="width: {pad(-offset)}px">
			{#each trailing as a, i (a.label)}
				<button
					type="button"
					class="flex h-full flex-col items-center justify-center gap-1 overflow-hidden text-white"
					style="background: {a.color}; width: {full ? (i === 0 ? pad(-offset) : 0) : pad(-offset) / trailing.length}px; transition: {animating ? `width 300ms ${ease}` : 'none'}"
					onclick={() => run(a)}
				>
					{#if a.icon}<Icon name={a.icon} size={22} weight={2.2} />{/if}
					<span class="caption1 font-semibold">{a.label}</span>
				</button>
			{/each}
		</div>
	{/if}
	<div
		class="relative bg-bg2"
		style="transform: translateX({offset}px); transition: {animating ? `transform 320ms ${ease}` : 'none'}; touch-action: pan-y"
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={up}
		onclickcapture={click}
		ontransitionend={() => (animating = false)}
		role="presentation"
	>
		{@render children()}
	</div>
</li>

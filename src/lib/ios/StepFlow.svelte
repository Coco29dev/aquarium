<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Pages horizontales qu'on feuillette au doigt (comme les pages d'accueil ou Santé).
	 * - count : nombre de pages ; index : page courante (liable) ; step(i) : contenu de la page i.
	 * Le glissement verrouille l'axe : le défilement vertical d'une page reste libre.
	 * Un glissement long ou rapide change de page, sinon la page revient avec un ressort.
	 */
	interface Props {
		count: number;
		index: number;
		step: Snippet<[number]>;
		onchange?: (index: number) => void;
	}
	let { count, index = $bindable(0), step, onchange }: Props = $props();

	let drag = $state(0);
	let dragging = $state(false);
	let box = $state<HTMLElement>();

	let pointer = -1;
	let startX = 0;
	let startY = 0;
	let startT = 0;
	let axis: 'x' | 'y' | null = null;
	let moved = false;

	function down(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		pointer = e.pointerId;
		startX = e.clientX;
		startY = e.clientY;
		startT = performance.now();
		axis = null;
		moved = false;
	}

	function move(e: PointerEvent) {
		if (e.pointerId !== pointer) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		if (axis === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
			axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
			if (axis === 'x') {
				dragging = true;
				moved = true;
				box?.setPointerCapture(pointer);
			}
		}
		if (axis !== 'x') return;
		const atStart = index === 0 && dx > 0;
		const atEnd = index === count - 1 && dx < 0;
		drag = atStart || atEnd ? dx * 0.3 : dx;
	}

	function up(e: PointerEvent) {
		if (e.pointerId !== pointer) return;
		pointer = -1;
		if (!dragging) return;
		dragging = false;
		const width = box?.clientWidth ?? 320;
		const speed = Math.abs(drag) / Math.max(1, performance.now() - startT);
		let next = index;
		if (Math.abs(drag) > width * 0.25 || speed > 0.45) next = drag < 0 ? index + 1 : index - 1;
		next = Math.min(count - 1, Math.max(0, next));
		drag = 0;
		if (next !== index) {
			index = next;
			onchange?.(next);
		}
		// Le clic qui suit un glissement ne doit pas déclencher un bouton.
		setTimeout(() => (moved = false), 60);
	}

	function swallowClick(e: MouseEvent) {
		if (moved) {
			e.preventDefault();
			e.stopPropagation();
		}
	}
</script>

<div
	bind:this={box}
	class="overflow-hidden"
	style="touch-action: pan-y"
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
	onclickcapture={swallowClick}
	role="presentation"
>
	<div
		class="flex"
		style="transform: translateX(calc({-index * 100}% + {drag}px)); transition: {dragging ? 'none' : 'transform 420ms cubic-bezier(0.32,0.72,0,1)'}"
	>
		{#each { length: count } as _, i (i)}
			<div class="w-full shrink-0 grow-0 basis-full" inert={i !== index} aria-hidden={i !== index}>
				{@render step(i)}
			</div>
		{/each}
	</div>
</div>

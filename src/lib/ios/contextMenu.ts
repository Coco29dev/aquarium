import { contextMenuState, type MenuItem } from './contextMenuState.svelte';

export type { MenuItem };

const HOLD_MS = 450;
const TOLERANCE = 8;

/**
 * Appui long façon iOS : après 450 ms sans bouger, l'élément se soulève et un menu de verre
 * s'ouvre (ContextMenuHost, monté dans le layout). Le clic qui suit est annulé ; le menu natif
 * d'iOS (aperçu de lien, copier) est bloqué. Clic droit sur ordinateur : ouverture immédiate.
 *
 *   <a href=… use:contextMenu={{ items: [{ label: 'Supprimer', icon: 'trash', destructive: true, onselect }] }}>
 */
export function contextMenu(node: HTMLElement, options: { items: MenuItem[] }) {
	let items = options.items;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let startX = 0;
	let startY = 0;
	let fired = false;

	node.style.setProperty('-webkit-touch-callout', 'none');
	node.style.setProperty('-webkit-user-select', 'none');
	node.style.userSelect = 'none';

	const cancel = () => clearTimeout(timer);

	function down(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		fired = false;
		startX = e.clientX;
		startY = e.clientY;
		cancel();
		timer = setTimeout(() => {
			fired = true;
			contextMenuState.show(node, items);
		}, HOLD_MS);
	}
	function move(e: PointerEvent) {
		if (Math.hypot(e.clientX - startX, e.clientY - startY) > TOLERANCE) cancel();
	}
	function click(e: MouseEvent) {
		if (!fired) return;
		fired = false;
		e.preventDefault();
		e.stopPropagation();
	}
	function menu(e: Event) {
		e.preventDefault();
		if (!fired && (e as PointerEvent).pointerType !== 'touch') {
			cancel();
			fired = true;
			contextMenuState.show(node, items);
		}
	}
	// Empêche la sélection de texte et la loupe pendant l'appui.
	const dragstart = (e: Event) => e.preventDefault();

	node.addEventListener('pointerdown', down);
	node.addEventListener('pointermove', move);
	node.addEventListener('pointerup', cancel);
	node.addEventListener('pointercancel', cancel);
	node.addEventListener('pointerleave', cancel);
	node.addEventListener('click', click, true);
	node.addEventListener('contextmenu', menu);
	node.addEventListener('dragstart', dragstart);

	return {
		update(next: { items: MenuItem[] }) {
			items = next.items;
		},
		destroy() {
			cancel();
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerup', cancel);
			node.removeEventListener('pointercancel', cancel);
			node.removeEventListener('pointerleave', cancel);
			node.removeEventListener('click', click, true);
			node.removeEventListener('contextmenu', menu);
			node.removeEventListener('dragstart', dragstart);
			if (contextMenuState.open?.node === node) contextMenuState.close();
		}
	};
}

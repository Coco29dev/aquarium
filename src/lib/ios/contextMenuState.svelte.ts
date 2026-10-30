import type { IconName } from '$lib/components/Icon.svelte';

export interface MenuItem {
	label: string;
	icon?: IconName;
	destructive?: boolean;
	onselect: () => void;
}

/** Menu contextuel ouvert (un seul à la fois), lu par ContextMenuHost. */
class ContextMenuState {
	open = $state<{ node: HTMLElement; rect: DOMRect; items: MenuItem[] } | null>(null);

	show(node: HTMLElement, items: MenuItem[]) {
		if (!items.length) return;
		this.open = { node, rect: node.getBoundingClientRect(), items };
	}

	close() {
		this.open = null;
	}
}

export const contextMenuState = new ContextMenuState();

<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { contextMenuState } from './contextMenuState.svelte';

	// Affiche le menu contextuel ouvert par l'action use:contextMenu : fond flouté et assombri,
	// copie de l'élément soulevée à sa place, menu de verre dessous (ou dessus faute de place).
	const MENU_W = 250;
	const ROW_H = 46;

	let lift = $state<HTMLElement>();
	// Le doigt qui a ouvert le menu se relève dessus : ce premier clic ne doit rien faire.
	let armed = false;
	$effect(() => {
		if (contextMenuState.open) armed = false;
	});

	const layout = $derived.by(() => {
		const o = contextMenuState.open;
		if (!o) return null;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const menuH = o.items.length * ROW_H;
		const r = o.rect;
		// Élément très haut : on l'affiche tronqué pour garder le menu à l'écran.
		const top = Math.max(12, Math.min(r.top, vh - menuH - 24 - Math.min(r.height, vh * 0.45)));
		const below = top + Math.min(r.height, vh * 0.45) + 10;
		const above = top - menuH - 10;
		const menuTop = below + menuH < vh - 16 ? below : Math.max(12, above);
		const menuLeft = Math.min(Math.max(12, r.left + (r.width > MENU_W ? 0 : r.width / 2 - MENU_W / 2)), vw - MENU_W - 12);
		return { top, menuTop, menuLeft, left: r.left, width: r.width, height: Math.min(r.height, vh * 0.45), origin: menuTop > top ? 'top' : 'bottom' };
	});

	// Copie visuelle de l'élément (sans interactions) posée au-dessus du flou.
	$effect(() => {
		const o = contextMenuState.open;
		if (!o || !lift) return;
		const clone = o.node.cloneNode(true) as HTMLElement;
		clone.style.margin = '0';
		clone.style.width = '100%';
		clone.style.pointerEvents = 'none';
		clone.removeAttribute('id');
		lift.replaceChildren(clone);
		o.node.style.visibility = 'hidden';
		return () => {
			o.node.style.visibility = '';
		};
	});

	$effect(() => {
		if (!contextMenuState.open) return;
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && contextMenuState.close();
		const onScroll = () => contextMenuState.close();
		addEventListener('keydown', onKey);
		addEventListener('resize', onScroll);
		return () => {
			removeEventListener('keydown', onKey);
			removeEventListener('resize', onScroll);
		};
	});

	function select(run: () => void) {
		if (!armed) return;
		contextMenuState.close();
		// Laisse le menu se refermer avant l'action (navigation, alerte…).
		setTimeout(run, 60);
	}
</script>

{#if contextMenuState.open && layout}
	<div class="fixed inset-0 z-[55]" role="presentation" onpointerdowncapture={() => (armed = true)}>
		<button
			class="absolute inset-0 bg-[var(--dim)] backdrop-blur-xl"
			style="animation: fade-in 200ms both"
			aria-label="Fermer le menu"
			onclick={() => armed && contextMenuState.close()}
		></button>
		<div
			bind:this={lift}
			class="ctx-lift pointer-events-none absolute overflow-hidden rounded-[22px] bg-bg2"
			style="top: {layout.top}px; left: {layout.left}px; width: {layout.width}px; max-height: {layout.height}px"
			aria-hidden="true"
		></div>
		<ul
			class="glass absolute overflow-hidden rounded-[22px]"
			style="top: {layout.menuTop}px; left: {layout.menuLeft}px; width: {MENU_W}px; transform-origin: {layout.origin} center; animation: ctx-menu 280ms cubic-bezier(0.3, 0.8, 0.3, 1.15) both; background: var(--glass-strong)"
			role="menu"
		>
			{#each contextMenuState.open.items as item, i (item.label)}
				<li>
					<button
						role="menuitem"
						class="tappable flex h-[46px] w-full items-center gap-3 px-4 text-left {i ? 'shadow-[inset_0_0.5px_0_var(--sep)]' : ''} {item.destructive ? 'text-red' : 'text-label'}"
						onclick={() => select(item.onselect)}
					>
						<span class="body flex-1 truncate">{item.label}</span>
						{#if item.icon}<Icon name={item.icon} size={20} weight={1.9} />{/if}
					</button>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.ctx-lift {
		animation: ctx-lift 300ms cubic-bezier(0.3, 0.8, 0.3, 1.2) both;
		box-shadow: 0 18px 50px rgb(0 0 0 / 0.25);
	}
	@keyframes ctx-lift {
		from {
			transform: scale(1);
			box-shadow: none;
		}
		to {
			transform: scale(1.03);
		}
	}
	@keyframes -global-ctx-menu {
		from {
			opacity: 0;
			transform: scale(0.6);
		}
	}
</style>

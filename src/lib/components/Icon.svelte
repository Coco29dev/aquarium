<script lang="ts" module>
	// Icônes de la charte : grille de 24 px, trait d'encre de 2 px, aplat léger (.f) sous le trait.
	export const ICONS = {
		today: '<circle class="f" cx="12" cy="12" r="8.5"/><path class="c" d="M8.2 12.4l2.6 2.6 5-5.4"/>',
		bacs: '<rect class="f" x="3" y="5.5" width="18" height="14" rx="2.5"/><path class="c" d="M3 11.5c3-2.2 5 2.2 9 0s6 2.2 9 0"/><path class="c" d="M8 16.5h.01M12 15h.01"/>',
		drop: '<path class="f" d="M12 3.2s-6.2 6.6-6.2 11.1a6.2 6.2 0 0 0 12.4 0C18.2 9.8 12 3.2 12 3.2z"/><path class="c" d="M9 14.5a3 3 0 0 0 3 3"/>',
		outils: '<path class="f" d="M14.5 4.5a4 4 0 0 0-4.9 5.2l-5.3 5.3a1.8 1.8 0 0 0 2.6 2.6l5.3-5.3a4 4 0 0 0 5.2-4.9l-2.5 2.5-2.4-.6-.6-2.4z"/>',
		reglages: '<path d="M4 7.5h9M18 7.5h2M4 16.5h2M11 16.5h9"/><circle class="f" cx="15.5" cy="7.5" r="2.4"/><circle class="f" cx="8.5" cy="16.5" r="2.4"/>',
		plus: '<path d="M12 5v14M5 12h14"/>',
		check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
		back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
		next: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
		gear: '<path class="f" d="M10.3 3h3.4l.5 2.4 1.7.7 2-1.4 2.4 2.4-1.4 2 .7 1.7 2.4.5v3.4l-2.4.5-.7 1.7 1.4 2-2.4 2.4-2-1.4-1.7.7-.5 2.4h-3.4l-.5-2.4-1.7-.7-2 1.4-2.4-2.4 1.4-2-.7-1.7L3 13.7v-3.4l2.4-.5.7-1.7-1.4-2 2.4-2.4 2 1.4 1.7-.7z"/><circle class="c" cx="12" cy="12" r="3"/>',
		fish: '<path class="f" d="M3 12c3-5 8-6 12-4 1.5.8 2.6 2.2 3.5 4 .5-.6 1.7-1.7 2.5-2.5v5c-.8-.8-2-1.9-2.5-2.5-.9 1.8-2 3.2-3.5 4-4 2-9 1-12-4z"/><path class="c" d="M8 11.4h.01"/>',
		leaf: '<path class="f" d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path class="c" d="M5 19l8-8"/>',
		chart: '<path d="M3.5 20.5h17"/><path d="M5 15l4.5-5 4 3 6-7"/><circle class="f" cx="19.5" cy="6" r="1.8"/>',
		calendar: '<rect class="f" x="3.5" y="5" width="17" height="15" rx="2.5"/><path class="c" d="M3.5 10h17"/><path d="M8 3v4M16 3v4"/>',
		alert: '<path class="f" d="M12 3.5l9.5 16.5h-19z"/><path class="c" d="M12 10v4.5M12 17.3v.1"/>',
		undo: '<path d="M9 7L4.5 11.5 9 16"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2"/>',
		trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7"/><path class="f" d="M6.5 7l1 13h9l1-13z"/>',
		note: '<path class="f" d="M5 3.5h10l4 4v13H5z"/><path class="c" d="M15 3.5v4h4M8.5 12h7M8.5 16h5"/>',
		camera: '<rect class="f" x="3" y="6.5" width="18" height="13" rx="2.5"/><path d="M8.5 6.5l1.5-2.5h4l1.5 2.5"/><circle class="c" cx="12" cy="13" r="3.2"/>',
		box: '<path class="f" d="M3.5 8l8.5-4.5L20.5 8v9L12 21.5 3.5 17z"/><path class="c" d="M3.5 8L12 12.5 20.5 8M12 12.5v9"/>',
		euro: '<path d="M17.5 6.5a6.5 6.5 0 1 0 0 11"/><path d="M4.5 10.5h9M4.5 13.5h9"/>',
		book: '<path class="f" d="M4 4.5h6.5a2 2 0 0 1 1.5.7 2 2 0 0 1 1.5-.7H20v14h-6.5a2 2 0 0 0-1.5.7 2 2 0 0 0-1.5-.7H4z"/><path class="c" d="M12 5.2v14"/>',
		bell: '<path class="f" d="M6 17v-6a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21h4"/>',
		sync: '<path d="M4.5 12a7.5 7.5 0 0 1 13-5.1L19.5 9"/><path d="M19.5 4.5V9H15"/><path d="M19.5 12a7.5 7.5 0 0 1-13 5.1L4.5 15"/><path d="M4.5 19.5V15H9"/>',
		download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M4.5 19.5h15"/>',
		up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
		down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
		flat: '<path d="M5 12h14M13 6l6 6-6 6"/>',
		edit: '<path class="f" d="M4.5 19.5l1-4.5L16 4.5l3.5 3.5L9 18.5z"/><path class="c" d="M13.5 7l3.5 3.5"/>',
		close: '<path d="M6 6l12 12M18 6L6 18"/>',
		search: '<circle class="f" cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
		coral: '<path d="M12 21v-7M12 14c0-3-3-4-3-7M12 14c0-2.5 3-3.5 3-6.5M9 7c0-1.5-1.5-2.5-2.5-3.5M9 9.5c-2 0-3.5-1-4-3M15 7.5c0-1.6 1.2-2.6 2.5-3.5M15 10c2 0 3.5-1 4-3"/><path class="f" d="M7 21h10l-1-2H8z"/>',
		ellipsis: '<circle cx="6" cy="12" r="1.3" class="dot"/><circle cx="12" cy="12" r="1.3" class="dot"/><circle cx="18" cy="12" r="1.3" class="dot"/>',
		info: '<circle class="f" cx="12" cy="12" r="9"/><path class="c" d="M12 11v5.5M12 7.8v.1"/>',
		thermo: '<path class="f" d="M10 4.5a2 2 0 0 1 4 0v9.2a4 4 0 1 1-4 0z"/><path class="c" d="M12 10v6"/>',
		flask: '<path class="f" d="M9.5 3.5h5M10.3 3.5v5.3L5 18.2a1.6 1.6 0 0 0 1.4 2.3h11.2a1.6 1.6 0 0 0 1.4-2.3l-5.3-9.4V3.5"/><path class="c" d="M7.5 14h9"/>',
		person: '<circle class="f" cx="12" cy="8" r="3.8"/><path class="f" d="M4.5 20.5c.8-4 3.8-6 7.5-6s6.7 2 7.5 6z"/>',
		lock: '<rect class="f" x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
		sun: '<circle class="f" cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
		bubbles: '<circle class="f" cx="9" cy="14" r="5"/><circle cx="17" cy="7" r="2.6"/><circle cx="18.5" cy="17" r="1.6"/>',
		cycle: '<path d="M12 4a8 8 0 1 1-7.4 5"/><path d="M4 4.5v4.8h4.8"/><circle class="f" cx="12" cy="12" r="2.5"/>'
	} as const;

	export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
	// filled : variante pleine (onglet actif), les traits intérieurs passent en couleur de découpe.
	let {
		name,
		size = 24,
		filled = false,
		weight = 1.8,
		class: cls = ''
	}: { name: IconName; size?: number; filled?: boolean; weight?: number; class?: string } = $props();
</script>

<svg
	class="icon {filled ? 'filled' : ''} {cls}"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	style="stroke-width: {weight}"
	aria-hidden="true">{@html ICONS[name]}</svg
>

<style>
	.icon {
		flex: none;
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.icon :global(.f) {
		fill: none;
	}
	.icon :global(.dot) {
		fill: currentColor;
		stroke: none;
	}
	.filled :global(.f) {
		fill: currentColor;
	}
	.filled :global(.c) {
		stroke: var(--cut, var(--bg2));
	}
</style>

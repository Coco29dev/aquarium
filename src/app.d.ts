// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			authenticated: boolean;
		}
	}
}

// Attribut « switch » de Safari (interrupteur iOS natif avec retour haptique).
declare module 'svelte/elements' {
	interface HTMLInputAttributes {
		switch?: boolean | null;
	}
}

export {};

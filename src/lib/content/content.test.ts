import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALL_GUIDES, THEMES, guideText, resolveRelated } from './index';

const core = new Set<string>();
for (const f of readdirSync('data/core').filter((x) => x.endsWith('.jsonl'))) {
	for (const line of readFileSync(`data/core/${f}`, 'utf8').split('\n')) {
		if (line.trim()) core.add(JSON.parse(line).s.toLowerCase());
	}
}

describe('contenu des guides', () => {
	it('chaque thème a un identifiant unique et des guides', () => {
		expect(new Set(THEMES.map((t) => t.slug)).size).toBe(THEMES.length);
		for (const t of THEMES) expect(t.guides.length).toBeGreaterThan(0);
	});

	it('les identifiants de guides sont uniques dans un thème', () => {
		for (const t of THEMES) expect(new Set(t.guides.map((g) => g.slug)).size).toBe(t.guides.length);
	});

	it('tous les liens « à lire ensuite » mènent quelque part', () => {
		for (const { theme, guide } of ALL_GUIDES) {
			for (const ref of guide.related ?? []) expect(resolveRelated(ref), `${theme.slug}/${guide.slug} → ${ref}`).toBeTruthy();
		}
	});

	it('toutes les espèces citées existent dans l’encyclopédie', () => {
		for (const { theme, guide } of ALL_GUIDES) {
			for (const s of guide.species ?? []) expect(core.has(s.toLowerCase()), `${theme.slug}/${guide.slug} : ${s}`).toBe(true);
		}
	});

	it('chaque guide a du contenu et un temps de lecture', () => {
		for (const { guide } of ALL_GUIDES) {
			expect(guide.blocks.length).toBeGreaterThan(0);
			expect(guide.minutes).toBeGreaterThan(0);
			expect(guideText(guide).length).toBeGreaterThan(200);
		}
	});

	it('les liens d’outils pointent vers des écrans de l’appli', () => {
		for (const { guide } of ALL_GUIDES) if (guide.tool) expect(guide.tool.href.startsWith('/')).toBe(true);
	});
});

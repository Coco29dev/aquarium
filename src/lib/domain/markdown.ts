// Mise en forme minimale des réponses de l'assistant : gras, code, listes, paragraphes.
// Le texte est d'abord échappé : le résultat peut être injecté tel quel avec {@html}.

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const inline = (text: string) =>
	escapeHtml(text)
		.replace(/`([^`]+)`/g, '<code>$1</code>')
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

export function renderMarkdown(source: string): string {
	const out: string[] = [];
	let list: 'ul' | 'ol' | null = null;
	let paragraph: string[] = [];
	const flushParagraph = () => {
		if (paragraph.length) out.push(`<p>${paragraph.join('<br>')}</p>`);
		paragraph = [];
	};
	const closeList = () => {
		if (list) out.push(`</${list}>`);
		list = null;
	};
	for (const raw of source.split('\n')) {
		const line = raw.trimEnd();
		const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
		const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
		const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
		if (bullet || numbered) {
			flushParagraph();
			const kind = bullet ? 'ul' : 'ol';
			if (list !== kind) {
				closeList();
				out.push(`<${kind}>`);
				list = kind;
			}
			out.push(`<li>${inline((bullet ?? numbered)![1])}</li>`);
		} else if (!line.trim()) {
			flushParagraph();
			closeList();
		} else {
			closeList();
			paragraph.push(heading ? `<strong>${inline(heading[1])}</strong>` : inline(line));
		}
	}
	flushParagraph();
	closeList();
	return out.join('');
}

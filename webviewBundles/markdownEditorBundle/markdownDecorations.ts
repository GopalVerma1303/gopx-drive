import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { ensureSyntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';

// Adds markdown-specific CSS classes to lines/spans based on the syntax tree.
// This mirrors Joplin's approach (blockquote/codeblock/headers/etc.) but is implemented
// independently for this codebase.

const noSpellCheckAttrs = { spellcheck: 'false', autocorrect: 'false' } as const;

const lineClass = (className: string, attrs?: Record<string, string>) => Decoration.line({
	attributes: { class: className, ...(attrs ?? {}) },
});

const markClass = (className: string, attrs?: Record<string, string>) => Decoration.mark({
	attributes: { class: className, ...(attrs ?? {}) },
});

const regionStart = lineClass('cm-regionFirstLine');
const regionEnd = lineClass('cm-regionLastLine');

const codeBlockLine = lineClass('cm-codeBlock', noSpellCheckAttrs as any);
const inlineCode = markClass('cm-inlineCode', noSpellCheckAttrs as any);

const blockQuoteLine = lineClass('cm-blockQuote');

const headerLine = (level: number) => lineClass(`cm-h${level} cm-headerLine cm-header`);

const mathBlockLine = lineClass('cm-mathBlock', noSpellCheckAttrs as any);
const inlineMath = markClass('cm-inlineMath', noSpellCheckAttrs as any);

const urlMark = markClass('cm-url', noSpellCheckAttrs as any);
const tableHeaderLine = lineClass('cm-tableHeader');
const tableRowLine = lineClass('cm-tableRow');
const tableDelimiterLine = lineClass('cm-tableDelimiter');
const taskMarker = markClass('cm-taskMarker', noSpellCheckAttrs as any);
const strike = markClass('cm-strike');
const hr = markClass('cm-hr');

const lineNodeMap: Record<string, Decoration> = {
	FencedCode: codeBlockLine,
	CodeBlock: codeBlockLine,
	Blockquote: blockQuoteLine,
	BlockMath: mathBlockLine,

	SetextHeading1: headerLine(1),
	ATXHeading1: headerLine(1),
	SetextHeading2: headerLine(2),
	ATXHeading2: headerLine(2),
	ATXHeading3: headerLine(3),
	ATXHeading4: headerLine(4),
	ATXHeading5: headerLine(5),
	ATXHeading6: headerLine(6),

	TableHeader: tableHeaderLine,
	TableDelimiter: tableDelimiterLine,
	TableRow: tableRowLine,
};

const markNodeMap: Record<string, Decoration> = {
	InlineCode: inlineCode,
	InlineMath: inlineMath,
	URL: urlMark,
	HorizontalRule: hr,
	TaskMarker: taskMarker,
	Strikethrough: strike,
};

const multilineLineNodes: Record<string, true> = {
	FencedCode: true,
	CodeBlock: true,
	Blockquote: true,
	BlockMath: true,
};

type DecorationItem = { from: number; to: number; deco: Decoration; isLine: boolean };

const computeDecorations = (view: EditorView) => {
	const items: DecorationItem[] = [];

	const addLineRange = (from: number, to: number, deco: Decoration) => {
		let pos = from;
		while (pos <= to) {
			const line = view.state.doc.lineAt(pos);
			items.push({ from: line.from, to: line.from, deco, isLine: true });
			pos = line.to + 1;
		}
	};

	const addMarkRange = (from: number, to: number, deco: Decoration) => {
		items.push({ from, to, deco, isLine: false });
	};

	for (const range of view.visibleRanges) {
		const tree = ensureSyntaxTree(view.state, range.to);
		if (!tree) continue;

		tree.iterate({
			from: range.from,
			to: range.to,
			enter: (node) => {
				const from = Math.max(range.from, node.from);
				const to = Math.min(range.to, node.to);

				const lineDeco = lineNodeMap[node.name];
				const markDeco = markNodeMap[node.name];

				if (lineDeco) {
					addLineRange(from, to, lineDeco);

					// Allow special first/last line styling for multi-line blocks.
					if (multilineLineNodes[node.name]) {
						if (from === node.from) addLineRange(from, from, regionStart);
						if (to === node.to) addLineRange(to, to, regionEnd);
					}
				}

				if (markDeco) {
					addMarkRange(from, to, markDeco);
				}
			},
		});
	}

	// RangeSetBuilder requires sorted input by position then length.
	items.sort((a, b) => (a.from - b.from) || ((a.to - a.from) - (b.to - b.from)));

	const builder = new RangeSetBuilder<Decoration>();
	for (const item of items) {
		// For line decorations, length doesn't matter (line deco uses from only).
		builder.add(item.from, item.to, item.deco);
	}
	return builder.finish();
};

const markdownDecorations = ViewPlugin.fromClass(class {
	public decorations: DecorationSet;

	public constructor(view: EditorView) {
		this.decorations = computeDecorations(view);
	}

	public update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			this.decorations = computeDecorations(update.view);
		}
	}
}, {
	decorations: v => v.decorations,
});

export default markdownDecorations;


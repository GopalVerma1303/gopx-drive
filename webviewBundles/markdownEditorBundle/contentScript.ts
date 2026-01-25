import { EditorState, Compartment, RangeSetBuilder } from '@codemirror/state';
import {
	Decoration,
	EditorView,
	keymap,
	placeholder as placeholderExtension,
	ViewPlugin,
	WidgetType,
	type DecorationSet,
	ViewUpdate,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownKeymap } from '@codemirror/lang-markdown';
import { javascript } from '@codemirror/lang-javascript';
import { syntaxHighlighting, defaultHighlightStyle, HighlightStyle, ensureSyntaxTree } from '@codemirror/language';
import { tags, classHighlighter } from '@lezer/highlight';
import markdownDecorations from './markdownDecorations';
import { gfmMarkdownLanguage } from './gfmMarkdownLanguage';

// Newer versions of CodeMirror may enable Chrome's EditContext API by default.
// This causes major issues on Android WebView. Joplin disables it; we do the same.
// See:
// - https://github.com/codemirror/dev/issues/1450
// - https://github.com/codemirror/dev/issues/1451
try {
	(EditorView as any).EDIT_CONTEXT = false;
} catch {
	// no-op
}

type Theme = {
	dark?: boolean;
	background?: string;
	foreground?: string;
	muted?: string;
	mutedForeground?: string;
	ring?: string;
	primary?: string;
	caret?: string;
	selection?: string;
	gutterForeground?: string;
	lineHighlight?: string;
	placeholder?: string;
	padX?: number | string;
	padTop?: number | string;
	padBottom?: number | string;
	fontSize?: number | string;
	lineHeight?: number | string;
};

type SelectionRange = { start: number; end: number };

type InitArgs = {
	value?: string;
	placeholder?: string;
	theme?: Theme;
	selection?: SelectionRange;
};

type RpcRequest = { kind: 'rpc'; id: string; method: string; args: unknown[] };
type RpcResult = { kind: 'rpc:result'; id: string; result: unknown };
type RpcError = { kind: 'rpc:error'; id: string; error: { message: string; stack?: string } };
type WebViewEvent = { kind: 'event'; type: string; payload?: unknown };
type IncomingMessage = RpcRequest;

declare const window: Window & {
	ReactNativeWebView?: { postMessage: (message: string) => void };
	__GOPX_PENDING_HOST_MESSAGES__?: unknown[];
	gopxMarkdownEditorBundle?: unknown;
};

const sendToHost = (message: RpcResult | RpcError | WebViewEvent) => {
	try {
		window.ReactNativeWebView?.postMessage(JSON.stringify(message));
	} catch {
		// no-op
	}
};

const safeJsonParse = (input: unknown): unknown => {
	if (typeof input !== 'string') return null;
	try {
		return JSON.parse(input);
	} catch {
		return null;
	}
};

const clampSelection = (docLength: number, selection: Partial<SelectionRange> | null | undefined): SelectionRange => {
	const start = Math.max(0, Math.min(docLength, selection?.start ?? 0));
	const end = Math.max(0, Math.min(docLength, selection?.end ?? start));
	return { start, end };
};

const setThemeVars = (theme: Theme | null | undefined) => {
	if (!theme || typeof theme !== 'object') return;

	const root = document.documentElement;
	const set = (k: string, v: unknown) => {
		if (typeof v === 'string' && v.length) root.style.setProperty(k, v);
	};
	const setPx = (k: string, v: unknown) => {
		if (typeof v === 'number' && Number.isFinite(v)) root.style.setProperty(k, `${v}px`);
		else if (typeof v === 'string' && v.length) root.style.setProperty(k, v);
	};

	set('--bg', theme.background);
	set('--fg', theme.foreground);
	set('--muted', theme.muted);
	set('--muted-fg', theme.mutedForeground);
	set('--ring', theme.ring);
	set('--primary', theme.primary);
	set('--caret', theme.caret);
	set('--selection', theme.selection);
	set('--gutter-fg', theme.gutterForeground);
	set('--line-highlight', theme.lineHighlight);
	set('--placeholder', theme.placeholder);

	setPx('--pad-x', theme.padX);
	setPx('--pad-top', theme.padTop);
	setPx('--pad-bottom', theme.padBottom);
	setPx('--font-size', theme.fontSize);
	setPx('--line-height', theme.lineHeight);

	// Joplin-like syntax token palette (used by HighlightStyle below).
	// These are intentionally "opinionated" and match Joplin's defaults closely.
	const isDark = !!theme.dark;
	root.style.setProperty('--cm-urlColor', isDark ? '#5da8ff' : '#0066cc');
	root.style.setProperty('--cm-mathColor', isDark ? '#9fa' : '#276');
	root.style.setProperty('--cm-kw', isDark ? '#ff7' : '#740');
	root.style.setProperty('--cm-op', isDark ? '#f7f' : '#805');
	root.style.setProperty('--cm-lit', isDark ? '#aaf' : '#037');
	root.style.setProperty('--cm-tn', isDark ? '#7ff' : '#a00');
	root.style.setProperty('--cm-ins', isDark ? '#7f7' : '#471');
	root.style.setProperty('--cm-del', isDark ? '#f96' : '#a21');
	root.style.setProperty('--cm-prop', isDark ? '#d96' : '#940');
	root.style.setProperty('--cm-class', isDark ? '#d8a' : '#904');
};

const createCmTheme = (dark: boolean) => {
	return EditorView.theme(
		{
			'&': {
				color: 'var(--fg)',
				backgroundColor: 'var(--bg)',
				minHeight: '100vh',
			},
			'& div, & span, & a': {
				fontFamily: 'inherit',
			},
			'.cm-editor': {
				minHeight: '100vh',
			},
			'.cm-scroller': {
				// Joplin-style: allow external (page) scrolling by not forcing an internal scroller.
				overflow: 'visible',
				backgroundColor: 'var(--bg)',
				WebkitOverflowScrolling: 'touch',
				overscrollBehavior: 'contain',
				fontFamily: 'var(--font)',
			},
			'.cm-content': {
				paddingLeft: 'var(--pad-x)',
				paddingRight: 'var(--pad-x)',
				paddingTop: 'var(--pad-top)',
				paddingBottom: 'var(--pad-bottom)',
				caretColor: 'var(--caret)',
				fontSize: 'var(--font-size)',
				lineHeight: 'var(--line-height)',
			},
			'.cm-dropCursor': {
				backgroundColor: dark ? 'white' : 'black',
				width: '1px',
			},
			'.cm-gutters': {
				backgroundColor: 'var(--bg)',
				color: 'var(--gutter-fg)',
				border: 'none',
			},
			'.cm-activeLine': {
				backgroundColor: 'var(--line-highlight)',
			},
			'.cm-selectionBackground, ::selection': {
				backgroundColor: 'var(--selection) !important',
			},
			'.cm-placeholder': { color: 'var(--placeholder)' },

			// "Rich Markdown" style preview helpers (hide markup + render checkboxes/markers).
			'.cm-livePreviewHidden': {
				display: 'inline-block',
				width: '0px',
				overflow: 'hidden',
			},
			'.cm-livePreviewListMark': {
				font: 'inherit',
				color: 'var(--fg)',
				opacity: dark ? '0.9' : '0.85',
				marginRight: '0.2em',
				userSelect: 'none',
			},
			'.cm-livePreviewCheckbox': {
				font: 'inherit',
				color: 'var(--fg)',
				userSelect: 'none',
				display: 'inline-flex',
				alignItems: 'center',
				marginRight: '0.2em',
			},
			'.cm-livePreviewCheckboxBox': {
				width: '16px',
				height: '16px',
				borderRadius: '4px',
				borderWidth: '2px',
				borderStyle: 'solid',
				display: 'inline-flex',
				alignItems: 'center',
				justifyContent: 'center',
				transform: 'translateY(1px)',
			},
			'.cm-livePreviewCheckboxBox.is-unchecked': {
				backgroundColor: 'transparent',
				borderColor: '#ef4444', // red-500
			},
			'.cm-livePreviewCheckboxBox.is-checked': {
				backgroundColor: '#22c55e', // green-500
				borderColor: '#22c55e',
			},
			'.cm-livePreviewCheckboxCheck': {
				color: 'white',
				fontSize: '12px',
				lineHeight: '12px',
				fontWeight: '700',
				transform: 'translateY(-0.5px)',
				opacity: '0',
			},
			'.cm-livePreviewCheckboxBox.is-checked .cm-livePreviewCheckboxCheck': {
				opacity: '1',
			},

			// Joplin-like markdown block styling (driven by markdownDecorations).
			'.cm-blockQuote': {
				backgroundColor: 'var(--muted)',
				borderLeft: '4px solid var(--ring)',
				paddingLeft: '16px',
				paddingRight: '16px',
				fontStyle: 'italic',
				color: 'var(--muted-fg)',
			},
			'.cm-blockQuote.cm-regionFirstLine': {
				paddingTop: '8px',
				marginTop: '8px',
				borderTopLeftRadius: '4px',
				borderTopRightRadius: '4px',
			},
			'.cm-blockQuote.cm-regionLastLine': {
				paddingBottom: '8px',
				marginBottom: '8px',
				borderBottomLeftRadius: '4px',
				borderBottomRightRadius: '4px',
			},
			'.cm-codeBlock': {
				borderWidth: '1px',
				borderStyle: 'solid',
				borderColor: 'var(--ring)',
				backgroundColor: 'var(--muted)',
				color: 'var(--fg)',
				fontSize: '14px',
				paddingLeft: '12px',
				paddingRight: '12px',
				fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
			},
			'.cm-codeBlock.cm-regionFirstLine, .cm-codeBlock.cm-regionLastLine': {
				borderRadius: '8px',
			},
			'.cm-codeBlock.cm-regionFirstLine': {
				paddingTop: '12px',
				marginTop: '8px',
			},
			'.cm-codeBlock.cm-regionLastLine': {
				paddingBottom: '12px',
				marginBottom: '8px',
			},
			'.cm-codeBlock:not(.cm-regionFirstLine)': {
				borderTop: 'none',
				borderTopLeftRadius: '0',
				borderTopRightRadius: '0',
			},
			'.cm-codeBlock:not(.cm-regionLastLine)': {
				borderBottom: 'none',
				borderBottomLeftRadius: '0',
				borderBottomRightRadius: '0',
			},
			'.cm-inlineCode': {
				color: '#FF69B4',
				fontSize: '14px',
				backgroundColor: 'transparent',
				border: 'none',
				fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
			},
			'.cm-mathBlock, .cm-inlineMath': {
				color: 'var(--cm-mathColor)',
			},
			'.cm-tableHeader, .cm-tableRow, .cm-tableDelimiter': {
				fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
			},
			'.cm-taskMarker': {
				fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
			},
			'.cm-strike': {
				textDecoration: 'line-through',
			},
			'.cm-h1': {
				color: 'var(--fg)',
				fontSize: '32px',
				fontWeight: 'bold',
				lineHeight: '32px',
				marginTop: '16px',
				marginBottom: '8px',
			},
			'.cm-h2': {
				color: 'var(--fg)',
				fontSize: '28px',
				fontWeight: 'bold',
				lineHeight: '28px',
				marginTop: '14px',
				marginBottom: '7px',
			},
			'.cm-h3': {
				color: 'var(--fg)',
				fontSize: '24px',
				fontWeight: '600',
				lineHeight: '24px',
				marginTop: '12px',
				marginBottom: '6px',
			},
			'.cm-h4': {
				color: 'var(--fg)',
				fontSize: '20px',
				fontWeight: '600',
				lineHeight: '20px',
				marginTop: '10px',
				marginBottom: '5px',
			},
			'.cm-h5': { fontWeight: 'bold', fontSize: '18px', lineHeight: '18px' },
			'.cm-h6': { fontWeight: 'bold', fontSize: '16px', lineHeight: '16px' },

			// Default URL style when URL is within a link.
			'.tok-url.tok-link, .tok-link.tok-meta, .tok-link.tok-string': {
				opacity: '0.661',
			},
		},
		{ dark },
	);
};

const joplinLikeHighlightStyle = HighlightStyle.define([
	{ tag: tags.strong, fontWeight: 'bold' },
	{ tag: tags.emphasis, fontStyle: 'italic' },
	{ tag: tags.list, fontFamily: 'inherit' },
	{ tag: tags.comment, opacity: '0.9', fontStyle: 'italic' },
	{ tag: tags.link, color: 'var(--primary)', textDecoration: 'underline' },

	// Code block content palette (matches Joplin defaults).
	{ tag: tags.keyword, color: 'var(--cm-kw)' },
	{ tag: tags.operator, color: 'var(--cm-op)' },
	{ tag: tags.literal, color: 'var(--cm-lit)' },
	{ tag: tags.typeName, color: 'var(--cm-tn)' },
	{ tag: tags.inserted, color: 'var(--cm-ins)' },
	{ tag: tags.deleted, color: 'var(--cm-del)' },
	{ tag: tags.propertyName, color: 'var(--cm-prop)' },
	{ tag: tags.className, color: 'var(--cm-class)' },
]);

class EmptyWidget extends WidgetType {
	public override toDOM(): HTMLElement {
		const el = document.createElement('span');
		el.className = 'cm-livePreviewHidden';
		return el;
	}

	public override ignoreEvent(_event: Event) {
		// Treat hidden markup widgets as non-interactive.
		return true;
	}
}

class ListMarkWidget extends WidgetType {
	public constructor(
		private readonly text: string,
		private readonly focusPos: number,
	) {
		super();
	}

	public override eq(other: ListMarkWidget) {
		return this.text === other.text && this.focusPos === other.focusPos;
	}

	public override toDOM(view: EditorView): HTMLElement {
		const el = document.createElement('span');
		el.className = 'cm-livePreviewListMark';
		el.setAttribute('contenteditable', 'false');
		el.textContent = this.text;

		const focusEditorHere = (event: Event) => {
			event.preventDefault();
			// Prevent CodeMirror's own mouse selection handler from running after
			// we dispatch selection/focus. Otherwise, it may try to resolve a DOM
			// position from an event target that gets replaced during this update,
			// which can throw "Invalid child in posBefore".
			event.stopPropagation();
			(event as any).stopImmediatePropagation?.();
			view.dispatch({ selection: { anchor: this.focusPos }, scrollIntoView: true });
			view.focus();
		};

		el.addEventListener('mousedown', focusEditorHere);
		el.addEventListener('click', focusEditorHere);
		el.addEventListener('touchstart', focusEditorHere, { passive: false });
		return el;
	}

	public override ignoreEvent(_event: Event) {
		// We handle focus/selection ourselves and don't want CM's default
		// mouse selection to also run for this widget.
		return true;
	}
}

class CheckboxWidget extends WidgetType {
	public constructor(
		private readonly checked: boolean,
		private readonly togglePos: number,
	) {
		super();
	}

	public override eq(other: CheckboxWidget) {
		return this.checked === other.checked && this.togglePos === other.togglePos;
	}

	public override toDOM(view: EditorView): HTMLElement {
		const wrap = document.createElement('span');
		wrap.className = 'cm-livePreviewCheckbox';
		wrap.setAttribute('contenteditable', 'false');
		const stop = (e: Event) => e.stopPropagation();
		wrap.addEventListener('mousedown', stop);
		wrap.addEventListener('click', stop);
		wrap.addEventListener('touchstart', stop);

		const box = document.createElement('span');
		box.className = `cm-livePreviewCheckboxBox ${this.checked ? 'is-checked' : 'is-unchecked'}`;
		box.setAttribute('role', 'checkbox');
		box.setAttribute('aria-checked', this.checked ? 'true' : 'false');

		const check = document.createElement('span');
		check.className = 'cm-livePreviewCheckboxCheck';
		check.textContent = '✓';
		box.appendChild(check);

		const onToggle = (event: Event) => {
			event.preventDefault();
			const cur = view.state.doc.sliceString(this.togglePos, this.togglePos + 1);
			const next = cur.toLowerCase() === 'x' ? ' ' : 'x';
			view.dispatch({ changes: { from: this.togglePos, to: this.togglePos + 1, insert: next } });
			view.focus();
		};

		box.addEventListener('click', onToggle);
		box.addEventListener('mousedown', (e) => e.preventDefault());
		box.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

		wrap.appendChild(box);
		wrap.appendChild(document.createTextNode(' '));
		return wrap;
	}

	public override ignoreEvent() {
		return true;
	}
}

const emptyWidget = new EmptyWidget();

const markdownInlinePreview = ViewPlugin.fromClass(class {
	public decorations: DecorationSet;

	public constructor(view: EditorView) {
		this.decorations = this.compute(view);
	}

	public update(update: ViewUpdate) {
		if (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged) {
			this.decorations = this.compute(update.view);
		}
	}

	private compute(view: EditorView): DecorationSet {
		const isFocused = view.hasFocus;
		const sel = view.state.selection.main;
		const selFrom = Math.min(sel.from, sel.to);
		const selTo = Math.max(sel.from, sel.to);
		const selIsCollapsed = selFrom === selTo;
		const cursorPos = selTo;

		const taskMarkerRangeCache = new Map<number, { start: number; end: number } | null>();
		const taskMarkerRangeForLine = (lineFrom: number, lineTo: number) => {
			if (taskMarkerRangeCache.has(lineFrom)) return taskMarkerRangeCache.get(lineFrom)!;
			const text = view.state.doc.sliceString(lineFrom, lineTo);
			const m = /^(\s*(?:[-+*]|\d+\.)\s*)\[( |x|X)\]/.exec(text);
			if (!m) {
				taskMarkerRangeCache.set(lineFrom, null);
				return null;
			}
			const start = lineFrom + (m[1]?.length ?? 0);
			const end = start + 3;
			const r = { start, end };
			taskMarkerRangeCache.set(lineFrom, r);
			return r;
		};

		const items: Array<{ from: number; to: number; deco: Decoration }> = [];
		const add = (from: number, to: number, deco: Decoration) => {
			if (from >= to) return;
			const line = view.state.doc.lineAt(from);
			if (to > line.to) return;
			items.push({ from, to, deco });
		};

		const taskLinesWithSyntaxNode = new Set<number>();

		for (const range of view.visibleRanges) {
			const tree = ensureSyntaxTree(view.state, range.to);
			if (!tree) continue;

			tree.iterate({
				from: range.from,
				to: range.to,
				enter: (node) => {
					const from = node.from;
					const to = node.to;

					const line = view.state.doc.lineAt(from);
					const overlapsSelection = isFocused && selFrom <= line.to && selTo >= line.from;
					let treatLineAsActive = overlapsSelection;
					if (treatLineAsActive && selIsCollapsed) {
						const r = taskMarkerRangeForLine(line.from, line.to);
						if (r && cursorPos >= r.start && cursorPos <= r.end) {
							// Cursor is on the checkbox marker itself -> keep preview mode.
							treatLineAsActive = false;
						}
					}
					if (treatLineAsActive) return;

					// If this line is a task list item, don't apply other inline replacements
					// inside the "[ ]"/"[x]" marker range—otherwise they can "win" over the checkbox.
					const taskRange = taskMarkerRangeForLine(line.from, line.to);
					if (taskRange && from >= taskRange.start && to <= taskRange.end && node.name !== 'TaskMarker') {
						return;
					}

					if (node.name === 'TaskMarker') {
						const text = view.state.doc.sliceString(from, to);
						const isChecked = /\[x\]/i.test(text);
						const togglePos = Math.min(to - 2, from + 1);
						add(from, to, Decoration.replace({ widget: new CheckboxWidget(isChecked, togglePos) }));
						taskLinesWithSyntaxNode.add(line.from);
						return;
					}

					// Hide link destinations like: [text](url) / ![alt](url)
					// (We don't want to hide bare URLs in text.)
					if (node.name === 'URL') {
						const relFrom = from - line.from;
						if (relFrom >= 2) {
							const lineText = view.state.doc.sliceString(line.from, line.to);
							const before2 = lineText.slice(relFrom - 2, relFrom);
							if (before2 === '](' || before2 === ']<' ) {
								add(from, to, Decoration.replace({ widget: emptyWidget }));
								return;
							}
						}
					}

					const isMark = node.name.endsWith('Mark') || node.name === 'HeaderMark' || node.name === 'QuoteMark';
					if (!isMark) return;

					const text = view.state.doc.sliceString(from, to).trim();
					if (!text) {
						add(from, to, Decoration.replace({ widget: emptyWidget }));
						return;
					}

					if (node.name === 'ListMark') {
						const fullLineText = view.state.doc.sliceString(line.from, line.to);
						if (/^\s*(?:[-+*]|\d+\.)\s*\[(?: |x|X)\]/.test(fullLineText)) {
							// Task list items shouldn't show an extra bullet before the checkbox.
							add(from, to, Decoration.replace({ widget: emptyWidget }));
							return;
						}
						const marker = /^\d+\.$/.test(text) ? `${text} ` : '• ';
						add(from, to, Decoration.replace({ widget: new ListMarkWidget(marker, line.from) }));
						return;
					}

					add(from, to, Decoration.replace({ widget: emptyWidget }));
				},
			});
		}

		// Fallback: if the syntax tree doesn't include TaskMarker (parser differences on some platforms),
		// detect task markers by regex and render the checkbox anyway.
		for (const range of view.visibleRanges) {
			let pos = range.from;
			while (pos <= range.to) {
				const line = view.state.doc.lineAt(pos);
				pos = line.to + 1;
				if (taskLinesWithSyntaxNode.has(line.from)) continue;

				const overlapsSelection = isFocused && selFrom <= line.to && selTo >= line.from;
				if (overlapsSelection) {
					if (!selIsCollapsed) continue;
					const r = taskMarkerRangeForLine(line.from, line.to);
					if (!r || cursorPos < r.start || cursorPos > r.end) continue;
				}

				const text = view.state.doc.sliceString(line.from, line.to);
				const m = /^(\s*(?:[-+*]|\d+\.)\s*)\[( |x|X)\]/.exec(text);
				if (!m) continue;

				const start = line.from + (m[1]?.length ?? 0);
				const end = start + 3; // "[ ]" / "[x]"
				const togglePos = start + 1;
				const isChecked = (m[2] ?? '').toLowerCase() === 'x';
				add(start, end, Decoration.replace({ widget: new CheckboxWidget(isChecked, togglePos) }));
			}
		}

		items.sort((a, b) => (a.from - b.from) || (a.to - b.to));
		const builder = new RangeSetBuilder<Decoration>();
		let lastTo = -1;
		for (const item of items) {
			if (item.from < lastTo) continue;
			builder.add(item.from, item.to, item.deco);
			lastTo = item.to;
		}
		return builder.finish();
	}
}, { decorations: v => v.decorations });

// IMPORTANT:
// Using `@codemirror/language-data` causes lazy language loading via dynamic import and "skipping parsers".
// In Android WebView this can lead to Lezer TreeBuffer class identity mismatches and crashes when typing
// in fenced code blocks (e.g. ```js).
//
// To match Joplin's stability, keep code fence languages synchronous and bundled.
// Cache language supports so embedded parsers are stable.
const jsSupport = javascript({ jsx: false, typescript: false });
const jsxSupport = javascript({ jsx: true, typescript: false });
const tsSupport = javascript({ jsx: false, typescript: true });
const tsxSupport = javascript({ jsx: true, typescript: true });

const codeLanguageFromInfo = (info: string) => {
	const name = (info || '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';
	if (!name) return null;

	// JavaScript / TypeScript family
	if (name === 'js' || name === 'javascript') return jsSupport.language;
	if (name === 'jsx') return jsxSupport.language;
	if (name === 'ts' || name === 'typescript') return tsSupport.language;
	if (name === 'tsx') return tsxSupport.language;

	return null;
};

let view: EditorView | null = null;
let themeCompartment: Compartment | null = null;
let placeholderCompartment: Compartment | null = null;

let lastSelectionSent: SelectionRange = { start: 0, end: 0 };
let rafChange = 0;
let rafSelection = 0;

const postSelection = () => {
	if (!view) return;
	const sel = view.state.selection.main;
	const next = { start: sel.from, end: sel.to };
	if (next.start === lastSelectionSent.start && next.end === lastSelectionSent.end) return;
	lastSelectionSent = next;
	sendToHost({ kind: 'event', type: 'selection', payload: next });
};

const postChange = () => {
	if (!view) return;
	const value = view.state.doc.toString();
	const sel = view.state.selection.main;
	lastSelectionSent = { start: sel.from, end: sel.to };
	sendToHost({
		kind: 'event',
		type: 'change',
		payload: { value, selection: lastSelectionSent },
	});
};

const ensureEditor = (args: InitArgs) => {
	if (view) return;

	const root = document.getElementById('root');
	if (!root) throw new Error('Missing #root');

	const parent = document.createElement('div');
	parent.className = 'gopx-editor';
	root.appendChild(parent);

	themeCompartment = new Compartment();
	placeholderCompartment = new Compartment();

	setThemeVars(args.theme);
	const dark = !!args.theme?.dark;
	const cmTheme = createCmTheme(dark);

	const updateListener = EditorView.updateListener.of((vu: ViewUpdate) => {
		if (vu.docChanged) {
			if (rafChange) cancelAnimationFrame(rafChange);
			rafChange = requestAnimationFrame(() => {
				rafChange = 0;
				postChange();
			});
			return;
		}

		if (vu.selectionSet) {
			if (rafSelection) cancelAnimationFrame(rafSelection);
			rafSelection = requestAnimationFrame(() => {
				rafSelection = 0;
				postSelection();
			});
		}
	});

	const state = EditorState.create({
		doc: typeof args.value === 'string' ? args.value : '',
		extensions: [
			history(),
			markdown({
				base: gfmMarkdownLanguage,
				codeLanguages: codeLanguageFromInfo,
				defaultCodeLanguage: jsSupport,
			}),
			keymap.of([...defaultKeymap, ...historyKeymap, ...markdownKeymap, indentWithTab]),
			EditorView.lineWrapping,
			markdownDecorations,
			markdownInlinePreview,
			// Add stable token classes (tok-*) for CSS selectors (like Joplin).
			syntaxHighlighting(classHighlighter),
			syntaxHighlighting(joplinLikeHighlightStyle),
			// If we haven't defined a tag mapping, fall back to default highlighting.
			syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
			updateListener,
			themeCompartment.of(cmTheme),
			placeholderCompartment.of(placeholderExtension(typeof args.placeholder === 'string' ? args.placeholder : '')),
		],
	});

	view = new EditorView({ state, parent });

	// Ensure we start "not editing" until the user taps.
	// Some WebViews can end up focused by default; explicitly blur once on init.
	try {
		(view as any).contentDOM?.blur?.();
		(document.activeElement as any)?.blur?.();
	} catch {
		// no-op
	}

	// Focusing behavior: tapping the editor container should focus the editor,
	// even if the tap target isn't the contentDOM (matches Joplin's behavior).
	parent.addEventListener('click', (event) => {
		const activeElement = document.querySelector(':focus');
		if (!parent.contains(activeElement) && event.target === parent) {
			view?.focus();
		}
	});

	// Keyboard + rotation: keep the selection visible after a resize.
	window.onresize = () => {
		try {
			if (!view) return;
			const pos = view.state.selection.main.head;
			view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'center' }) });
		} catch {
			// no-op
		}
	};

	if (args.selection) {
		const next = clampSelection(view.state.doc.length, args.selection);
		view.dispatch({
			selection: { anchor: next.start, head: next.end },
			scrollIntoView: true,
		});
	}

	sendToHost({ kind: 'event', type: 'ready' });
};

const setValue = (value: unknown) => {
	if (!view) return;
	const next = typeof value === 'string' ? value : '';
	const cur = view.state.doc.toString();
	if (next === cur) return;
	view.dispatch({
		changes: { from: 0, to: view.state.doc.length, insert: next },
	});
};

const setSelection = (selection: unknown) => {
	if (!view) return;
	const next = clampSelection(view.state.doc.length, selection as any);
	view.dispatch({
		selection: { anchor: next.start, head: next.end },
		scrollIntoView: true,
	});
};

const focus = () => {
	view?.focus();
};

const insertText = (text: unknown, cursorOffset?: unknown) => {
	if (!view) return;
	const t = typeof text === 'string' ? text : '';
	const sel = view.state.selection.main;
	const from = sel.from;
	const to = sel.to;
	const offset = typeof cursorOffset === 'number' && Number.isFinite(cursorOffset) ? cursorOffset : t.length;

	view.dispatch({
		changes: { from, to, insert: t },
		selection: { anchor: from + offset },
		scrollIntoView: true,
	});
	view.focus();
};

const wrapSelection = (before: unknown, after: unknown, cursorOffset?: unknown) => {
	if (!view) return;
	const b = typeof before === 'string' ? before : '';
	const a = typeof after === 'string' ? after : '';
	const sel = view.state.selection.main;
	const from = sel.from;
	const to = sel.to;
	const selected = view.state.doc.sliceString(from, to);

	const insert = b + selected + a;
	const offset = typeof cursorOffset === 'number' && Number.isFinite(cursorOffset)
		? cursorOffset
		: (selected.length ? insert.length : b.length);

	view.dispatch({
		changes: { from, to, insert },
		selection: { anchor: from + offset },
		scrollIntoView: true,
	});
	view.focus();
};

const setTheme = (theme: unknown) => {
	if (!view || !themeCompartment) return;
	const t = (theme && typeof theme === 'object') ? (theme as Theme) : {};
	setThemeVars(t);
	view.dispatch({
		effects: themeCompartment.reconfigure(createCmTheme(!!t.dark)),
	});
};

const setPlaceholder = (placeholder: unknown) => {
	if (!view || !placeholderCompartment) return;
	const p = typeof placeholder === 'string' ? placeholder : '';
	view.dispatch({
		effects: placeholderCompartment.reconfigure(placeholderExtension(p)),
	});
};

const getSelection = (): SelectionRange => {
	if (!view) return { start: 0, end: 0 };
	const sel = view.state.selection.main;
	return { start: sel.from, end: sel.to };
};

const handlers: Record<string, (...args: unknown[]) => unknown> = {
	init: (args: unknown) => {
		ensureEditor((args || {}) as InitArgs);
		return true;
	},
	setValue: (value: unknown) => {
		setValue(value);
		return true;
	},
	setSelection: (selection: unknown) => {
		setSelection(selection);
		return true;
	},
	setTheme: (theme: unknown) => {
		setTheme(theme);
		return true;
	},
	setPlaceholder: (placeholder: unknown) => {
		setPlaceholder(placeholder);
		return true;
	},
	focus: () => {
		focus();
		return true;
	},
	insertText: (text: unknown, cursorOffset?: unknown) => {
		insertText(text, cursorOffset);
		return true;
	},
	wrapSelection: (before: unknown, after: unknown, cursorOffset?: unknown) => {
		wrapSelection(before, after, cursorOffset);
		return true;
	},
	getSelection: () => {
		return getSelection();
	},
};

const handleRpc = async (msg: RpcRequest) => {
	try {
		const handler = handlers[msg.method];
		if (!handler) throw new Error(`Unknown RPC method: ${msg.method}`);

		const result = await handler(...(Array.isArray(msg.args) ? msg.args : []));
		sendToHost({ kind: 'rpc:result', id: msg.id, result });
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		sendToHost({
			kind: 'rpc:error',
			id: msg.id,
			error: { message: err.message, stack: err.stack },
		});
	}
};

const onIncoming = (event: any) => {
	const data = event?.data ?? event;
	const parsed = safeJsonParse(data);
	if (!parsed || typeof parsed !== 'object') return;
	const msg = parsed as IncomingMessage;
	if (msg.kind !== 'rpc') return;
	void handleRpc(msg);
};

const installMessageListeners = () => {
	window.addEventListener('message', onIncoming);
	// react-native-webview on Android sometimes uses document events.
	document.addEventListener('message', onIncoming as any);

	// Flush buffered host messages (if the HTML shell queued any).
	const buffered = window.__GOPX_PENDING_HOST_MESSAGES__;
	if (Array.isArray(buffered) && buffered.length) {
		for (const item of buffered.splice(0, buffered.length)) {
			onIncoming(item as any);
		}
	}
};

export const createMainEditor = (args: InitArgs) => {
	ensureEditor(args);
	return true;
};

export const install = () => {
	if ((window as any).__GOPX_MARKDOWN_EDITOR_BUNDLE_INSTALLED__) return;
	(window as any).__GOPX_MARKDOWN_EDITOR_BUNDLE_INSTALLED__ = true;

	window.onerror = (message, source, lineno, _colno, error) => {
		sendToHost({
			kind: 'event',
			type: 'error',
			payload: {
				message: String(message),
				source: String(source),
				lineno: Number(lineno) || 0,
				stack: error?.stack,
			},
		});
		// Prevent "Uncaught Error" overlays from taking over the WebView.
		return true;
	};
	window.onunhandledrejection = (event: PromiseRejectionEvent) => {
		try {
			event.preventDefault();
		} catch {
			// no-op
		}
		sendToHost({
			kind: 'event',
			type: 'error',
			payload: { message: `Unhandled promise rejection: ${String(event.reason)}` },
		});
	};

	installMessageListeners();
	sendToHost({ kind: 'event', type: 'bundleLoaded' });
};

// Expose a small global for debugging and parity with Joplin-style bootstrapping.
export const attachToWindow = () => {
	(window as any).gopxMarkdownEditorBundle = {
		install,
		createMainEditor,
	};
};


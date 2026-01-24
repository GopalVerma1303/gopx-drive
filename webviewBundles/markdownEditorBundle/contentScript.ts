import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, placeholder as placeholderExtension, ViewUpdate } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownKeymap } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';

type Theme = {
	dark?: boolean;
	background?: string;
	foreground?: string;
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
};

const createCmTheme = (dark: boolean) => {
	return EditorView.theme(
		{
			'&': {
				color: 'var(--fg)',
				backgroundColor: 'var(--bg)',
				height: '100%',
			},
			'.cm-editor': {
				height: '100%',
			},
			'.cm-scroller': {
				overflow: 'auto',
				height: '100%',
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
		},
		{ dark },
	);
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
			markdown({ codeLanguages: languages }),
			keymap.of([...defaultKeymap, ...historyKeymap, ...markdownKeymap, indentWithTab]),
			updateListener,
			themeCompartment.of(cmTheme),
			placeholderCompartment.of(placeholderExtension(typeof args.placeholder === 'string' ? args.placeholder : '')),
		],
	});

	view = new EditorView({ state, parent });

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
	};
	window.onunhandledrejection = (event: PromiseRejectionEvent) => {
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


/**
 * WebView editor entry — bundled and injected (no CDN).
 * Must only import from @codemirror/* so it runs in the WebView.
 */
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { redo, undo } from "@codemirror/history";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (data: string) => void };
    EditorBridge?: EditorBridgeApi;
  }
}

interface EditorBridgeApi {
  init(opts: { text?: string; theme?: Record<string, string> }): void;
  execCommand(cmd: string, args: unknown): void;
  setValue(text: string): void;
  replaceRange(start: number, end: number, text: string): void;
  insertText(args: { from?: number; to?: number; text?: string; cursorPos?: number }): void;
  wrapSelection(args: { before: string; after: string; cursorOffset?: number }): void;
}

function post(msg: object): void {
  if (typeof window.ReactNativeWebView !== "undefined") {
    window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }
}

function themeFromOptions(opts: Record<string, string> | undefined) {
  const bg = opts?.background || "#ffffff";
  const fg = opts?.foreground || "#000000";
  const sel = opts?.selection || "#cce4ff";
  const line = opts?.lineHighlight || "#f5f5f5";
  return EditorView.theme(
    {
      "&": { color: fg, backgroundColor: bg },
      ".cm-content": { caretColor: fg },
      "&.cm-focused .cm-cursor": { borderLeftColor: fg },
      "&.cm-focused .cm-selectionBackground, ::selection": { backgroundColor: sel },
      ".cm-activeLine": { backgroundColor: line },
    },
    { dark: false }
  );
}

let view: EditorView | null = null;
let themeExtension: ReturnType<typeof EditorView.theme> | null = null;

function runCommand(cmd: string, _args: unknown): void {
  if (!view) return;
  const state = view.state;
  const dispatch = view.dispatch.bind(view);
  const range = state.selection.main;
  const from = range.from;
  const to = range.to;
  const doc = state.doc.toString();
  const selected = doc.slice(from, to);

  function wrap(before: string, after: string): void {
    const hasWrap =
      selected.startsWith(before) &&
      selected.endsWith(after) &&
      selected.length >= before.length + after.length;
    const next = hasWrap
      ? selected.slice(before.length, -after.length)
      : before + selected + after;
    const pos = hasWrap
      ? from + next.length
      : from + before.length + selected.length;
    dispatch({
      changes: { from, to, insert: next },
      selection: { anchor: pos, head: pos },
    });
  }
  function insertAt(text: string, cursorPos: number): void {
    dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: cursorPos, head: cursorPos },
    });
  }
  function insertAtLineStart(prefix: string): void {
    const line = state.doc.lineAt(from);
    dispatch({
      changes: { from: line.from, to: line.from, insert: prefix },
      selection: { anchor: from + prefix.length, head: from + prefix.length },
    });
  }
  function indent(): void {
    const lines: { from: number; insert: string }[] = [];
    for (
      let line = state.doc.lineAt(from);
      line.from <= to;
      line = state.doc.lineAt(line.from + line.length + 1)
    ) {
      if (line.from > to) break;
      lines.push({ from: line.from, insert: "  " });
    }
    if (lines.length === 0) return;
    const changes = lines.map(({ from: f, insert: i }) => ({ from: f, to: f, insert: i }));
    const insBeforeFrom = changes.filter((c) => c.from < from).length * 2;
    const insBeforeTo = changes.filter((c) => c.from < to).length * 2;
    dispatch({
      changes,
      selection: { anchor: from + insBeforeFrom, head: to + insBeforeTo },
    });
  }
  function outdent(): void {
    const changes: { from: number; to: number; insert: string }[] = [];
    for (
      let line = state.doc.lineAt(from);
      line.from <= to;
      line = state.doc.lineAt(line.from + line.length + 1)
    ) {
      if (line.from > to) break;
      const lineText = state.sliceDoc(line.from, line.to);
      const m = lineText.match(/^(\s{1,2}|\t)/);
      if (m)
        changes.push({
          from: line.from,
          to: line.from + m[1].length,
          insert: "",
        });
    }
    if (changes.length === 0) return;
    let newFrom = from;
    let newTo = to;
    for (const c of changes) {
      const len = c.to - c.from;
      if (c.from + len <= from) newFrom -= len;
      else if (c.from < from) newFrom = c.from;
      if (c.from + len <= to) newTo -= len;
      else if (c.from < to) newTo = c.from + Math.max(0, to - c.from - len);
    }
    dispatch({
      changes,
      selection: { anchor: Math.max(0, newFrom), head: Math.max(0, newTo) },
    });
  }

  const commands: Record<string, () => void> = {
    ToggleBold: () => wrap("**", "**"),
    ToggleItalic: () => wrap("*", "*"),
    ToggleStrikethrough: () => wrap("~~", "~~"),
    ToggleInlineCode: () => wrap("`", "`"),
    ToggleHeading: () => insertAtLineStart("# "),
    ToggleBlockQuote: () => insertAtLineStart("> "),
    InsertLink: () => insertAt("[]()", from + 1),
    InsertImage: () => insertAt("![]()", from + 2),
    ToggleBulletList: () => insertAt("- ", from + 2),
    ToggleOrderedList: () => insertAt("1. ", from + 3),
    ToggleTaskList: () => insertAt("- [ ] ", from + 6),
    ToggleCodeBlock: () => insertAt("```\n\n```", from + 4),
    InsertTable: () =>
      insertAt(
        "| Col1 | Col2 |\n|------|------|\n|      |      |",
        from + 29
      ),
    Undo: () => {
      undo(view!);
    },
    Redo: () => {
      redo(view!);
    },
    Indent: () => indent(),
    Outdent: () => outdent(),
  };
  const fn = commands[cmd];
  if (fn) fn();
}

window.EditorBridge = {
  init(opts) {
    const text = opts?.text ?? "";
    const themeOpts = opts?.theme;
    themeExtension = themeFromOptions(themeOpts);
    const extensions = [
      EditorView.lineWrapping,
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      markdown({ base: markdownLanguage, codeLanguages: [] }),
      themeExtension,
    ];
    const state = EditorState.create({ doc: text, extensions });
    const parent = document.getElementById("root");
    if (!parent) return;
    if (view) view.destroy();
    view = new EditorView({
      state,
      parent,
      dispatch(tr) {
        view!.update([tr]);
        if (tr.docChanged)
          post({ type: "change", text: view!.state.doc.toString() });
        if (tr.selection) {
          const s = view!.state.selection.main;
          post({ type: "selectionChange", from: s.from, to: s.to });
        }
      },
    });
  },
  execCommand(cmd, args) {
    runCommand(cmd, args);
  },
  setValue(text) {
    if (!view) return;
    const len = view.state.doc.length;
    view.dispatch({ changes: { from: 0, to: len, insert: text || "" } });
  },
  replaceRange(start, end, text) {
    if (!view) return;
    view.dispatch({
      changes: { from: start, to: end, insert: text },
      selection: { anchor: start + text.length, head: start + text.length },
    });
  },
  insertText(args) {
    if (!view || !args) return;
    const { from: f, to: t, text: textVal, cursorPos } = args as {
      from?: number;
      to?: number;
      text?: string;
      cursorPos?: number;
    };
    const fromVal = f ?? view.state.selection.main.from;
    const toVal = t ?? view.state.selection.main.to;
    const pos = cursorPos ?? fromVal + (textVal?.length ?? 0);
    view.dispatch({
      changes: { from: fromVal, to: toVal, insert: textVal || "" },
      selection: { anchor: pos, head: pos },
    });
  },
  wrapSelection(args) {
    if (!view || !args) return;
    const { before, after, cursorOffset } = args as {
      before: string;
      after: string;
      cursorOffset?: number;
    };
    const r = view.state.selection.main;
    const doc = view.state.doc.toString();
    const selected = doc.slice(r.from, r.to);
    const next = before + selected + after;
    const pos = r.from + (cursorOffset ?? before.length);
    view.dispatch({
      changes: { from: r.from, to: r.to, insert: next },
      selection: { anchor: pos, head: pos },
    });
  },
};

window.addEventListener("message", (e: MessageEvent) => {
  try {
    const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
    if (data.type === "init") window.EditorBridge!.init(data);
    if (data.type === "setValue") window.EditorBridge!.setValue(data.text);
    if (data.type === "execCommand") {
      const cmd = data.command;
      const args = data.args;
      if (cmd === "ReplaceRange" && args)
        window.EditorBridge!.replaceRange(args.start, args.end, args.text);
      else if (cmd === "InsertText" && args) window.EditorBridge!.insertText(args);
      else if (cmd === "WrapSelection" && args)
        window.EditorBridge!.wrapSelection(args);
      else window.EditorBridge!.execCommand(cmd, args);
    }
  } catch (_) {}
});

post({ type: "bridgeReady" });

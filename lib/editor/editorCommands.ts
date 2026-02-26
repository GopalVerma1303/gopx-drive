import { EditorSelection, TransactionSpec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { history, undo, redo } from "@codemirror/history";
import { EditorCommandType } from "./types";

type CommandImpl = (view: EditorView, args?: any) => boolean;

const withHistory =
  (fn: CommandImpl): CommandImpl =>
  (view, args) => {
    // Ensure history is enabled; createEditor should include it,
    // but this makes the function safe if reused.
    if (!view.state.facet(history)) {
      // no-op if history isn't installed
    }
    return fn(view, args);
  };

const toggleWrap = (before: string, after: string): CommandImpl => {
  return (view) => {
    const { state } = view;
    const tr: TransactionSpec = state.changeByRange((range) => {
      const { from, to } = range;
      const selected = state.sliceDoc(from, to);
      const hasWrap =
        selected.startsWith(before) && selected.endsWith(after) && selected.length >= before.length + after.length;

      if (hasWrap) {
        const unwrapped = selected.slice(before.length, selected.length - after.length);
        return {
          changes: { from, to, insert: unwrapped },
          range: EditorSelection.range(from, from + unwrapped.length),
        };
      } else {
        const wrapped = `${before}${selected}${after}`;
        return {
          changes: { from, to, insert: wrapped },
          range: EditorSelection.range(from + before.length, from + before.length + selected.length),
        };
      }
    });

    view.dispatch(tr);
    return true;
  };
};

const insertAtSelection = (text: string, cursorOffset: number): CommandImpl => {
  return (view) => {
    const { state } = view;
    const tr: TransactionSpec = state.changeByRange((range) => {
      const { from, to } = range;
      const insert = text;
      const cursorPos = from + cursorOffset;
      return {
        changes: { from, to, insert },
        range: EditorSelection.cursor(cursorPos),
      };
    });
    view.dispatch(tr);
    return true;
  };
};

const insertPrefix = (prefix: string): CommandImpl => {
  return (view) => {
    const { state } = view;
    const tr: TransactionSpec = state.changeByRange((range) => {
      const line = state.doc.lineAt(range.from);
      const insertPos = line.from;
      return {
        changes: { from: insertPos, to: insertPos, insert: prefix },
        range: EditorSelection.cursor(range.from + prefix.length),
      };
    });
    view.dispatch(tr);
    return true;
  };
};

const INDENT_STR = "  ";

const indentSelection: CommandImpl = (view) => {
  const { state } = view;
  const { from, to } = state.selection.main;
  const changes: { from: number; to: number; insert: string }[] = [];
  for (let line = state.doc.lineAt(from); line.from <= to; line = state.doc.lineAt(line.from + line.length + 1)) {
    if (line.from > to) break;
    changes.push({ from: line.from, to: line.from, insert: INDENT_STR });
  }
  if (changes.length === 0) return false;
  const insertedBeforeFrom = changes.filter((c) => c.from < from).length * INDENT_STR.length;
  const insertedBeforeTo = changes.filter((c) => c.from < to).length * INDENT_STR.length;
  view.dispatch({
    changes,
    selection: EditorSelection.range(from + insertedBeforeFrom, to + insertedBeforeTo),
  });
  return true;
};

const outdentSelection: CommandImpl = (view) => {
  const { state } = view;
  const { from, to } = state.selection.main;
  const changes: { from: number; to: number; insert: string }[] = [];
  for (let line = state.doc.lineAt(from); line.from <= to; line = state.doc.lineAt(line.from + line.length + 1)) {
    if (line.from > to) break;
    const lineText = state.sliceDoc(line.from, line.to);
    const match = lineText.match(/^(\s{1,2}|\t)/);
    if (match) {
      const len = match[1].length;
      changes.push({ from: line.from, to: line.from + len, insert: "" });
    }
  }
  if (changes.length === 0) return false;
  let newFrom = from;
  let newTo = to;
  for (const c of changes) {
    const len = c.to - c.from;
    if (c.from + len <= from) newFrom -= len;
    else if (c.from < from) newFrom = c.from;
    if (c.from + len <= to) newTo -= len;
    else if (c.from < to) newTo = c.from + Math.max(0, to - c.from - len);
  }
  view.dispatch({
    changes,
    selection: EditorSelection.range(Math.max(0, newFrom), Math.max(0, newTo)),
  });
  return true;
};

const commands: Record<EditorCommandType, CommandImpl> = {
  ToggleBold: toggleWrap("**", "**"),
  ToggleItalic: toggleWrap("*", "*"),
  ToggleStrikethrough: toggleWrap("~~", "~~"),
  ToggleHeading: insertPrefix("# "),
  ToggleInlineCode: toggleWrap("`", "`"),
  ToggleBlockQuote: insertPrefix("> "),
  InsertLink: insertAtSelection("[]()", 1),
  InsertImage: insertAtSelection("![]()", 2),
  ToggleBulletList: insertAtSelection("- ", 2),
  ToggleOrderedList: insertAtSelection("1. ", 3),
  ToggleTaskList: insertAtSelection("- [ ] ", 6),
  ToggleCodeBlock: insertAtSelection("```\n\n```", 4),
  InsertTable: insertAtSelection("| Col1 | Col2 |\n|------|------|\n|      |      |", 29),
  Indent: indentSelection,
  Outdent: outdentSelection,
  Undo: (view) => {
    undo(view);
    return true;
  },
  Redo: (view) => {
    redo(view);
    return true;
  },
};

/**
 * Execute a high-level editor command against a given EditorView.
 * Returns true if the command was handled.
 */
export const execEditorCommand = (view: EditorView, command: EditorCommandType, args?: any): boolean => {
  const impl = commands[command];
  if (!impl) return false;
  return withHistory(impl)(view, args);
};


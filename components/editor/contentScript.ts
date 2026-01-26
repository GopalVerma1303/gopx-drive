// This file contains the JavaScript that runs inside the WebView
// It sets up CodeMirror and provides the editor API

// Type declaration for ReactNativeWebView
declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

// Import CodeMirror modules (these will be bundled)
import {
  defaultKeymap,
  history,
  historyKeymap,
  redo,
  undo,
} from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import {
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import { Compartment, EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from "@codemirror/view";

// Editor instance
let editor: EditorView | null = null;
let editorState: EditorState | null = null;

// Settings compartment for dynamic updates
const settingsCompartment = new Compartment();

// Editor API that will be exposed to React Native
const editorApi: any = {
  init(parentElement: HTMLElement, initialText: string, settings: any) {
    if (editor) {
      console.warn("Editor already initialized");
      return;
    }

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      drawSelection(),
      highlightSpecialChars(),
      history(),
      markdown(),
      syntaxHighlighting(defaultHighlightStyle),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const text = update.state.doc.toString();
          window.ReactNativeWebView?.postMessage(
            JSON.stringify({
              type: "event",
              eventType: "change",
              payload: { kind: "change", value: text },
            }),
          );
        }
        if (update.selectionSet) {
          const selection = update.state.selection.main;
          window.ReactNativeWebView?.postMessage(
            JSON.stringify({
              type: "event",
              eventType: "selectionChange",
              payload: {
                kind: "selectionChange",
                selection: { start: selection.from, end: selection.to },
              },
            }),
          );
        }
      }),
      EditorView.domEventHandlers({
        scroll: () => {
          const scrollTop = parentElement.scrollTop;
          const scrollHeight =
            parentElement.scrollHeight - parentElement.clientHeight;
          const fraction = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
          window.ReactNativeWebView?.postMessage(
            JSON.stringify({
              type: "event",
              eventType: "scroll",
              payload: { kind: "scroll", scrollFraction: fraction },
            }),
          );
        },
      }),
      keymap.of([...historyKeymap, ...defaultKeymap, ...searchKeymap]),
      settingsCompartment.of(this.createThemeExtension(settings)),
    ];

    editorState = EditorState.create({
      doc: initialText,
      extensions,
    });

    editor = new EditorView({
      state: editorState,
      parent: parentElement,
    });

    return true;
  },

  createThemeExtension(settings: any) {
    const isDark = settings.theme === "dark";
    const extensions = [];

    if (isDark) {
      extensions.push(oneDark);
    }

    // Apply font settings
    extensions.push(
      EditorView.theme({
        "&": {
          fontSize: `${settings.fontSize || 16}px`,
          fontFamily: settings.fontFamily || "monospace",
          lineHeight: `${settings.lineHeight || 1.5}`,
        },
        ".cm-content": {
          padding: "16px",
          minHeight: "100%",
        },
        ".cm-focused": {
          outline: "none",
        },
      }),
    );

    return extensions;
  },

  updateSettings(settings: any) {
    if (!editor) return;
    editor.dispatch({
      effects: settingsCompartment.reconfigure(
        this.createThemeExtension(settings),
      ),
    });
  },

  insertText(text: string, cursorOffset?: number) {
    if (!editor) return;
    const selection = editor.state.selection.main;
    const from = selection.from;
    const to = selection.to;
    editor.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length + (cursorOffset || 0) },
    });
  },

  wrapSelection(before: string, after: string, cursorOffset?: number) {
    if (!editor) return;
    const selection = editor.state.selection.main;
    const from = selection.from;
    const to = selection.to;
    const selectedText = editor.state.sliceDoc(from, to);
    const newText = before + selectedText + after;
    editor.dispatch({
      changes: { from, to, insert: newText },
      selection: {
        anchor:
          from + before.length + selectedText.length + (cursorOffset || 0),
      },
    });
  },

  indent() {
    if (!editor) return;
    const selection = editor.state.selection.main;
    const from = selection.from;
    const to = selection.to;
    const changes: any[] = [];

    // Get all lines that intersect with the selection
    const fromLine = editor.state.doc.lineAt(from);
    const toLine = editor.state.doc.lineAt(to);

    for (let lineNum = fromLine.number; lineNum <= toLine.number; lineNum++) {
      const line = editor.state.doc.line(lineNum);
      changes.push({ from: line.from, insert: "  " });
    }

    editor.dispatch({ changes });
  },

  outdent() {
    if (!editor) return;
    const selection = editor.state.selection.main;
    const from = selection.from;
    const to = selection.to;
    const changes: any[] = [];

    // Get all lines that intersect with the selection
    const fromLine = editor.state.doc.lineAt(from);
    const toLine = editor.state.doc.lineAt(to);

    for (let lineNum = fromLine.number; lineNum <= toLine.number; lineNum++) {
      const line = editor.state.doc.line(lineNum);
      const lineText = editor.state.sliceDoc(line.from, line.to);
      if (lineText.startsWith("  ")) {
        changes.push({ from: line.from, to: line.from + 2, insert: "" });
      } else if (lineText.startsWith("\t")) {
        changes.push({ from: line.from, to: line.from + 1, insert: "" });
      }
    }

    editor.dispatch({ changes });
  },

  undo() {
    if (!editor) return;
    // Use the undo command from @codemirror/commands
    // Commands take the EditorView as the target
    return undo(editor);
  },

  redo() {
    if (!editor) return;
    // Use the redo command from @codemirror/commands
    // Commands take the EditorView as the target
    return redo(editor);
  },

  focus() {
    if (!editor) return;
    editor.focus();
  },

  getSelection() {
    if (!editor) return { start: 0, end: 0 };
    const selection = editor.state.selection.main;
    return { start: selection.from, end: selection.to };
  },

  updateBody(newBody: string) {
    if (!editor) return;
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: newBody },
    });
  },

  setScrollPercent(fraction: number) {
    if (!editor) return;
    const parent = editor.dom.parentElement;
    if (parent) {
      const scrollHeight = parent.scrollHeight - parent.clientHeight;
      parent.scrollTop = fraction * scrollHeight;
    }
  },

  select(anchor: number, head: number) {
    if (!editor) return;
    editor.dispatch({
      selection: { anchor, head },
    });
  },
};

// Expose API to window
(window as any).editorApi = editorApi;

// Export for bundling
export default editorApi;

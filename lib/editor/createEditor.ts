import { EditorState, Extension } from "@codemirror/state";
import { EditorView, keymap, highlightSpecialChars, drawSelection, rectangularSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorHandle, EditorInitOptions, EditorCommandType } from "./types";
import { execEditorCommand } from "./editorCommands";
import { createEditorThemeExtension } from "./theme";
import { darkMarkdownHighlightStyle } from "./highlightStyles";

export interface InternalEditor {
  view: EditorView;
}

export const createEditor = (parent: HTMLElement, options: EditorInitOptions): EditorHandle => {
  const isDark = options.theme?.isDark ?? false;
  const highlightStyle = isDark ? darkMarkdownHighlightStyle : defaultHighlightStyle;

  const extensions: Extension[] = [
    EditorView.lineWrapping,
    highlightSpecialChars(),
    history(),
    drawSelection(),
    rectangularSelection(),
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    markdown({
      base: markdownLanguage,
      codeLanguages: [],
    }),
    syntaxHighlighting(highlightStyle),
  ];

  if (options.theme) {
    extensions.push(createEditorThemeExtension(options.theme));
  }

  const state = EditorState.create({
    doc: options.initialText,
    extensions,
  });

  const view = new EditorView({
    state,
    parent,
    dispatch(tr) {
      view.update([tr]);
      if (tr.docChanged && options.onChange) {
        options.onChange(view.state.doc.toString());
      }
      if (tr.selection && options.onSelectionChange) {
        const sel = view.state.selection.main;
        options.onSelectionChange(sel.from, sel.to);
      }
    },
  });

  const handle: EditorHandle = {
    execCommand(command: EditorCommandType, args?: any) {
      execEditorCommand(view, command, args);
    },
    getValue() {
      return view.state.doc.toString();
    },
    setValue(text: string) {
      const transaction = view.state.update({
        changes: { from: 0, to: view.state.doc.length, insert: text },
      });
      view.update([transaction]);
      if (options.onChange) options.onChange(text);
    },
    focus() {
      view.focus();
    },
    getSelection() {
      const sel = view.state.selection.main;
      return { from: sel.from, to: sel.to };
    },
    setSelection(from: number, to: number) {
      const tr = view.state.update({
        selection: { anchor: from, head: to },
        scrollIntoView: true,
      });
      view.update([tr]);
    },
    replaceRange(from: number, to: number, text: string) {
      const tr = view.state.update({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length, head: from + text.length },
        scrollIntoView: true,
      });
      view.update([tr]);
      if (options.onChange) options.onChange(view.state.doc.toString());
    },
    destroy() {
      view.destroy();
    },
  };

  return handle;
};


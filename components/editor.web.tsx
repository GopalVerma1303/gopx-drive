import { useThemeColors } from "@/lib/use-theme-colors";
import { cn } from "@/lib/utils";
import CodeMirror from "@uiw/react-codemirror";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { HighlightStyle, defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { markdown, markdownKeymap } from "@codemirror/lang-markdown";
import { keymap, EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { View } from "react-native";

interface EditorProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  className?: string;
}

export interface EditorRef {
  insertText: (text: string, cursorOffset?: number) => void;
  wrapSelection: (before: string, after: string, cursorOffset?: number) => void;
  focus: () => void;
  getSelection: () => { start: number; end: number };
}

type Theme = {
  dark: boolean;
  background: string;
  foreground: string;
  caret: string;
  selection: string;
  placeholder: string;
  fontSize: number;
  lineHeight: number;
};

export const Editor = forwardRef<EditorRef, EditorProps>(function Editor(
  { value, onChangeText, placeholder = "Start writing...", className },
  ref
) {
  const { colors, isDark } = useThemeColors();

  const cmViewRef = useRef<any>(null);
  const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const latestValueRef = useRef(value);
  const onChangeTextRef = useRef(onChangeText);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    onChangeTextRef.current = onChangeText;
  }, [onChangeText]);

  const editorTheme: Theme = useMemo(() => {
    const selection = isDark ? "rgba(250,250,250,0.18)" : "rgba(10,10,10,0.12)";
    return {
      dark: isDark,
      background: colors.muted,
      foreground: colors.foreground,
      caret: colors.foreground,
      selection,
      placeholder: colors.mutedForeground,
      fontSize: 17,
      lineHeight: 24,
    };
  }, [colors, isDark]);

  const extensions = useMemo(() => {
    // Joplin-style: markdown language + highlight style + fallback highlight.
    // Critical for fenced code blocks: provide `codeLanguages`.
    const themeExt = EditorView.theme(
      {
        "&": {
          backgroundColor: editorTheme.background,
          color: editorTheme.foreground,
          height: "100%",
        },
        ".cm-editor": { height: "100%" },
        ".cm-scroller": {
          overflow: "auto",
          height: "100%",
          backgroundColor: editorTheme.background,
        },
        ".cm-content": {
          padding: "20px 24px 40px",
          caretColor: editorTheme.caret,
          fontSize: `${editorTheme.fontSize}px`,
          lineHeight: `${editorTheme.lineHeight}px`,
        },
        ".cm-selectionBackground, ::selection": { backgroundColor: `${editorTheme.selection} !important` },
        ".cm-placeholder": { color: editorTheme.placeholder },
      },
      { dark: editorTheme.dark }
    );

    const joplinLikeMarkdownHighlight = HighlightStyle.define([
      // Basic emphasis
      { tag: tags.strong, fontWeight: "bold" },
      { tag: tags.emphasis, fontStyle: "italic" },
      { tag: tags.link, color: editorTheme.dark ? "#5da8ff" : "#0066cc" },

      // Headings
      { tag: tags.heading1, fontWeight: "bold", fontSize: "1.5em" },
      { tag: tags.heading2, fontWeight: "bold", fontSize: "1.4em" },
      { tag: tags.heading3, fontWeight: "bold", fontSize: "1.3em" },
      { tag: tags.heading4, fontWeight: "bold", fontSize: "1.2em" },
      { tag: tags.heading5, fontWeight: "bold", fontSize: "1.1em" },
      { tag: tags.heading6, fontWeight: "bold", fontSize: "1.0em" },

      // Inline code / code fences
      { tag: tags.monospace, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
      { tag: tags.keyword, color: editorTheme.dark ? "#c792ea" : "#7c3aed" },
      { tag: tags.string, color: editorTheme.dark ? "#c3e88d" : "#15803d" },
      { tag: tags.number, color: editorTheme.dark ? "#f78c6c" : "#b45309" },
      { tag: tags.comment, color: editorTheme.dark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)" },
    ]);

    return [
      history(),
      markdown({ codeLanguages: languages }),
      keymap.of([...defaultKeymap, ...historyKeymap, ...markdownKeymap, indentWithTab]),
      EditorView.lineWrapping,
      themeExt,
      syntaxHighlighting(joplinLikeMarkdownHighlight),
      // Fallback styles ensure tokens still get colored if our style misses a tag.
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    ];
  }, [editorTheme]);

  useImperativeHandle(ref, () => ({
    insertText: (text: string, cursorOffset?: number) => {
      const view = cmViewRef.current;
      if (!view) return;
      const sel = view.state.selection.main;
      const from = sel.from;
      const to = sel.to;
      const offset = cursorOffset ?? text.length;

      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + offset },
        scrollIntoView: true,
      });
      view.focus();
      selectionRef.current = { start: from + offset, end: from + offset };
    },

    wrapSelection: (before: string, after: string, cursorOffset?: number) => {
      const view = cmViewRef.current;
      if (!view) return;

      const sel = view.state.selection.main;
      const from = sel.from;
      const to = sel.to;
      const selectedText = view.state.doc.sliceString(from, to);
      const insert = before + selectedText + after;
      const offset =
        typeof cursorOffset === "number" && Number.isFinite(cursorOffset)
          ? cursorOffset
          : selectedText.length
            ? insert.length
            : before.length;

      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + offset },
        scrollIntoView: true,
      });
      view.focus();
      selectionRef.current = { start: from + offset, end: from + offset };
    },

    focus: () => {
      cmViewRef.current?.focus?.();
    },

    getSelection: () => selectionRef.current,
  }));

  return (
    <View className={cn("flex-1", className)} style={{ backgroundColor: editorTheme.background }}>
      <CodeMirror
        value={value}
        height="100%"
        placeholder={placeholder}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLineGutter: false,
          syntaxHighlighting: true,
          highlightSpecialChars: true,
          history: true,
          drawSelection: true,
          indentOnInput: true,
          autocompletion: false,
        }}
        extensions={extensions}
        onCreateEditor={(view: any) => {
          cmViewRef.current = view;
          const sel = view.state.selection.main;
          selectionRef.current = { start: sel.from, end: sel.to };
        }}
        onUpdate={(vu: any) => {
          const sel = vu.state.selection.main;
          selectionRef.current = { start: sel.from, end: sel.to };
        }}
        onChange={(nextValue: string) => {
          if (nextValue !== latestValueRef.current) {
            onChangeTextRef.current(nextValue);
          }
        }}
      />
    </View>
  );
});


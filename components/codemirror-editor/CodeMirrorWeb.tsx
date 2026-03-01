"use client";

import { useThemeColors } from "@/lib/use-theme-colors";
import React, { useEffect, useImperativeHandle, useRef } from "react";
import { Platform } from "react-native";

// Only import CodeMirror on web to avoid pulling it into native bundle
let EditorView: any;
let EditorState: any;
let markdown: any;
let keymap: any;
let defaultKeymap: any;
let indentWithTab: any;
let history: any;
let syntaxHighlighting: any;
let HighlightStyle: any;
let tags: any;

if (typeof document !== "undefined") {
  const cmView = require("@codemirror/view");
  const cmState = require("@codemirror/state");
  const cmCommands = require("@codemirror/commands");
  const cmLangMarkdown = require("@codemirror/lang-markdown");
  const cmLanguage = require("@codemirror/language");
  const lezerHighlight = require("@lezer/highlight");
  EditorView = cmView.EditorView;
  EditorState = cmState.EditorState;
  markdown = cmLangMarkdown.markdown;
  keymap = cmView.keymap;
  defaultKeymap = cmCommands.defaultKeymap;
  indentWithTab = cmCommands.indentWithTab;
  history = cmCommands.history;
  syntaxHighlighting = cmLanguage.syntaxHighlighting;
  HighlightStyle = cmLanguage.HighlightStyle;
  tags = lezerHighlight.tags;
}

export interface CodeMirrorEditorHandle {
  setSelection: (start: number, end: number) => void;
  focus: () => void;
  /** For web: return the editor container DOM node so parent can check focus (e.g. for keyboard shortcuts). */
  getDomNode?: () => HTMLDivElement | null;
}

interface CodeMirrorWebProps {
  value: string;
  onChangeText?: (text: string) => void;
  onSelectionChange?: (selection: { start: number; end: number }) => void;
  placeholder?: string;
  className?: string;
  style?: any;
}

export const CodeMirrorWeb = React.forwardRef<CodeMirrorEditorHandle, CodeMirrorWebProps>(
  function CodeMirrorWeb(
    { value, onChangeText, onSelectionChange, placeholder },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const initialValueRef = useRef(value);
    const viewRef = useRef<any>(null);
    const { colors } = useThemeColors();
    const onChangeRef = useRef(onChangeText);
    const onSelectionRef = useRef(onSelectionChange);
    onChangeRef.current = onChangeText;
    onSelectionRef.current = onSelectionChange;

    useEffect(() => {
      if (Platform.OS !== "web" || !EditorView) return;

      const node = containerRef.current;
      if (!node || !(node instanceof HTMLElement)) return;

      const initial = initialValueRef.current;
      const markdownHighlightStyle = HighlightStyle.define([
        { tag: tags.heading1, fontWeight: "700", fontSize: "1.5em" },
        { tag: tags.heading2, fontWeight: "700", fontSize: "1.35em" },
        { tag: tags.heading3, fontWeight: "600", fontSize: "1.2em" },
        { tag: tags.heading4, fontWeight: "600", fontSize: "1.1em" },
        { tag: tags.heading5, fontWeight: "600" },
        { tag: tags.heading6, fontWeight: "600", opacity: "0.9" },
        { tag: tags.strong, fontWeight: "700" },
        { tag: tags.emphasis, fontStyle: "italic" },
        { tag: tags.link, color: "#0969da", textDecoration: "underline" },
        { tag: tags.url, color: "#0550ae" },
        { tag: tags.monospace, fontFamily: "Iosevka, ui-monospace, monospace", backgroundColor: "rgba(128,128,128,0.15)", padding: "0.12em 0.3em", borderRadius: "4px" },
        { tag: tags.quote, opacity: "0.85", borderLeft: "3px solid rgba(128,128,128,0.5)", paddingLeft: "0.5em" },
        { tag: tags.list, opacity: "0.95" },
        { tag: tags.contentSeparator, opacity: "0.6" },
        { tag: tags.processingInstruction, opacity: "0.65" },
        { tag: tags.comment, opacity: "0.6", fontStyle: "italic" },
      ]);
      const state = EditorState.create({
        doc: initial,
        extensions: [
          markdown(),
          syntaxHighlighting(markdownHighlightStyle),
          history(),
          keymap.of([...defaultKeymap, indentWithTab]),
          EditorView.updateListener.of((update: any) => {
            if (update.docChanged && onChangeRef.current) {
              const v = update.state.doc.toString();
              onChangeRef.current(v);
            }
            if (update.selectionSet && onSelectionRef.current) {
              const sel = update.state.selection.main;
              onSelectionRef.current({ start: sel.from, end: sel.to });
            }
          }),
          EditorView.theme({
            "&": { height: "100%" },
            "&.cm-editor": { fontSize: 16, fontFamily: "Iosevka, ui-monospace, monospace" },
            "&.cm-editor.cm-focused": { outline: "none" },
            ".cm-content": { padding: 0 },
            ".cm-line": { lineHeight: "24px" },
          }),
        ],
      });

      const view = new EditorView({
        state,
        parent: node,
      });
      viewRef.current = view;

      return () => {
        view.destroy();
        viewRef.current = null;
      };
    }, []);

    // Sync value from parent (e.g. after undo/redo or list logic)
    useEffect(() => {
      if (!viewRef.current || Platform.OS !== "web") return;
      const current = viewRef.current.state.doc.toString();
      if (value !== current) {
        viewRef.current.dispatch({
          changes: { from: 0, to: current.length, insert: value || "" },
        });
      }
    }, [value]);

    useImperativeHandle(
      ref,
      () => ({
        setSelection: (start: number, end: number) => {
          if (viewRef.current) {
            viewRef.current.dispatch({
              selection: { anchor: start, head: end },
            });
          }
        },
        focus: () => {
          viewRef.current?.focus();
        },
        getDomNode: () => containerRef.current,
      }),
      []
    );

    if (Platform.OS !== "web") return null;

    return (
      <div
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: 200,
          height: "100%",
          paddingLeft: 32,
          paddingRight: 32,
          paddingTop: 24,
          paddingBottom: 65,
        }}
      />
    );
  }
);

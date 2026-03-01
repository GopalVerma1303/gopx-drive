"use client";

import {
  MARKDOWN_CODE_FONT_SIZE_EM,
  MARKDOWN_CONTENT_PADDING_PX,
  MARKDOWN_FONT_SIZE,
  MARKDOWN_HEADING1_EM,
  MARKDOWN_HEADING2_EM,
  MARKDOWN_HEADING3_EM,
  MARKDOWN_HEADING4_EM,
  MARKDOWN_HEADING5_EM,
  MARKDOWN_HEADING6_EM,
  MARKDOWN_LINE_HEIGHT_CSS,
} from "@/lib/markdown-content-layout";
import { useThemeColors } from "@/lib/use-theme-colors";
import React, { useEffect, useImperativeHandle, useRef } from "react";
import { Platform } from "react-native";

// Only import CodeMirror on web to avoid pulling it into native bundle
let EditorView: any;
let EditorState: any;
let Compartment: any;
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
  Compartment = cmState.Compartment;
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
  /** When set, wrapper gets this exact height in px so CodeMirror has a definite viewport and can scroll to the last line. */
  containerHeight?: number;
}

export const CodeMirrorWeb = React.forwardRef<CodeMirrorEditorHandle, CodeMirrorWebProps>(
  function CodeMirrorWeb(
    { value, onChangeText, onSelectionChange, placeholder, containerHeight },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const initialValueRef = useRef(value);
    const viewRef = useRef<any>(null);
    const heightThemeCompartmentRef = useRef<any>(null);
    const { colors } = useThemeColors();
    const onChangeRef = useRef(onChangeText);
    const onSelectionRef = useRef(onSelectionChange);
    onChangeRef.current = onChangeText;
    onSelectionRef.current = onSelectionChange;

    useEffect(() => {
      if (Platform.OS !== "web" || !EditorView || !Compartment) return;

      const node = containerRef.current;
      if (!node || !(node instanceof HTMLElement)) return;

      const initial = initialValueRef.current;
      const markdownHighlightStyle = HighlightStyle.define([
        { tag: tags.heading1, fontWeight: "700", fontSize: MARKDOWN_HEADING1_EM },
        { tag: tags.heading2, fontWeight: "700", fontSize: MARKDOWN_HEADING2_EM },
        { tag: tags.heading3, fontWeight: "600", fontSize: MARKDOWN_HEADING3_EM },
        { tag: tags.heading4, fontWeight: "600", fontSize: MARKDOWN_HEADING4_EM },
        { tag: tags.heading5, fontWeight: "600", fontSize: MARKDOWN_HEADING5_EM },
        { tag: tags.heading6, fontWeight: "600", fontSize: MARKDOWN_HEADING6_EM, opacity: "0.9" },
        { tag: tags.strong, fontWeight: "700" },
        { tag: tags.emphasis, fontStyle: "italic" },
        { tag: tags.link, color: "#0969da", textDecoration: "underline" },
        { tag: tags.url, color: "#0550ae" },
        { tag: tags.monospace, fontFamily: "Iosevka, ui-monospace, monospace", fontSize: MARKDOWN_CODE_FONT_SIZE_EM, backgroundColor: "rgba(128,128,128,0.15)", padding: "0.12em 0.3em", borderRadius: "4px" },
        { tag: tags.quote, opacity: "0.85", borderLeft: "3px solid rgba(128,128,128,0.5)", paddingLeft: "0.5em" },
        { tag: tags.list, opacity: "0.95" },
        { tag: tags.contentSeparator, opacity: "0.6" },
        { tag: tags.processingInstruction, opacity: "0.65" },
        { tag: tags.comment, opacity: "0.6", fontStyle: "italic" },
      ]);

      // Height in a compartment so we can set .cm-editor to explicit px (required for scroll to work per CodeMirror docs)
      const heightCompartment = new Compartment();
      heightThemeCompartmentRef.current = heightCompartment;

      const state = EditorState.create({
        doc: initial,
        extensions: [
          markdown(),
          syntaxHighlighting(markdownHighlightStyle),
          history(),
          keymap.of([...defaultKeymap, indentWithTab]),
          EditorView.lineWrapping,
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
          heightCompartment.of(
            EditorView.theme({
              "&": { height: "100%", maxHeight: "100%", minHeight: 0 },
            })
          ),
          EditorView.theme({
            "&.cm-editor": { fontSize: MARKDOWN_FONT_SIZE, fontFamily: "Iosevka, ui-monospace, monospace", minHeight: 0 },
            "&.cm-editor.cm-focused": { outline: "none" },
            ".cm-scroller": { minHeight: 0, overflow: "auto", overflowY: "scroll", height: "100%", maxHeight: "100%" },
            ".cm-content": { padding: 0, paddingBottom: `${MARKDOWN_CONTENT_PADDING_PX.paddingBottom}px` },
            ".cm-line": { lineHeight: MARKDOWN_LINE_HEIGHT_CSS },
          }),
        ],
      });

      const view = new EditorView({
        state,
        parent: node,
      });
      viewRef.current = view;

      const ro = new ResizeObserver(() => {
        view.requestMeasure?.();
      });
      ro.observe(node);

      return () => {
        ro.disconnect();
        view.destroy();
        viewRef.current = null;
        heightThemeCompartmentRef.current = null;
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

    // When container gets a definite height, set .cm-editor to that pixel height (enables vertical scroll per CodeMirror docs) and re-measure
    useEffect(() => {
      if (Platform.OS !== "web" || !EditorView) return;
      const comp = heightThemeCompartmentRef.current;
      const view = viewRef.current;
      if (!comp || !view) return;
      const h = containerHeight != null && containerHeight > 0 ? containerHeight : null;
      if (h != null) {
        view.dispatch({
          effects: comp.reconfigure(
            EditorView.theme({
              "&": { height: `${h}px`, maxHeight: `${h}px`, minHeight: 0 },
            })
          ),
        });
        view.requestMeasure?.();
      } else {
        view.dispatch({
          effects: comp.reconfigure(
            EditorView.theme({
              "&": { height: "100%", maxHeight: "100%", minHeight: 0 },
            })
          ),
        });
      }
    }, [containerHeight]);

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

    // Per CodeMirror docs: editor needs explicit height + .cm-scroller { overflow: auto } to scroll.
    // Use measured height when > 0; else fallback so we never have 0 (e.g. onLayout not fired yet).
    const fallbackPx =
      typeof window !== "undefined" ? Math.max(400, (window as any).innerHeight - 200) : 400;
    const heightPx =
      containerHeight != null && containerHeight > 0 ? containerHeight : fallbackPx;

    return (
      <div
        ref={containerRef}
        style={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          height: `${heightPx}px`,
          maxHeight: `${heightPx}px`,
          minHeight: 0,
          ...MARKDOWN_CONTENT_PADDING_PX,
        }}
      />
    );
  }
);

"use client";

import { MARKDOWN_CONTENT_PADDING_PX } from "@/lib/markdown-content-layout";
import {
  getCodeMirrorThemeConfig,
  getMarkdownHighlightStyleConfig,
  getMarkdownThemeFromPalette,
} from "@/lib/markdown-theme";
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

if (typeof document !== "undefined") {
  const cmView = require("@codemirror/view");
  const cmState = require("@codemirror/state");
  const cmCommands = require("@codemirror/commands");
  const cmLangMarkdown = require("@codemirror/lang-markdown");
  const cmLanguage = require("@codemirror/language");
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
    const themeColorsCompartmentRef = useRef<any>(null);
    const highlightCompartmentRef = useRef<any>(null);
    const { colors } = useThemeColors();
  const theme = getMarkdownThemeFromPalette(colors);
    const onChangeRef = useRef(onChangeText);
    const onSelectionRef = useRef(onSelectionChange);
    onChangeRef.current = onChangeText;
    onSelectionRef.current = onSelectionChange;

    useEffect(() => {
      if (Platform.OS !== "web" || !EditorView || !Compartment) return;

      const node = containerRef.current;
      if (!node || !(node instanceof HTMLElement)) return;

      const initial = initialValueRef.current;
      const markdownHighlightStyle = HighlightStyle.define(getMarkdownHighlightStyleConfig(theme));

      const heightCompartment = new Compartment();
      const themeColorsCompartment = new Compartment();
      const highlightCompartment = new Compartment();
      heightThemeCompartmentRef.current = heightCompartment;
      themeColorsCompartmentRef.current = themeColorsCompartment;
      highlightCompartmentRef.current = highlightCompartment;

      const state = EditorState.create({
        doc: initial,
        extensions: [
          markdown(),
          highlightCompartment.of(syntaxHighlighting(markdownHighlightStyle)),
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
          themeColorsCompartment.of(EditorView.theme(getCodeMirrorThemeConfig(theme))),
          EditorView.theme({
            ".cm-scroller": { minHeight: 0, overflow: "auto", overflowY: "scroll", height: "100%", maxHeight: "100%" },
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
        themeColorsCompartmentRef.current = null;
        highlightCompartmentRef.current = null;
      };
    }, []);

    // Reconfigure theme and syntax colors when light/dark theme changes
    useEffect(() => {
      if (Platform.OS !== "web" || !EditorView || !viewRef.current) return;
      const view = viewRef.current;
      const themeComp = themeColorsCompartmentRef.current;
      const highlightComp = highlightCompartmentRef.current;
      if (!themeComp || !highlightComp) return;

      const markdownHighlightStyle = HighlightStyle.define(getMarkdownHighlightStyleConfig(theme));
      view.dispatch({
        effects: [
          themeComp.reconfigure(EditorView.theme(getCodeMirrorThemeConfig(theme))),
          highlightComp.reconfigure(syntaxHighlighting(markdownHighlightStyle)),
        ],
      });
    }, [
      theme.foreground,
      theme.background,
      theme.muted,
      theme.link,
      theme.linkUrl,
      theme.codeBackground,
      theme.blockquoteBorder,
    ]);

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

    const bg = theme.muted ?? theme.background;
    const fg = theme.foreground;

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
          backgroundColor: bg,
          color: fg,
          ...MARKDOWN_CONTENT_PADDING_PX,
        }}
      />
    );
  }
);

"use client";

import {
  getCodeMirrorThemeConfig,
  getMarkdownHighlightStyleConfig,
  getMarkdownThemeFromPalette,
} from "@/lib/markdown-theme";
import { useThemeColors } from "@/lib/use-theme-colors";
import React, { useEffect, useImperativeHandle, useRef } from "react";
import { Platform } from "react-native";

// Only import CodeMirror on web to avoid pulling it into native bundle.
// All CodeMirror packages must be required here in one place so a single instance
// of @codemirror/state is used (required to avoid "Unrecognized extension value" errors).
// The code-block plugin is inlined here so it uses the same instances (no separate module imports).
let EditorView: any;
let EditorState: any;
let Compartment: any;
let StateField: any;
let markdown: any;
let keymap: any;
let defaultKeymap: any;
let indentWithTab: any;
let history: any;
let syntaxHighlighting: any;
let HighlightStyle: any;
let syntaxTree: any;
let BlockWrapper: any;
let getMarkdownCodeLanguages: (() => { jsSupport: any; tsSupport: any }) | null = null;
let getCodeBlockLinePlugin: (() => any[]) | null = null;

if (typeof document !== "undefined") {
  const cmView = require("@codemirror/view");
  const cmState = require("@codemirror/state");
  const cmCommands = require("@codemirror/commands");
  const cmLangMarkdown = require("@codemirror/lang-markdown");
  const cmLanguage = require("@codemirror/language");
  const cmLangJs = require("@codemirror/lang-javascript");
  EditorView = cmView.EditorView;
  EditorState = cmState.EditorState;
  Compartment = cmState.Compartment;
  StateField = cmState.StateField;
  BlockWrapper = cmView.BlockWrapper;
  markdown = cmLangMarkdown.markdown;
  keymap = cmView.keymap;
  defaultKeymap = cmCommands.defaultKeymap;
  indentWithTab = cmCommands.indentWithTab;
  history = cmCommands.history;
  syntaxHighlighting = cmLanguage.syntaxHighlighting;
  HighlightStyle = cmLanguage.HighlightStyle;
  syntaxTree = cmLanguage.syntaxTree;
  const jsSupport = cmLangJs.javascript();
  const tsSupport = cmLangJs.javascript({ typescript: true });
  getMarkdownCodeLanguages = () => ({ jsSupport, tsSupport });

  // Inline code-block wrapper plugin (same logic as code-block-line-plugin.ts) using this module's CodeMirror instances
  const CODE_BLOCK_NODES = new Set(["FencedCode", "CodeBlock"]);
  const WRAPPER_CLASS = "code-block-wrapper";
  const wrapper = BlockWrapper.create({
    tagName: "div",
    attributes: { class: WRAPPER_CLASS },
  });
  function getCodeBlockWrappers(state: any) {
    const tree = syntaxTree(state);
    const ranges: Array<{ from: number; to: number; value: any }> = [];
    tree.iterate({
      enter: (node: any) => {
        if (!CODE_BLOCK_NODES.has(node.name)) return;
        ranges.push({ from: node.from, to: node.to, value: wrapper });
      },
    });
    if (ranges.length === 0) return BlockWrapper.set([]);
    return BlockWrapper.set(ranges, true);
  }
  const codeBlockWrapperField = StateField.define({
    create(state: any) {
      return getCodeBlockWrappers(state);
    },
    update(value: any, tr: any) {
      if (tr.docChanged) return getCodeBlockWrappers(tr.state);
      return value;
    },
  });
  getCodeBlockLinePlugin = () => [
    codeBlockWrapperField,
    EditorView.blockWrappers.of((view: any) => view.state.field(codeBlockWrapperField)),
  ];
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
    const { colors, isDark } = useThemeColors();
  const theme = getMarkdownThemeFromPalette(colors, isDark);
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

      const { jsSupport, tsSupport } = getMarkdownCodeLanguages?.() ?? { jsSupport: null, tsSupport: null };
      const markdownConfig = jsSupport && tsSupport
        ? {
            defaultCodeLanguage: jsSupport.language,
            codeLanguages: (info: string) => {
              const n = (info || "").trim().toLowerCase();
              if (n === "ts" || n === "typescript") return tsSupport.language;
              if (n === "tsx") return tsSupport.language;
              return jsSupport.language;
            },
          }
        : undefined;

      const heightCompartment = new Compartment();
      const themeColorsCompartment = new Compartment();
      const highlightCompartment = new Compartment();
      heightThemeCompartmentRef.current = heightCompartment;
      themeColorsCompartmentRef.current = themeColorsCompartment;
      highlightCompartmentRef.current = highlightCompartment;

      const state = EditorState.create({
        doc: initial,
        extensions: [
          markdown(markdownConfig ?? {}),
          highlightCompartment.of(syntaxHighlighting(markdownHighlightStyle)),
          ...(getCodeBlockLinePlugin?.() ?? []),
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
      theme.isDark,
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
        }}
      />
    );
  }
);

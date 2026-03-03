"use dom";

/**
 * CodeMirror 6 editor running inside an Expo DOM component (WebView).
 * Used on native only; provides markdown syntax highlighting and the same
 * editing experience as web. Communicates with native via marshalled props
 * and useDOMImperativeHandle (focus, setSelection).
 *
 * @see https://docs.expo.dev/guides/dom-components
 */

import { MARKDOWN_CONTENT_PADDING_PX_NATIVE, MARKDOWN_FONT_SIZE } from "@/lib/markdown-content-layout";
import {
  getCodeMirrorThemeConfig,
  getMarkdownHighlightStyleMinimalConfig,
  type MarkdownThemeColors,
} from "@/lib/markdown-theme";
import { defaultKeymap, history, indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useDOMImperativeHandle, type DOMImperativeFactory } from "expo/dom";
import React, { useEffect, useRef, type Ref } from "react";

function buildThemeFromProps(props: {
  backgroundColor: string;
  color: string;
  linkColor?: string;
  linkUrlColor?: string;
  codeBackground?: string;
  blockquoteBorder?: string;
  ringColor?: string;
  isDark?: boolean;
}): MarkdownThemeColors {
  return {
    foreground: props.color,
    background: props.backgroundColor,
    muted: props.backgroundColor,
    mutedForeground: "#737373",
    ring: props.ringColor ?? (props.isDark ? "#525252" : "#a3a3a3"),
    link: props.linkColor,
    linkUrl: props.linkUrlColor,
    codeBackground: props.codeBackground,
    blockquoteBorder: props.blockquoteBorder,
    isDark: props.isDark,
  };
}

export interface CodeMirrorDOMRef extends DOMImperativeFactory {
  focus: () => void;
  setSelection: (start: number, end: number) => void;
}

interface CodeMirrorDOMProps {
  value: string;
  placeholder?: string;
  /** Native action: called when content changes. Keeps native state in sync. */
  onContentChange?: (text: string) => Promise<void>;
  /** Native action: called when selection changes. */
  onSelectionChange?: (selection: { start: number; end: number }) => Promise<void>;
  backgroundColor?: string;
  color?: string;
  /** Theme-aware syntax colors (from useThemeColors / editorPreviewColors) */
  linkColor?: string;
  linkUrlColor?: string;
  codeBackground?: string;
  blockquoteBorder?: string;
  /** Code block border/fence color – must match preview (e.g. colors.ring). */
  ringColor?: string;
  isDark?: boolean;
  dom?: import("expo/dom").DOMProps;
  ref?: Ref<CodeMirrorDOMRef>;
}

export default function CodeMirrorDOM({
  value,
  placeholder = "Start writing in markdown...",
  onContentChange,
  onSelectionChange,
  backgroundColor = "#f5f5f5",
  color = "#0a0a0a",
  linkColor,
  linkUrlColor,
  codeBackground,
  blockquoteBorder,
  ringColor,
  isDark,
  ref: refProp,
}: CodeMirrorDOMProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const initialValueRef = useRef(value);
  /** Last value we received from props. Used to detect external vs user-typed changes. */
  const prevValueRef = useRef(value);
  const onContentChangeRef = useRef(onContentChange);
  const onSelectionChangeRef = useRef(onSelectionChange);
  onContentChangeRef.current = onContentChange;
  onSelectionChangeRef.current = onSelectionChange;

  // Create CodeMirror instance once (theme colors from props so light/dark render correctly)
  useEffect(() => {
    const node = containerRef.current;
    if (!node || !(node instanceof HTMLElement)) return;

    const initial = initialValueRef.current;
    const theme = buildThemeFromProps({
      backgroundColor,
      color,
      linkColor,
      linkUrlColor,
      codeBackground,
      blockquoteBorder,
      ringColor,
      isDark,
    });
    const jsSupport = javascript();
    const tsSupport = javascript({ typescript: true });
    const markdownConfig = {
      defaultCodeLanguage: jsSupport.language,
      codeLanguages: (info: string) => {
        const n = (info || "").trim().toLowerCase();
        if (n === "ts" || n === "typescript") return tsSupport.language;
        if (n === "tsx") return tsSupport.language;
        return jsSupport.language;
      },
    };
    const highlightStyle = HighlightStyle.define(
      getMarkdownHighlightStyleMinimalConfig(theme) as Parameters<
        typeof HighlightStyle.define
      >[0]
    );
    const baseTheme = getCodeMirrorThemeConfig(theme, { contentPadding: false });
    const state = EditorState.create({
      doc: initial,
      extensions: [
        markdown(markdownConfig),
        syntaxHighlighting(highlightStyle),
        history(),
        keymap.of([...defaultKeymap, indentWithTab]),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && onContentChangeRef.current) {
            const v = update.state.doc.toString();
            onContentChangeRef.current(v);
          }
          if (update.selectionSet && onSelectionChangeRef.current) {
            const sel = update.state.selection.main;
            onSelectionChangeRef.current({ start: sel.from, end: sel.to });
          }
        }),
        EditorView.theme({
          "&": { height: "100%", minHeight: 0, maxHeight: "100%" },
          ...baseTheme,
          ".cm-scroller": {
            overflow: "auto",
            overflowY: "scroll",
            height: "100%",
            maxHeight: "100%",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
          },
        }),
      ],
    });

    const view = new EditorView({ state, parent: node });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Sync value from native only when the change is external (toolbar, undo, paste).
  // When the user types fast, value prop can lag behind editor content due to async bridge.
  // Only overwrite editor when editor content still matches the previous value we had
  // (i.e. no typing happened in the meantime).
  useEffect(() => {
    if (!viewRef.current) return;
    const current = viewRef.current.state.doc.toString();
    const prevValue = prevValueRef.current;
    prevValueRef.current = value;
    if (value !== current && current === prevValue) {
      viewRef.current.dispatch({
        changes: { from: 0, to: current.length, insert: value || "" },
      });
    }
  }, [value]);

  // Expose ref methods for native (focus, setSelection). getValueAsync is not
  // supported here; native should rely on onContentChange so state is always in sync.
  useDOMImperativeHandle(
    refProp,
    () => ({
      focus: () => {
        viewRef.current?.focus();
      },
      setSelection: (start: number, end: number) => {
        if (viewRef.current) {
          viewRef.current.dispatch({
            selection: { anchor: start, head: end },
          });
        }
      },
    }),
    []
  );

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minHeight: 200,
        height: "100%",
        maxHeight: "100%",
        overflow: "hidden",
        fontSize: `${MARKDOWN_FONT_SIZE}px`,
        ...MARKDOWN_CONTENT_PADDING_PX_NATIVE,
        backgroundColor,
        color,
        boxSizing: "border-box",
      }}
    />
  );
}

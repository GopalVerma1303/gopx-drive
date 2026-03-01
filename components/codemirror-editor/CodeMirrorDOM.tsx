"use dom";

/**
 * CodeMirror 6 editor running inside an Expo DOM component (WebView).
 * Used on native only; provides markdown syntax highlighting and the same
 * editing experience as web. Communicates with native via marshalled props
 * and useDOMImperativeHandle (focus, setSelection).
 *
 * @see https://docs.expo.dev/guides/dom-components
 */

import {
  MARKDOWN_CODE_FONT_SIZE_EM,
  MARKDOWN_CONTENT_PADDING_PX,
  MARKDOWN_FONT_SIZE,
  MARKDOWN_FONT_SIZE_EM,
  MARKDOWN_HEADING1_EM,
  MARKDOWN_HEADING2_EM,
  MARKDOWN_HEADING3_EM,
  MARKDOWN_HEADING4_EM,
  MARKDOWN_HEADING5_EM,
  MARKDOWN_HEADING6_EM,
  MARKDOWN_LINE_HEIGHT_CSS,
} from "@/lib/markdown-content-layout";
import { defaultKeymap, history, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useDOMImperativeHandle, type DOMImperativeFactory } from "expo/dom";
import React, { useEffect, useRef, type Ref } from "react";

function buildMarkdownHighlightStyle(theme: {
  link?: string;
  linkUrl?: string;
  codeBackground?: string;
  blockquoteBorder?: string;
}) {
  const link = theme.link ?? "#0969da";
  const linkUrl = theme.linkUrl ?? "#0550ae";
  const codeBg = theme.codeBackground ?? "rgba(128,128,128,0.15)";
  const quoteBorder = theme.blockquoteBorder ?? "rgba(128,128,128,0.5)";
  return HighlightStyle.define([
    { tag: tags.heading1, fontWeight: "700", fontSize: MARKDOWN_HEADING1_EM },
    { tag: tags.heading2, fontWeight: "700", fontSize: MARKDOWN_HEADING2_EM },
    { tag: tags.heading3, fontWeight: "600", fontSize: MARKDOWN_HEADING3_EM },
    { tag: tags.heading4, fontWeight: "600", fontSize: MARKDOWN_HEADING4_EM },
    { tag: tags.heading5, fontWeight: "600", fontSize: MARKDOWN_HEADING5_EM },
    { tag: tags.heading6, fontWeight: "600", fontSize: MARKDOWN_HEADING6_EM, opacity: "0.9" },
    { tag: tags.strong, fontWeight: "700" },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.link, color: link, textDecoration: "underline" },
    { tag: tags.url, color: linkUrl },
    { tag: tags.monospace, fontFamily: "ui-monospace, monospace", fontSize: MARKDOWN_CODE_FONT_SIZE_EM, backgroundColor: codeBg, padding: "0.12em 0.3em", borderRadius: "4px" },
    { tag: tags.quote, opacity: "0.85", borderLeft: `3px solid ${quoteBorder}`, paddingLeft: "0.5em" },
    { tag: tags.list, opacity: "0.95" },
    { tag: tags.contentSeparator, opacity: "0.6" },
    { tag: tags.processingInstruction, opacity: "0.65" },
    { tag: tags.comment, opacity: "0.6", fontStyle: "italic" },
  ]);
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
    const highlightStyle = buildMarkdownHighlightStyle({
      link: linkColor,
      linkUrl: linkUrlColor,
      codeBackground,
      blockquoteBorder,
    });
    const state = EditorState.create({
      doc: initial,
      extensions: [
        markdown(),
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
          "&.cm-editor": {
            fontSize: MARKDOWN_FONT_SIZE_EM,
            fontFamily: "ui-monospace, monospace",
            backgroundColor,
            color,
          },
          "&.cm-editor.cm-focused": { outline: "none" },
          ".cm-scroller": {
            overflow: "auto",
            overflowY: "scroll",
            height: "100%",
            maxHeight: "100%",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
          },
          ".cm-content": { padding: 0, paddingBottom: `${MARKDOWN_CONTENT_PADDING_PX.paddingBottom}px` },
          ".cm-line": { lineHeight: MARKDOWN_LINE_HEIGHT_CSS },
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
        ...MARKDOWN_CONTENT_PADDING_PX,
        backgroundColor,
        color,
        boxSizing: "border-box",
      }}
    />
  );
}

"use dom";

/**
 * CodeMirror 6 editor running inside an Expo DOM component (WebView).
 * Used on native only; provides markdown syntax highlighting and the same
 * editing experience as web. Communicates with native via marshalled props
 * and useDOMImperativeHandle (focus, setSelection).
 *
 * @see https://docs.expo.dev/guides/dom-components
 */

import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, indentWithTab, history } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import React, { useEffect, useRef, type Ref } from "react";
import { useDOMImperativeHandle, type DOMImperativeFactory } from "expo/dom";

/** Markdown syntax highlighting: headings, emphasis, strong, links, inline code, etc. */
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
  { tag: tags.monospace, fontFamily: "ui-monospace, monospace", backgroundColor: "rgba(128,128,128,0.15)", padding: "0.12em 0.3em", borderRadius: "4px" },
  { tag: tags.quote, opacity: "0.85", borderLeft: "3px solid rgba(128,128,128,0.5)", paddingLeft: "0.5em" },
  { tag: tags.list, opacity: "0.95" },
  { tag: tags.contentSeparator, opacity: "0.6" },
  { tag: tags.processingInstruction, opacity: "0.65" },
  { tag: tags.comment, opacity: "0.6", fontStyle: "italic" },
]);

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

  // Create CodeMirror instance once
  useEffect(() => {
    const node = containerRef.current;
    if (!node || !(node instanceof HTMLElement)) return;

    const initial = initialValueRef.current;
    const state = EditorState.create({
      doc: initial,
      extensions: [
        markdown(),
        syntaxHighlighting(markdownHighlightStyle),
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
          "&": { height: "100%" },
          "&.cm-editor": {
            fontSize: 16,
            fontFamily: "ui-monospace, monospace",
          },
          "&.cm-editor.cm-focused": { outline: "none" },
          ".cm-content": { padding: 0 },
          ".cm-line": { lineHeight: "24px" },
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
        paddingLeft: 32,
        paddingRight: 32,
        paddingTop: 24,
        paddingBottom: 65,
        backgroundColor,
        color,
        boxSizing: "border-box",
      }}
    />
  );
}

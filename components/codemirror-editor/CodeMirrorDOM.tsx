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
import React, { useEffect, useRef, type Ref } from "react";
import { useDOMImperativeHandle, type DOMImperativeFactory } from "expo/dom";

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
        history(),
        keymap.of([...defaultKeymap, indentWithTab]),
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

  // Sync value from native when it changes (e.g. undo, toolbar, setValue)
  useEffect(() => {
    if (!viewRef.current) return;
    const current = viewRef.current.state.doc.toString();
    if (value !== current) {
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

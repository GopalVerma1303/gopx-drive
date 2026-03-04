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
  getMarkdownHighlightStyleConfig,
  getScrollbarCss,
  type MarkdownThemeColors,
} from "@/lib/markdown-theme";
import { defaultKeymap, history, indentWithTab } from "@codemirror/commands";
import { cpp } from "@codemirror/lang-cpp";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { php } from "@codemirror/lang-php";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useDOMImperativeHandle, type DOMImperativeFactory } from "expo/dom";
import React, { useEffect, useRef, type Ref } from "react";

/** Matches expo/dom marshalling: methods exposed to native must accept JSON-serializable args. */
type JSONValue = boolean | number | string | null | JSONValue[] | { [key: string]: JSONValue | undefined };

function buildThemeFromProps(props: {
  backgroundColor: string;
  color: string;
  muted?: string;
  mutedForeground?: string;
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
    muted: props.muted ?? props.backgroundColor,
    mutedForeground: props.mutedForeground ?? "#737373",
    ring: props.ringColor ?? (props.isDark ? "#525252" : "#a3a3a3"),
    link: props.linkColor,
    linkUrl: props.linkUrlColor,
    codeBackground: props.codeBackground,
    blockquoteBorder: props.blockquoteBorder,
    isDark: props.isDark,
  };
}

export interface CodeMirrorDOMRef extends DOMImperativeFactory {
  focus: (...args: JSONValue[]) => void;
  setSelection: (...args: JSONValue[]) => void;
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
  /** For scrollbar styling (match app theme). */
  muted?: string;
  mutedForeground?: string;
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
  muted,
  mutedForeground,
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
      muted,
      mutedForeground,
      linkColor,
      linkUrlColor,
      codeBackground,
      blockquoteBorder,
      ringColor,
      isDark,
    });
    const jsSupport = javascript();
    const tsSupport = javascript({ typescript: true });
    const pythonSupport = python();
    const rustSupport = rust();
    const phpSupport = php();
    const javaSupport = java();
    const cppSupport = cpp();
    const sqlSupport = sql();
    const jsonSupport = json();
    const htmlSupport = html();
    const xmlSupport = xml();
    const cssSupport = css();

    const codeLanguageSpecs: Array<{ names: string[]; support: { language: any } }> = [
      {
        support: tsSupport,
        names: ["ts", "typescript", "tsx"],
      },
      {
        support: jsSupport,
        names: ["", "js", "javascript", "jsx", "mjs", "cjs", "node"],
      },
      {
        support: pythonSupport,
        names: ["py", "python"],
      },
      {
        support: rustSupport,
        names: ["rs", "rust"],
      },
      {
        support: phpSupport,
        names: ["php"],
      },
      {
        support: javaSupport,
        names: ["java"],
      },
      {
        support: cppSupport,
        names: ["c", "h", "hpp", "hh", "hxx", "cc", "cxx", "cpp", "c++"],
      },
      {
        support: sqlSupport,
        names: ["sql", "postgres", "postgresql", "mysql"],
      },
      {
        support: jsonSupport,
        names: ["json"],
      },
      {
        support: htmlSupport,
        names: ["html", "htm", "xhtml"],
      },
      {
        support: xmlSupport,
        names: ["xml", "xaml", "svg"],
      },
      {
        support: cssSupport,
        names: ["css", "scss", "less"],
      },
    ];

    const markdownConfig = {
      defaultCodeLanguage: jsSupport.language,
      codeLanguages: (info: string) => {
        const name = (info || "").trim().toLowerCase();
        for (const spec of codeLanguageSpecs) {
          if (spec.names.includes(name)) {
            return spec.support.language;
          }
        }
        return jsSupport.language;
      },
    };
    const highlightStyle = HighlightStyle.define(
      getMarkdownHighlightStyleConfig(theme) as Parameters<typeof HighlightStyle.define>[0]
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
    refProp ?? null,
    () => ({
      focus: () => {
        const view = viewRef.current;
        if (!view) return;

        // On native, focus the underlying DOM node with preventScroll where
        // supported so toolbar actions don't cause the editor viewport to jump.
        const dom: any = (view as any).dom;
        if (dom && typeof dom.focus === "function") {
          try {
            dom.focus({ preventScroll: true } as any);
            return;
          } catch {
            dom.focus();
            return;
          }
        }

        view.focus();
      },
      setSelection: (...args: JSONValue[]) => {
        const [start, end] = args as [number, number];
        if (viewRef.current && typeof start === "number" && typeof end === "number") {
          viewRef.current.dispatch({
            selection: { anchor: start, head: end },
          });
        }
      },
    }),
    []
  );

  const scrollbarCss = getScrollbarCss(
    { muted: muted ?? backgroundColor, mutedForeground: mutedForeground ?? "#737373" },
    ".cm-scroller"
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: scrollbarCss }} />
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
    </>
  );
}

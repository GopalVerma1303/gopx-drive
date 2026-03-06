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
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { EditorState, StateField } from "@codemirror/state";
import { BlockWrapper, Decoration, EditorView, keymap, ViewPlugin, WidgetType } from "@codemirror/view";
import { useDOMImperativeHandle, type DOMImperativeFactory } from "expo/dom";
import React, { useEffect, useRef, type Ref } from "react";

/** Matches expo/dom marshalling: methods exposed to native must accept JSON-serializable args. */
type JSONValue = boolean | number | string | null | JSONValue[] | { [key: string]: JSONValue | undefined };

// Code-block + blockquote wrappers match web editor behavior so styles like
// `.code-block-wrapper` from `getCodeMirrorThemeConfig` also apply on native.
const CODE_BLOCK_NODES = new Set(["FencedCode", "CodeBlock"]);
const CODE_BLOCK_WRAPPER_CLASS = "code-block-wrapper";
const codeBlockWrapper = BlockWrapper.create({
  tagName: "div",
  attributes: { class: CODE_BLOCK_WRAPPER_CLASS },
});

const BLOCKQUOTE_WRAPPER_CLASS = "blockquote-wrapper";
const blockquoteWrapper = BlockWrapper.create({
  tagName: "div",
  attributes: { class: BLOCKQUOTE_WRAPPER_CLASS },
});

function getBlockWrappers(state: EditorState) {
  const tree = syntaxTree(state);
  const ranges: Array<{ from: number; to: number; value: any }> = [];
  tree.iterate({
    enter: (node: any) => {
      if (CODE_BLOCK_NODES.has(node.name)) {
        ranges.push({ from: node.from, to: node.to, value: codeBlockWrapper });
      } else if (node.name === "Blockquote") {
        ranges.push({ from: node.from, to: node.to, value: blockquoteWrapper });
      }
    },
  });
  if (ranges.length === 0) return BlockWrapper.set([]);
  return BlockWrapper.set(ranges, true);
}

const blockWrapperField = StateField.define<any>({
  create(state) {
    return getBlockWrappers(state as EditorState);
  },
  update(value, tr) {
    if (tr.docChanged) return getBlockWrappers(tr.state as EditorState);
    return value;
  },
});

class HiddenQuoteMarkWidget extends WidgetType {
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.style.display = "inline-block";
    span.style.width = "0";
    span.style.overflow = "hidden";
    span.setAttribute("aria-hidden", "true");
    return span;
  }
}

const hiddenQuoteWidget = new HiddenQuoteMarkWidget();

function getBlockquoteHideQuoteDecorations(state: EditorState) {
  const tree = syntaxTree(state);
  const decos: Array<{ from: number; to: number; decoration: any }> = [];
  tree.iterate({
    enter: (node: any) => {
      if (node.name !== "Blockquote") return;
      const firstLine = state.doc.lineAt(node.from);
      tree.iterate({
        from: node.from,
        to: node.to,
        enter: (n: any) => {
          if (n.name === "QuoteMark" && n.from >= firstLine.to) {
            decos.push({
              from: n.from,
              to: n.to,
              decoration: Decoration.replace({ widget: hiddenQuoteWidget, side: 1 }),
            });
          }
        },
      });
    },
  });
  if (decos.length === 0) return Decoration.none;
  return Decoration.set(
    decos.map((d) => ({ from: d.from, to: d.to, value: d.decoration })),
    true
  );
}

const blockquoteHideQuoteMarkField = StateField.define<any>({
  create(state) {
    return getBlockquoteHideQuoteDecorations(state as EditorState);
  },
  update(value, tr) {
    if (tr.docChanged) return getBlockquoteHideQuoteDecorations(tr.state as EditorState);
    return value.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

const codeBlockAndBlockquotePlugins = [
  blockWrapperField,
  EditorView.blockWrappers.of((view) => view.state.field(blockWrapperField)),
  blockquoteHideQuoteMarkField,
];

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
    const wrapText = (view: EditorView, before: string, after: string, cursorOffset?: number) => {
      const sel = view.state.selection.main;
      const selectedText = view.state.sliceDoc(sel.from, sel.to);
      if (selectedText.length > 0) {
        const replacement = before + selectedText + after;
        view.dispatch({
          changes: { from: sel.from, to: sel.to, insert: replacement },
          selection: {
            anchor: sel.from + replacement.length,
            head: sel.from + replacement.length,
          },
          scrollIntoView: true,
        });
      } else {
        const replacement = before + after;
        const offset = typeof cursorOffset === "number" ? cursorOffset : before.length;
        const cursorPos = sel.from + offset;
        view.dispatch({
          changes: { from: sel.from, to: sel.to, insert: replacement },
          selection: { anchor: cursorPos, head: cursorPos },
          scrollIntoView: true,
        });
      }
      return true;
    };

    const customMarkdownKeymap = [
      { key: "Mod-b", run: (view: EditorView) => wrapText(view, "**", "**", 2) },
      { key: "Mod-i", run: (view: EditorView) => wrapText(view, "*", "*", 1) },
      { key: "Mod-u", run: () => true }, // Prevent native underline
      {
        key: "Mod-k",
        run: (view: EditorView) => {
          const sel = view.state.selection.main;
          const selectedText = view.state.sliceDoc(sel.from, sel.to);
          if (selectedText.length > 0) {
            const replacement = `[${selectedText}]()`;
            view.dispatch({
              changes: { from: sel.from, to: sel.to, insert: replacement },
              selection: {
                anchor: sel.from + replacement.length - 1,
                head: sel.from + replacement.length - 1,
              },
              scrollIntoView: true,
            });
          } else {
            wrapText(view, "[", "]()", 1);
          }
          return true;
        },
      },
    ];

    const mentionPlugin = ViewPlugin.fromClass(
      class {
        decorations: any;

        constructor(view: EditorView) {
          this.decorations = this.getMentions(view);
        }

        update(update: any) {
          if (update.docChanged || update.viewportChanged) {
            this.decorations = this.getMentions(update.view);
          }
        }

        getMentions(view: EditorView) {
          let widgets: any[] = [];
          const MENTION_REGEX = /(^|\s)(@[\w-]+)(?=\b|\s|$)/g;

          for (let { from, to } of view.visibleRanges) {
            const text: string = view.state.doc.sliceString(from, to);
            let match;
            MENTION_REGEX.lastIndex = 0;

            while ((match = MENTION_REGEX.exec(text)) !== null) {
              const mSpace = match[1];
              const mTag = match[2];

              const matchStart = from + match.index + mSpace.length;
              const matchEnd = matchStart + mTag.length;

              widgets.push(Decoration.mark({ class: "cm-mention-tag" }).range(matchStart, matchEnd));
            }
          }
          return Decoration.set(widgets);
        }
      },
      {
        decorations: (v: any) => v.decorations,
      }
    );

    const state = EditorState.create({
      doc: initial,
      extensions: [
        markdown(markdownConfig),
        syntaxHighlighting(highlightStyle),
        ...codeBlockAndBlockquotePlugins,
        mentionPlugin,
        history(),
        keymap.of([...customMarkdownKeymap, ...defaultKeymap, indentWithTab]),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && onContentChangeRef.current) {
            const v = update.state.doc.toString();
            onContentChangeRef.current(v);
          }
          if (update.selectionSet) {
            const sel = update.state.selection.main;

            // Skip explicit scrolling if the selection was changed by a pointer (e.g. tapping an empty line)
            const isPointer = update.transactions.some(tr => tr.isUserEvent("select.pointer"));

            if (!isPointer) {
              // Keep caret line comfortably visible inside the editor viewport (helps when keyboard opens).
              const yMargin = typeof window !== "undefined" ? Math.floor(window.innerHeight * 0.2) : 48;

              try {
                update.view.dispatch({
                  effects: EditorView.scrollIntoView(sel.head, { y: "nearest", yMargin } as any),
                });
              } catch {
                // Fallback without options if older CodeMirror version
                try {
                  update.view.dispatch({
                    effects: EditorView.scrollIntoView(sel.head),
                  });
                } catch {
                  // ignore if scrollIntoView not available
                }
              }
            }

            if (onSelectionChangeRef.current) {
              onSelectionChangeRef.current({ start: sel.from, end: sel.to });
            }
          }
        }),
        // Enable browser/IME text assistance (Autocapitalization, autocorrect, spellcheck, etc.)
        EditorView.contentAttributes.of({
          autocomplete: "on",
          autocorrect: "on",
          autocapitalize: "sentences",
          spellcheck: "true",
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
      // Find common prefix
      let prefixLen = 0;
      const minLength = Math.min(current.length, value.length);
      while (prefixLen < minLength && current[prefixLen] === value[prefixLen]) {
        prefixLen++;
      }

      // Find common suffix
      let currentSuffixIdx = current.length - 1;
      let valueSuffixIdx = value.length - 1;
      while (
        currentSuffixIdx >= prefixLen &&
        valueSuffixIdx >= prefixLen &&
        current[currentSuffixIdx] === value[valueSuffixIdx]
      ) {
        currentSuffixIdx--;
        valueSuffixIdx--;
      }

      const insert = value.slice(prefixLen, valueSuffixIdx + 1);

      viewRef.current.dispatch({
        changes: { from: prefixLen, to: currentSuffixIdx + 1, insert },
      });
    }
  }, [value]);

  // Expose ref methods for native (focus, setSelection). getValueAsync is not
  // supported here; native should rely on onContentChange so state is always in sync.
  useDOMImperativeHandle(
    (refProp as React.Ref<DOMImperativeFactory> | null) ?? null,
    () =>
      ({
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
        insertText: (...args: JSONValue[]) => {
          const [text, cursorOffset] = args as [string, number | undefined];
          const view = viewRef.current;
          if (!view) return;
          const sel = view.state.selection.main;
          const insert = text ?? "";
          const newPos = sel.from + (typeof cursorOffset === "number" ? cursorOffset : insert.length);
          view.dispatch({
            changes: { from: sel.from, to: sel.to, insert },
            selection: { anchor: newPos, head: newPos },
          });
        },
        wrapSelection: (...args: JSONValue[]) => {
          const [before, after, cursorOffset] = args as [
            string,
            string,
            number | undefined
          ];
          const view = viewRef.current;
          if (!view) return;
          const sel = view.state.selection.main;
          const doc = view.state.doc.toString();
          const selected = doc.slice(sel.from, sel.to);
          const prefix = before ?? "";
          const suffix = after ?? "";
          const insert = prefix + selected + suffix;
          const defaultOffset = selected.length > 0 ? prefix.length + selected.length + suffix.length : prefix.length;
          const newPos =
            sel.from + (typeof cursorOffset === "number" ? cursorOffset : defaultOffset);
          view.dispatch({
            changes: { from: sel.from, to: sel.to, insert },
            selection: { anchor: newPos, head: newPos },
          });
        },
      }) as DOMImperativeFactory,
    []
  );

  const scrollbarCss = getScrollbarCss(
    { muted: muted ?? backgroundColor, mutedForeground: mutedForeground ?? "#737373" },
    ".cm-scroller"
  );

  const editorFontScale = 0.94;
  const editorFontSizePx = Math.round(MARKDOWN_FONT_SIZE * editorFontScale);

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
          fontSize: `${editorFontSizePx}px`,
          ...MARKDOWN_CONTENT_PADDING_PX_NATIVE,
          backgroundColor: muted ?? backgroundColor,
          color,
          boxSizing: "border-box",
        }}
      />
    </>
  );
}

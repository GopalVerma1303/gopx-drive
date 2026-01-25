import { useThemeColors } from "@/lib/use-theme-colors";
import { cn } from "@/lib/utils";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownKeymap } from "@codemirror/lang-markdown";
import { HighlightStyle, defaultHighlightStyle, ensureSyntaxTree, syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { RangeSetBuilder } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { Decoration, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import CodeMirror from "@uiw/react-codemirror";
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import markdownDecorations from "@/webviewBundles/markdownEditorBundle/markdownDecorations";
import { gfmMarkdownLanguage } from "@/webviewBundles/markdownEditorBundle/gfmMarkdownLanguage";
import { Checkbox } from "@/components/ui/checkbox";
import { createRoot, type Root } from "react-dom/client";

interface EditorProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  className?: string;
}

export interface EditorRef {
  insertText: (text: string, cursorOffset?: number) => void;
  wrapSelection: (before: string, after: string, cursorOffset?: number) => void;
  focus: () => void;
  getSelection: () => { start: number; end: number };
}

type Theme = {
  dark: boolean;
  background: string;
  foreground: string;
  caret: string;
  selection: string;
  placeholder: string;
  fontSize: number;
  lineHeight: number;
};

export const Editor = forwardRef<EditorRef, EditorProps>(function Editor(
  { value, onChangeText, placeholder = "Start writing...", className },
  ref
) {
  const { colors, isDark } = useThemeColors();

  const cmViewRef = useRef<any>(null);
  const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const latestValueRef = useRef(value);
  const onChangeTextRef = useRef(onChangeText);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    onChangeTextRef.current = onChangeText;
  }, [onChangeText]);

  const editorTheme: Theme = useMemo(() => {
    const selection = isDark ? "rgba(250,250,250,0.18)" : "rgba(10,10,10,0.12)";
    return {
      dark: isDark,
      background: colors.muted,
      foreground: colors.foreground,
      caret: colors.foreground,
      selection,
      placeholder: colors.mutedForeground,
      fontSize: 17,
      lineHeight: 24,
    };
  }, [colors, isDark]);

  const extensions = useMemo(() => {
    class EmptyWidget extends WidgetType {
      public override toDOM(): HTMLElement {
        const el = document.createElement("span");
        el.className = "cm-livePreviewHidden";
        return el;
      }
    }

    class ListMarkWidget extends WidgetType {
      public constructor(
        private readonly text: string,
        private readonly focusPos: number
      ) {
        super();
      }

      public override eq(other: ListMarkWidget) {
        return this.text === other.text && this.focusPos === other.focusPos;
      }

      public override toDOM(view: EditorView): HTMLElement {
        const el = document.createElement("span");
        el.className = "cm-livePreviewListMark";
        el.textContent = this.text;

        const focusEditorHere = (event: Event) => {
          event.preventDefault();
          view.dispatch({ selection: { anchor: this.focusPos }, scrollIntoView: true });
          view.focus();
        };

        el.addEventListener("mousedown", focusEditorHere);
        el.addEventListener("touchstart", focusEditorHere, { passive: false });
        return el;
      }

      public override ignoreEvent() {
        return false;
      }
    }

    class CheckboxWidget extends WidgetType {
      public constructor(
        private readonly checked: boolean,
        private readonly togglePos: number
      ) {
        super();
      }

      public override eq(other: CheckboxWidget) {
        return this.checked === other.checked && this.togglePos === other.togglePos;
      }

      public override toDOM(view: EditorView): HTMLElement {
        const wrap = document.createElement("span");
        wrap.className = "cm-livePreviewCheckbox";
        wrap.setAttribute("contenteditable", "false");
        const stop = (e: Event) => e.stopPropagation();
        wrap.addEventListener("mousedown", stop);
        wrap.addEventListener("click", stop);
        wrap.addEventListener("touchstart", stop);

        const onCheckedChange = (value: boolean | "indeterminate") => {
          const nextChecked = value === true;
          const insert = nextChecked ? "x" : " ";
          view.dispatch({ changes: { from: this.togglePos, to: this.togglePos + 1, insert } });
          view.focus();
        };

        const mount = document.createElement("span");
        mount.className = "cm-livePreviewCheckboxMount";
        wrap.appendChild(mount);

        const root = createRoot(mount);
        (this as any).__reactRoot = root as Root;
        root.render(
          <Checkbox
            checked={this.checked}
            onCheckedChange={onCheckedChange}
            className="align-middle"
          />
        );
        return wrap;
      }

      public override ignoreEvent() {
        return true;
      }

      public override destroy(dom: HTMLElement): void {
        const root = (this as any).__reactRoot as Root | undefined;
        try {
          root?.unmount();
        } catch {
          // no-op
        }
        (this as any).__reactRoot = undefined;
        dom.textContent = "";
      }
    }

    const emptyWidget = new EmptyWidget();

    const markdownInlinePreview = ViewPlugin.fromClass(
      class {
        public decorations: DecorationSet;

        public constructor(view: EditorView) {
          this.decorations = this.compute(view);
        }

        public update(update: ViewUpdate) {
          if (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged) {
            this.decorations = this.compute(update.view);
          }
        }

        private compute(view: EditorView): DecorationSet {
          const isFocused = view.hasFocus;
          const sel = view.state.selection.main;
          const selFrom = Math.min(sel.from, sel.to);
          const selTo = Math.max(sel.from, sel.to);
          const selIsCollapsed = selFrom === selTo;
          const cursorPos = selTo;

          const taskMarkerRangeCache = new Map<number, { start: number; end: number } | null>();
          const taskMarkerRangeForLine = (lineFrom: number, lineTo: number) => {
            if (taskMarkerRangeCache.has(lineFrom)) return taskMarkerRangeCache.get(lineFrom)!;
            const text = view.state.doc.sliceString(lineFrom, lineTo);
            const m = /^(\s*(?:[-+*]|\d+\.)\s*)\[( |x|X)\]/.exec(text);
            if (!m) {
              taskMarkerRangeCache.set(lineFrom, null);
              return null;
            }
            const start = lineFrom + (m[1]?.length ?? 0);
            const end = start + 3; // "[ ]" / "[x]"
            const r = { start, end };
            taskMarkerRangeCache.set(lineFrom, r);
            return r;
          };

          const items: Array<{ from: number; to: number; deco: Decoration }> = [];
          const add = (from: number, to: number, deco: Decoration) => {
            if (from >= to) return;
            // Avoid cross-line replacements (can destabilize the view).
            const line = view.state.doc.lineAt(from);
            if (to > line.to) return;
            items.push({ from, to, deco });
          };

          const taskLinesWithSyntaxNode = new Set<number>();

          for (const range of view.visibleRanges) {
            const tree = ensureSyntaxTree(view.state, range.to);
            if (!tree) continue;

            tree.iterate({
              from: range.from,
              to: range.to,
              enter: (node) => {
                const from = node.from;
                const to = node.to;

                const line = view.state.doc.lineAt(from);
                const overlapsSelection = isFocused && selFrom <= line.to && selTo >= line.from;
                let treatLineAsActive = overlapsSelection;
                if (treatLineAsActive && selIsCollapsed) {
                  const r = taskMarkerRangeForLine(line.from, line.to);
                  if (r && cursorPos >= r.start && cursorPos <= r.end) {
                    // Cursor is on the checkbox marker itself -> keep preview mode.
                    treatLineAsActive = false;
                  }
                }
                if (treatLineAsActive) return;

                // If this line is a task list item, don't apply other inline replacements
                // inside the "[ ]"/"[x]" marker range—otherwise they can "win" over the checkbox.
                const taskRange = taskMarkerRangeForLine(line.from, line.to);
                if (taskRange && from >= taskRange.start && to <= taskRange.end && node.name !== "TaskMarker") {
                  return;
                }

                // Task list checkboxes: replace "[ ]" / "[x]" with a real checkbox.
                if (node.name === "TaskMarker") {
                  const text = view.state.doc.sliceString(from, to);
                  const isChecked = /\[x\]/i.test(text);
                  // Toggle the character inside the brackets.
                  const togglePos = Math.min(to - 2, from + 1);
                  add(from, to, Decoration.replace({ widget: new CheckboxWidget(isChecked, togglePos) }));
                  taskLinesWithSyntaxNode.add(line.from);
                  return;
                }

                // Hide link destinations like: [text](url) / ![alt](url)
                // (We don't want to hide bare URLs in text.)
                if (node.name === "URL") {
                  const relFrom = from - line.from;
                  if (relFrom >= 2) {
                    const lineText = view.state.doc.sliceString(line.from, line.to);
                    const before2 = lineText.slice(relFrom - 2, relFrom);
                    if (before2 === "](" || before2 === "]<") {
                      add(from, to, Decoration.replace({ widget: emptyWidget }));
                      return;
                    }
                  }
                }

                // Replace list bullets/numbers with a stable marker, hide other formatting marks.
                const isMark = node.name.endsWith("Mark") || node.name === "HeaderMark" || node.name === "QuoteMark";
                if (!isMark) return;

                const text = view.state.doc.sliceString(from, to).trim();
                if (!text) {
                  add(from, to, Decoration.replace({ widget: emptyWidget }));
                  return;
                }

                if (node.name === "ListMark") {
                  const fullLineText = view.state.doc.sliceString(line.from, line.to);
                  if (/^\s*(?:[-+*]|\d+\.)\s*\[(?: |x|X)\]/.test(fullLineText)) {
                    // Task list items shouldn't show an extra bullet before the checkbox.
                    add(from, to, Decoration.replace({ widget: emptyWidget }));
                    return;
                  }
                  const marker = /^\d+\.$/.test(text) ? `${text} ` : "• ";
                  add(from, to, Decoration.replace({ widget: new ListMarkWidget(marker, line.from) }));
                  return;
                }

                // Hide all other markdown markup characters on non-active lines.
                add(from, to, Decoration.replace({ widget: emptyWidget }));
              },
            });
          }

          // Fallback: if the syntax tree doesn't include TaskMarker (parser differences),
          // detect task markers by regex and render the checkbox anyway.
          for (const range of view.visibleRanges) {
            let pos = range.from;
            while (pos <= range.to) {
              const line = view.state.doc.lineAt(pos);
              pos = line.to + 1;
              if (taskLinesWithSyntaxNode.has(line.from)) continue;

              const overlapsSelection = isFocused && selFrom <= line.to && selTo >= line.from;
              if (overlapsSelection) {
                if (!selIsCollapsed) continue;
                const r = taskMarkerRangeForLine(line.from, line.to);
                if (!r || cursorPos < r.start || cursorPos > r.end) continue;
              }

              const text = view.state.doc.sliceString(line.from, line.to);
              const m = /^(\s*(?:[-+*]|\d+\.)\s*)\[( |x|X)\]/.exec(text);
              if (!m) continue;

              const start = line.from + (m[1]?.length ?? 0);
              const end = start + 3; // "[ ]" / "[x]"
              const togglePos = start + 1;
              const isChecked = (m[2] ?? "").toLowerCase() === "x";
              add(start, end, Decoration.replace({ widget: new CheckboxWidget(isChecked, togglePos) }));
            }
          }

          items.sort((a, b) => a.from - b.from || a.to - b.to);
          const builder = new RangeSetBuilder<Decoration>();
          let lastTo = -1;
          for (const item of items) {
            if (item.from < lastTo) continue;
            builder.add(item.from, item.to, item.deco);
            lastTo = item.to;
          }
          return builder.finish();
        }
      },
      { decorations: (v) => v.decorations }
    );

    // Joplin-style: markdown language + highlight style + fallback highlight.
    // Critical for fenced code blocks: provide `codeLanguages`.
    const themeExt = EditorView.theme(
      {
        "&": {
          backgroundColor: editorTheme.background,
          color: editorTheme.foreground,
          height: "100%",
          minHeight: 0,
        },
        ".cm-editor": {
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        },
        ".cm-scroller": {
          flex: 1,
          minHeight: 0,
          overflowY: "auto !important",
          backgroundColor: editorTheme.background,
        },
        ".cm-content": {
          padding: "20px 24px 40px",
          caretColor: editorTheme.caret,
          fontSize: `${editorTheme.fontSize}px`,
          lineHeight: `${editorTheme.lineHeight}px`,
        },
        // Disable "active line" background on web (it feels like a cursor-line highlight).
        ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "transparent !important" },
        ".cm-selectionBackground, ::selection": { backgroundColor: `${editorTheme.selection} !important` },
        ".cm-placeholder": { color: editorTheme.placeholder },

        // "Rich Markdown" style preview helpers (hide markup + render checkboxes/markers).
        ".cm-livePreviewHidden": {
          // Empty widget element (kept for debugging; no visual impact).
          display: "inline-block",
          width: "0px",
          overflow: "hidden",
        },
        ".cm-livePreviewListMark": {
          font: "inherit",
          color: editorTheme.foreground,
          opacity: editorTheme.dark ? 0.9 : 0.85,
          marginRight: "0.2em",
          userSelect: "none",
        },
        ".cm-livePreviewCheckbox": {
          font: "inherit",
          color: editorTheme.foreground,
          userSelect: "none",
          display: "inline-flex",
          alignItems: "center",
          marginRight: "0.2em",
        },
        ".cm-livePreviewCheckboxInput": {
          transform: "translateY(1px)",
          margin: 0,
        },

        // Match native/WebView markdown block styling (driven by `markdownDecorations`).
        ".cm-blockQuote": {
          borderLeft: `4px solid ${colors.mutedForeground}`,
          opacity: editorTheme.dark ? "0.9" : "0.85",
          paddingLeft: "4px",
        },
        ".cm-codeBlock": {
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: "rgba(100, 100, 100, 0.35)",
          backgroundColor: "rgba(155, 155, 155, 0.1)",
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        },
        ".cm-codeBlock.cm-regionFirstLine, .cm-codeBlock.cm-regionLastLine": {
          borderRadius: "3px",
        },
        ".cm-codeBlock:not(.cm-regionFirstLine)": {
          borderTop: "none",
          borderTopLeftRadius: "0",
          borderTopRightRadius: "0",
        },
        ".cm-codeBlock:not(.cm-regionLastLine)": {
          borderBottom: "none",
          borderBottomLeftRadius: "0",
          borderBottomRightRadius: "0",
        },
        ".cm-inlineCode": {
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: editorTheme.dark ? "rgba(200, 200, 200, 0.5)" : "rgba(100, 100, 100, 0.5)",
          borderRadius: "4px",
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        },
        ".cm-tableHeader, .cm-tableRow, .cm-tableDelimiter": {
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        },
        ".cm-taskMarker": {
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        },
        ".cm-strike": {
          textDecoration: "line-through",
        },
        ".cm-h1": { fontWeight: "bold", fontSize: "1.5em", paddingBottom: "0.2em" },
        ".cm-h2": { fontWeight: "bold", fontSize: "1.4em", paddingBottom: "0.2em" },
        ".cm-h3": { fontWeight: "bold", fontSize: "1.3em", paddingBottom: "0.2em" },
        ".cm-h4": { fontWeight: "bold", fontSize: "1.2em", paddingBottom: "0.2em" },
        ".cm-h5": { fontWeight: "bold", fontSize: "1.1em", paddingBottom: "0.2em" },
        ".cm-h6": { fontWeight: "bold", fontSize: "1.0em", paddingBottom: "0.2em" },
      },
      { dark: editorTheme.dark }
    );

    const joplinLikeMarkdownHighlight = HighlightStyle.define([
      // Basic emphasis
      { tag: tags.strong, fontWeight: "bold" },
      { tag: tags.emphasis, fontStyle: "italic" },
      { tag: tags.link, color: editorTheme.dark ? "#5da8ff" : "#0066cc" },

      // Headings
      { tag: tags.heading1, fontWeight: "bold", fontSize: "1.5em" },
      { tag: tags.heading2, fontWeight: "bold", fontSize: "1.4em" },
      { tag: tags.heading3, fontWeight: "bold", fontSize: "1.3em" },
      { tag: tags.heading4, fontWeight: "bold", fontSize: "1.2em" },
      { tag: tags.heading5, fontWeight: "bold", fontSize: "1.1em" },
      { tag: tags.heading6, fontWeight: "bold", fontSize: "1.0em" },

      // Inline code / code fences
      { tag: tags.monospace, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
      { tag: tags.keyword, color: editorTheme.dark ? "#c792ea" : "#7c3aed" },
      { tag: tags.string, color: editorTheme.dark ? "#c3e88d" : "#15803d" },
      { tag: tags.number, color: editorTheme.dark ? "#f78c6c" : "#b45309" },
      { tag: tags.comment, color: editorTheme.dark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)" },
    ]);

    return [
      history(),
      markdown({ base: gfmMarkdownLanguage, codeLanguages: languages }),
      keymap.of([...defaultKeymap, ...historyKeymap, ...markdownKeymap, indentWithTab]),
      EditorView.lineWrapping,
      themeExt,
      markdownDecorations,
      markdownInlinePreview,
      syntaxHighlighting(joplinLikeMarkdownHighlight),
      // Fallback styles ensure tokens still get colored if our style misses a tag.
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    ];
  }, [colors.mutedForeground, editorTheme]);

  useImperativeHandle(ref, () => ({
    insertText: (text: string, cursorOffset?: number) => {
      const view = cmViewRef.current;
      if (!view) return;
      const sel = view.state.selection.main;
      const from = sel.from;
      const to = sel.to;
      const offset = cursorOffset ?? text.length;

      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + offset },
        scrollIntoView: true,
      });
      view.focus();
      selectionRef.current = { start: from + offset, end: from + offset };
    },

    wrapSelection: (before: string, after: string, cursorOffset?: number) => {
      const view = cmViewRef.current;
      if (!view) return;

      const sel = view.state.selection.main;
      const from = sel.from;
      const to = sel.to;
      const selectedText = view.state.doc.sliceString(from, to);
      const insert = before + selectedText + after;
      const offset =
        typeof cursorOffset === "number" && Number.isFinite(cursorOffset)
          ? cursorOffset
          : selectedText.length
            ? insert.length
            : before.length;

      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + offset },
        scrollIntoView: true,
      });
      view.focus();
      selectionRef.current = { start: from + offset, end: from + offset };
    },

    focus: () => {
      cmViewRef.current?.focus?.();
    },

    getSelection: () => selectionRef.current,
  }));

  return (
    <div
      className={cn("h-screen w-full overflow-hidden flex flex-col min-h-0", className)}
      style={{ backgroundColor: editorTheme.background }}
    >
      <CodeMirror
        value={value}
        height="100%"
        placeholder={placeholder}
        style={{ flex: 1, minHeight: 0 }}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLineGutter: false,
          highlightActiveLine: false,
          syntaxHighlighting: true,
          highlightSpecialChars: true,
          history: true,
          drawSelection: true,
          indentOnInput: true,
          autocompletion: false,
        }}
        extensions={extensions}
        onCreateEditor={(view: any) => {
          cmViewRef.current = view;
          const sel = view.state.selection.main;
          selectionRef.current = { start: sel.from, end: sel.to };
        }}
        onUpdate={(vu: any) => {
          const sel = vu.state.selection.main;
          selectionRef.current = { start: sel.from, end: sel.to };
        }}
        onChange={(nextValue: string) => {
          if (nextValue !== latestValueRef.current) {
            onChangeTextRef.current(nextValue);
          }
        }}
      />
    </div>
  );
});


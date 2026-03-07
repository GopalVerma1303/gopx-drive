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
let ViewPlugin: any;
let Decoration: any;
let getSearchDecorations: ((state: any, query: string, activeIndex: number) => { decorations: any; matches: any[] }) | null = null;
let getMarkdownCodeLanguages:
  | (() => {
    jsSupport: any;
    tsSupport: any;
    codeLanguageSpecs: Array<{ names: string[]; support: any }>;
  })
  | null = null;
let getCodeBlockLinePlugin: (() => any[]) | null = null;

if (typeof document !== "undefined") {
  const cmView = require("@codemirror/view");
  const cmState = require("@codemirror/state");
  const cmCommands = require("@codemirror/commands");
  const cmLangMarkdown = require("@codemirror/lang-markdown");
  const cmLanguage = require("@codemirror/language");
  const cmLangJs = require("@codemirror/lang-javascript");
  const cmLangPython = require("@codemirror/lang-python");
  const cmLangRust = require("@codemirror/lang-rust");
  const cmLangGo = require("@codemirror/lang-go");
  const cmLangPhp = require("@codemirror/lang-php");
  const cmLangJava = require("@codemirror/lang-java");
  const cmLangCpp = require("@codemirror/lang-cpp");
  const cmLangSql = require("@codemirror/lang-sql");
  const cmLangJson = require("@codemirror/lang-json");
  const cmLangHtml = require("@codemirror/lang-html");
  const cmLangXml = require("@codemirror/lang-xml");
  const cmLangCss = require("@codemirror/lang-css");
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
  ViewPlugin = cmView.ViewPlugin;
  Decoration = cmView.Decoration;
  const jsSupport = cmLangJs.javascript();
  const tsSupport = cmLangJs.javascript({ typescript: true });
  const pythonSupport = cmLangPython.python();
  const rustSupport = cmLangRust.rust();
  const goSupport = cmLangGo.go();
  const phpSupport = cmLangPhp.php();
  const javaSupport = cmLangJava.java();
  const cppSupport = cmLangCpp.cpp();
  const sqlSupport = cmLangSql.sql();
  const jsonSupport = cmLangJson.json();
  const htmlSupport = cmLangHtml.html();
  const xmlSupport = cmLangXml.xml();
  const cssSupport = cmLangCss.css();

  const codeLanguageSpecs: Array<{ names: string[]; support: any }> = [
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
      support: goSupport,
      names: ["go", "golang"],
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

  getMarkdownCodeLanguages = () => ({ jsSupport, tsSupport, codeLanguageSpecs });

  // Inline code-block + blockquote wrapper plugin (same logic as code-block-line-plugin.ts) using this module's CodeMirror instances
  const WidgetType = cmView.WidgetType;
  const CODE_BLOCK_NODES = new Set(["FencedCode", "CodeBlock"]);
  const WRAPPER_CLASS = "code-block-wrapper";
  const codeBlockWrapper = BlockWrapper.create({
    tagName: "div",
    attributes: { class: WRAPPER_CLASS },
  });
  const BLOCKQUOTE_WRAPPER_CLASS = "blockquote-wrapper";
  const blockquoteWrapper = BlockWrapper.create({
    tagName: "div",
    attributes: { class: BLOCKQUOTE_WRAPPER_CLASS },
  });
  function getBlockWrappers(state: any) {
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
  const blockWrapperField = StateField.define({
    create(state: any) {
      return getBlockWrappers(state);
    },
    update(value: any, tr: any) {
      if (tr.docChanged) return getBlockWrappers(tr.state);
      return value;
    },
  });



  function getUnderlineDecorations(state: any) {
    const decos: Array<{ from: number, to: number, decoration: any }> = [];
    const text = state.doc.toString();
    const UNDERLINE_REGEX = /__(?=[^ \s])(?:[^]*?[^ \s])?__/g;
    let match;
    while ((match = UNDERLINE_REGEX.exec(text)) !== null) {
      decos.push({
        from: match.index,
        to: match.index + match[0].length,
        decoration: Decoration.mark({ class: "cm-underline" })
      });
    }
    if (decos.length === 0) return Decoration.none;
    return Decoration.set(decos.sort((a, b) => a.from - b.from).map(d => d.decoration.range(d.from, d.to)), true);
  }

  const searchDecoration = Decoration.mark({ class: "cm-search-match" });
  const activeSearchDecoration = Decoration.mark({ class: "cm-search-match-active" });

  getSearchDecorations = (state: any, query: string, activeIndex: number) => {
    if (!query) return { decorations: Decoration.none, matches: [] };
    const decos: any[] = [];
    const matches: Array<{ from: number, to: number }> = [];
    const text = state.doc.toString().toLowerCase();
    const lowerQuery = query.toLowerCase();
    let pos = 0;
    while ((pos = text.indexOf(lowerQuery, pos)) !== -1) {
      const range = { from: pos, to: pos + lowerQuery.length };
      matches.push(range);
      pos += lowerQuery.length;
    }

    matches.forEach((m, i) => {
      decos.push((i === activeIndex ? activeSearchDecoration : searchDecoration).range(m.from, m.to));
    });

    return {
      decorations: Decoration.set(decos, true),
      matches
    };
  };

  const underlinePlugin = StateField.define({
    create(state: any) { return getUnderlineDecorations(state); },
    update(value: any, tr: any) {
      if (tr.docChanged) return getUnderlineDecorations(tr.state);
      return value.map(tr.changes);
    },
    provide: (f: any) => EditorView.decorations.from(f),
  });

  function getMathMarkers(state: any) {
    const text = state.doc.toString();
    const tree = syntaxTree(state);
    const decos: Array<{ from: number, to: number, decoration: any }> = [];
    const deco = Decoration.mark({ class: "cm-math-marker" });

    const maskedChars = text.split("");
    tree.iterate({
      enter: (node: any) => {
        if (node.name === "InlineCode" || node.name === "FencedCode" || node.name === "CodeBlock") {
          for (let i = node.from; i < node.to; i++) {
            maskedChars[i] = "X";
          }
        }
      }
    });
    const maskedText = maskedChars.join("");

    const blockRegex = /\$\$[\s\S]*?\$\$/g;
    let match;
    while ((match = blockRegex.exec(maskedText)) !== null) {
      decos.push({ from: match.index, to: match.index + 2, decoration: deco });
      decos.push({ from: match.index + match[0].length - 2, to: match.index + match[0].length, decoration: deco });
    }

    const obscured = maskedText.replace(blockRegex, (m: string) => "X".repeat(m.length));
    const inlineRegex = /(^|[^$])\$([^$\n]+?)\$(?!$)/g;
    while ((match = inlineRegex.exec(obscured)) !== null) {
      const start = match.index + match[1].length;
      const end = start + 1 + match[2].length;
      decos.push({ from: start, to: start + 1, decoration: deco });
      decos.push({ from: end, to: end + 1, decoration: deco });
    }

    if (decos.length === 0) return Decoration.none;
    return Decoration.set(decos.sort((a, b) => a.from - b.from).map(d => d.decoration.range(d.from, d.to)), true);
  }

  const mathMarkerPlugin = StateField.define({
    create(state: any) { return getMathMarkers(state); },
    update(value: any, tr: any) {
      if (tr.docChanged) return getMathMarkers(tr.state);
      return value;
    },
    provide: (f: any) => EditorView.decorations.from(f),
  });

  function getMarkHighlights(state: any) {
    const text = state.doc.toString();
    const tree = syntaxTree(state);
    const decos: Array<{ from: number, to: number, decoration: any }> = [];
    const deco = Decoration.mark({ class: "cm-highlight" });

    const maskedChars = text.split("");
    tree.iterate({
      enter: (node: any) => {
        if (node.name === "InlineCode" || node.name === "FencedCode" || node.name === "CodeBlock") {
          for (let i = node.from; i < node.to; i++) {
            maskedChars[i] = "X";
          }
        }
      }
    });
    const maskedText = maskedChars.join("");

    const MARK_REGEX = /==([^ \s](?:[^]*?[^ \s])?)==/g;
    let match;
    const markerDeco = Decoration.mark({ class: "cm-math-marker" });
    while ((match = MARK_REGEX.exec(maskedText)) !== null) {
      const start = match.index;
      const content = match[1];
      const end = start + match[0].length;

      // Delimiters
      decos.push({ from: start, to: start + 2, decoration: markerDeco });
      decos.push({ from: end - 2, to: end, decoration: markerDeco });
      // Content
      decos.push({ from: start + 2, to: end - 2, decoration: deco });
    }

    if (decos.length === 0) return Decoration.none;
    return Decoration.set(decos.sort((a, b) => a.from - b.from).map(d => d.decoration.range(d.from, d.to)), true);
  }

  const markHighlightPlugin = StateField.define({
    create(state: any) { return getMarkHighlights(state); },
    update(value: any, tr: any) {
      if (tr.docChanged) return getMarkHighlights(tr.state);
      return value;
    },
    provide: (f: any) => EditorView.decorations.from(f),
  });

  getCodeBlockLinePlugin = () => [
    blockWrapperField,
    EditorView.blockWrappers.of((view: any) => view.state.field(blockWrapperField)),
    underlinePlugin,
    mathMarkerPlugin,
    markHighlightPlugin,
  ];
}

export interface CodeMirrorEditorHandle {
  setSelection: (start: number, end: number) => void;
  focus: () => void;
  /** Insert text at the current selection, optionally positioning the cursor within the inserted text. */
  insertText?: (text: string, cursorOffset?: number) => void;
  /** Wrap the current selection (or insert markers) with `before`/`after`, controlling cursor position. */
  wrapSelection?: (before: string, after: string, cursorOffset?: number) => void;
  /** For web: return the editor container DOM node so parent can check focus (e.g. for keyboard shortcuts). */
  getDomNode?: () => HTMLDivElement | null;
  setSearch?: (query: string, activeIndex: number) => number;
  scrollToMatch?: (query: string, activeIndex: number) => void;
  replace?: (query: string, replacement: string, activeIndex: number) => void;
  replaceAll?: (query: string, replacement: string) => void;
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
  searchQuery?: string;
  currentMatchIndex?: number;
  onSearchMatchCount?: (count: number) => void;
}

export const CodeMirrorWeb = React.forwardRef<CodeMirrorEditorHandle, CodeMirrorWebProps>(
  function CodeMirrorWeb(
    { value, onChangeText, onSelectionChange, placeholder, containerHeight, searchQuery, currentMatchIndex, onSearchMatchCount },
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
    const prevValueRef = useRef(value);
    const onChangeRef = useRef(onChangeText);
    const onSelectionRef = useRef(onSelectionChange);
    onChangeRef.current = onChangeText;
    onSelectionRef.current = onSelectionChange;
    
    const [searchState, setSearchState] = React.useState({ query: "", activeIndex: 0 });
    const searchStateRef = useRef(searchState);
    searchStateRef.current = searchState;

    useEffect(() => {
      if (Platform.OS !== "web" || !EditorView || !Compartment) return;

      const node = containerRef.current;
      if (!node || !(node instanceof HTMLElement)) return;

      const initial = initialValueRef.current;
      const { jsSupport, codeLanguageSpecs } =
        getMarkdownCodeLanguages?.() ?? {
          jsSupport: null,
          tsSupport: null,
          codeLanguageSpecs: [],
        };
      const markdownConfig =
        jsSupport && codeLanguageSpecs.length > 0
          ? {
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
          }
          : undefined;

      const heightCompartment = new Compartment();
      const themeColorsCompartment = new Compartment();
      const highlightCompartment = new Compartment();
      heightThemeCompartmentRef.current = heightCompartment;
      themeColorsCompartmentRef.current = themeColorsCompartment;
      highlightCompartmentRef.current = highlightCompartment;

      const markdownHighlightStyle = HighlightStyle.define(
        getMarkdownHighlightStyleConfig(theme)
      );

      const wrapText = (view: any, before: string, after: string, cursorOffset?: number) => {
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
        { key: "Mod-b", run: (view: any) => wrapText(view, "**", "**", 2) },
        { key: "Mod-i", run: (view: any) => wrapText(view, "*", "*", 1) },
        { key: "Mod-u", run: () => true }, // Prevent native underline
        {
          key: "Mod-k", run: (view: any) => {
            const sel = view.state.selection.main;
            const selectedText = view.state.sliceDoc(sel.from, sel.to);
            if (selectedText.length > 0) {
              const replacement = `[${selectedText}]()`;
              view.dispatch({
                changes: { from: sel.from, to: sel.to, insert: replacement },
                selection: { anchor: sel.from + replacement.length - 1, head: sel.from + replacement.length - 1 },
                scrollIntoView: true,
              });
            } else {
              wrapText(view, "[", "]()", 1);
            }
            return true;
          }
        },
      ];

      const mentionPlugin = ViewPlugin.fromClass(
        class {
          decorations: any;

          constructor(view: any) {
            this.decorations = this.getMentions(view);
          }

          update(update: any) {
            if (update.docChanged || update.viewportChanged) {
              this.decorations = this.getMentions(update.view);
            }
          }

          getMentions(view: any) {
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
          markdown(markdownConfig ?? {}),
          highlightCompartment.of(syntaxHighlighting(markdownHighlightStyle)),
          ...(getCodeBlockLinePlugin?.() ?? []),
          ViewPlugin.fromClass(class {
            decorations: any;
            constructor(view: any) {
              this.decorations = getSearchDecorations?.(view.state, searchStateRef.current.query, searchStateRef.current.activeIndex).decorations || Decoration.none;
            }
            update(update: any) {
              this.decorations = getSearchDecorations?.(update.view.state, searchStateRef.current.query, searchStateRef.current.activeIndex).decorations || Decoration.none;
            }
          }, {
            decorations: (v: any) => v.decorations
          }),
          mentionPlugin,
          history(),
          keymap.of([...customMarkdownKeymap, ...defaultKeymap, indentWithTab]),
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
              ".cm-search-match": {
                backgroundColor: isDark ? "rgba(255, 255, 0, 0.25)" : "rgba(255, 255, 0, 0.4)",
              },
              ".cm-search-match-active": {
                backgroundColor: "#eab308", // yellow-500
                color: "#000",
              },
            })
          ),
          themeColorsCompartment.of(EditorView.theme(getCodeMirrorThemeConfig(theme))),
          EditorView.theme({
            ".cm-scroller": {
              minHeight: 0,
              overflow: "auto",
              overflowY: "scroll",
              height: "100%",
              maxHeight: "100%",
            },
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

    // Reconfigure theme and minimal syntax colors when light/dark theme changes
    useEffect(() => {
      if (Platform.OS !== "web" || !EditorView || !viewRef.current) return;
      const view = viewRef.current;
      const themeComp = themeColorsCompartmentRef.current;
      const highlightComp = highlightCompartmentRef.current;
      if (!themeComp || !highlightComp) return;

      const markdownHighlightStyle = HighlightStyle.define(
        getMarkdownHighlightStyleConfig(theme)
      );
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
    // Only overwrite editor when editor content still matches the previous value we had
    // (i.e. no typing or toolbar action happened in the meantime).
    useEffect(() => {
      if (!viewRef.current || Platform.OS !== "web") return;
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
              ".cm-search-match": {
                backgroundColor: isDark ? "rgba(255, 255, 0, 0.25)" : "rgba(255, 255, 0, 0.4)",
              },
              ".cm-search-match-active": {
                backgroundColor: "#eab308", // yellow-500
                color: "#000",
              },
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
        insertText: (text: string, cursorOffset?: number) => {
          const view = viewRef.current;
          if (!view) return;

          const sel = view.state.selection.main;
          const insert = text ?? "";
          const newPos = sel.from + (typeof cursorOffset === "number" ? cursorOffset : insert.length);

          view.dispatch({
            changes: { from: sel.from, to: sel.to, insert },
            selection: { anchor: newPos, head: newPos },
            scrollIntoView: true,
            userEvent: "input.toolbar",
          });

          // Re-focus after toolbar click
          const dom: any = view.dom;
          if (dom && typeof dom.focus === "function") {
            try {
              dom.focus({ preventScroll: true });
            } catch {
              dom.focus();
            }
          } else {
            view.focus();
          }
        },
        wrapSelection: (before: string, after: string, cursorOffset?: number) => {
          const view = viewRef.current;
          if (!view) return;

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
              userEvent: "input.toolbar",
            });
          } else {
            const replacement = before + after;
            const offset = typeof cursorOffset === "number" ? cursorOffset : before.length;
            const cursorPos = sel.from + offset;
            view.dispatch({
              changes: { from: sel.from, to: sel.to, insert: replacement },
              selection: { anchor: cursorPos, head: cursorPos },
              scrollIntoView: true,
              userEvent: "input.toolbar",
            });
          }

          // Re-focus after toolbar click
          const dom: any = view.dom;
          if (dom && typeof dom.focus === "function") {
            try {
              dom.focus({ preventScroll: true });
            } catch {
              dom.focus();
            }
          } else {
            view.focus();
          }
        },
        focus: () => {
          const view = viewRef.current;
          if (!view) return;

          // Prefer focusing the underlying DOM node with preventScroll so the
          // page doesn't jump when toolbar actions re-focus the editor.
          const dom: any = (view as any).dom;
          if (dom && typeof dom.focus === "function") {
            try {
              dom.focus({ preventScroll: true } as any);
              return;
            } catch {
              // Older browsers may not support the options bag; fall back.
              dom.focus();
              return;
            }
          }

          // Fallback: use CodeMirror's focus, which may scroll the page.
          view.focus();
        },
        getDomNode: () => containerRef.current,
        setSearch: (query: string, activeIndex: number) => {
          const newState = { query: query ?? "", activeIndex: activeIndex ?? 0 };
          setSearchState(newState);
          searchStateRef.current = newState;
          if (viewRef.current) {
            viewRef.current.dispatch({}); // Force decoration update
            const res = getSearchDecorations?.(viewRef.current.state, query ?? "", activeIndex ?? 0);
            return res ? res.matches.length : 0;
          }
          return 0;
        },
        scrollToMatch: (query: string, activeIndex: number) => {
          const view = viewRef.current;
          if (!view || !query) return;
          const res = getSearchDecorations?.(view.state, query, activeIndex);
          const match = res?.matches[activeIndex];
          if (match) {
            view.dispatch({
              selection: { anchor: match.from, head: match.to }
            });

            // Smooth scroll implementation
            requestAnimationFrame(() => {
              const coords = view.coordsAtPos(match.from);
              if (coords) {
                const dom = view.scrollDOM;
                const rect = dom.getBoundingClientRect();
                const top = coords.top - rect.top + dom.scrollTop - (dom.clientHeight / 2);
                dom.scrollTo({
                  top,
                  behavior: 'smooth'
                });
              }
            });
          }
        },
        replace: (query: string, replacement: string, activeIndex: number) => {
          const view = viewRef.current;
          if (!view || !query) return;
          const res = getSearchDecorations?.(view.state, query, activeIndex);
          const match = res?.matches[activeIndex];
          if (match) {
            view.dispatch({
              changes: { from: match.from, to: match.to, insert: replacement },
              selection: { anchor: match.from + replacement.length },
              userEvent: "input.replace",
            });
          }
        },
        replaceAll: (query: string, replacement: string) => {
          const view = viewRef.current;
          if (!view || !query) return;
          
          const changes = [];
          const res = getSearchDecorations?.(view.state, query, 0);
          if (res && res.matches.length > 0) {
            for (const match of res.matches) {
              changes.push({ from: match.from, to: match.to, insert: replacement });
            }
            view.dispatch({
              changes,
              userEvent: "input.replace.all",
            });
          }
        }
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

    const bg = theme.background;
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

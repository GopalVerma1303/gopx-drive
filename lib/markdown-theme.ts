/**
 * Single source of truth for markdown editor and preview styling.
 * Used by preview (web + WebView) and editor (CodeMirrorWeb, CodeMirrorDOM, CodeMirrorWebView)
 * so both modes look identical and respond to light/dark theme.
 */

import {
  MARKDOWN_CODE_FONT_SIZE_EM,
  MARKDOWN_CONTENT_PADDING_PX,
  MARKDOWN_EDITOR_CONTENT_PADDING_PX_WEB,
  MARKDOWN_FONT_FAMILY_BODY,
  MARKDOWN_FONT_FAMILY_CODE,
  MARKDOWN_FONT_SIZE,
  MARKDOWN_HEADING1_EM,
  MARKDOWN_HEADING1_LINE_HEIGHT,
  MARKDOWN_HEADING2_EM,
  MARKDOWN_HEADING2_LINE_HEIGHT,
  MARKDOWN_HEADING3_EM,
  MARKDOWN_HEADING3_LINE_HEIGHT,
  MARKDOWN_HEADING4_EM,
  MARKDOWN_HEADING4_LINE_HEIGHT,
  MARKDOWN_HEADING5_EM,
  MARKDOWN_HEADING5_LINE_HEIGHT,
  MARKDOWN_HEADING6_EM,
  MARKDOWN_HEADING6_LINE_HEIGHT,
  MARKDOWN_LINE_HEIGHT,
  MARKDOWN_LINE_HEIGHT_CSS,
} from "@/lib/markdown-content-layout";
import type { ThemePalette } from "@/lib/use-theme-colors";
import { tags } from "@lezer/highlight";

/** Semantic colors for markdown content – shared by preview and editor. */
export interface MarkdownThemeColors {
  foreground: string;
  background: string;
  muted: string;
  mutedForeground: string;
  ring: string;
  link?: string;
  linkUrl?: string;
  codeBackground?: string;
  blockquoteBorder?: string;
  /** When true, use dark variant for code block syntax highlighting (e.g. GitHub dark). */
  isDark?: boolean;
}

const DEFAULT_LINK = "#0969da";
const DEFAULT_LINK_URL = "#0550ae";
const DEFAULT_CODE_BG = "rgba(128,128,128,0.15)";
const DEFAULT_QUOTE_BORDER = "rgba(128,128,128,0.5)";

/** Build theme colors from app palette (useThemeColors). Pass isDark for code block syntax theme (e.g. GitHub dark). */
export function getMarkdownThemeFromPalette(
  palette: ThemePalette,
  isDark?: boolean
): MarkdownThemeColors {
  return {
    foreground: palette.foreground,
    background: palette.background,
    muted: palette.muted,
    mutedForeground: palette.mutedForeground,
    ring: palette.ring,
    link: palette.link ?? DEFAULT_LINK,
    linkUrl: palette.linkUrl ?? DEFAULT_LINK_URL,
    codeBackground: palette.codeBackground ?? DEFAULT_CODE_BG,
    blockquoteBorder: palette.blockquoteBorder ?? DEFAULT_QUOTE_BORDER,
    isDark,
  };
}

/** Resolve optional theme colors with fallbacks. */
function resolveColors(colors: MarkdownThemeColors) {
  return {
    link: colors.link ?? DEFAULT_LINK,
    linkUrl: colors.linkUrl ?? DEFAULT_LINK_URL,
    codeBg: colors.codeBackground ?? DEFAULT_CODE_BG,
    quoteBorder: colors.blockquoteBorder ?? DEFAULT_QUOTE_BORDER,
  };
}

// ---------------------------------------------------------------------------
// Preview CSS (MarkdownPreviewWeb, MarkdownPreviewWebView, getPreviewFullHtml)
// ---------------------------------------------------------------------------

/** highlight.js GitHub-style theme for code blocks (rehype-highlight). Scoped under .markdown-preview. */
function getHighlightCss(colors: MarkdownThemeColors): string {
  const dark = colors.isDark === true;
  if (dark) {
    return `
.markdown-preview .hljs { display: block; overflow-x: auto; padding: 0.5em; background: transparent; color: #c9d1d9; }
.markdown-preview .hljs-comment, .markdown-preview .hljs-quote { color: #8b949e; }
.markdown-preview .hljs-keyword, .markdown-preview .hljs-selector-tag, .markdown-preview .hljs-addition { color: #ff7b72; }
.markdown-preview .hljs-number, .markdown-preview .hljs-string, .markdown-preview .hljs-meta .hljs-meta-string, .markdown-preview .hljs-literal, .markdown-preview .hljs-doctag, .markdown-preview .hljs-regexp { color: #79c0ff; }
.markdown-preview .hljs-title, .markdown-preview .hljs-section, .markdown-preview .hljs-name, .markdown-preview .hljs-selector-id, .markdown-preview .hljs-selector-class { color: #d2a8ff; }
.markdown-preview .hljs-attribute, .markdown-preview .hljs-attr, .markdown-preview .hljs-variable, .markdown-preview .hljs-template-variable, .markdown-preview .hljs-class .hljs-title, .markdown-preview .hljs-type { color: #ffa657; }
.markdown-preview .hljs-symbol, .markdown-preview .hljs-bullet, .markdown-preview .hljs-subst, .markdown-preview .hljs-meta, .markdown-preview .hljs-meta .hljs-keyword, .markdown-preview .hljs-selector-attr, .markdown-preview .hljs-selector-pseudo, .markdown-preview .hljs-link { color: #79c0ff; }
.markdown-preview .hljs-built_in, .markdown-preview .hljs-deletion { color: #ff7b72; }
.markdown-preview .hljs-formula { background: #161b22; }
.markdown-preview .hljs-emphasis { font-style: italic; }
.markdown-preview .hljs-strong { font-weight: bold; }
`.trim();
  }
  return `
.markdown-preview .hljs { display: block; overflow-x: auto; padding: 0.5em; background: transparent; color: #24292e; }
.markdown-preview .hljs-comment, .markdown-preview .hljs-quote { color: #6a737d; }
.markdown-preview .hljs-keyword, .markdown-preview .hljs-selector-tag, .markdown-preview .hljs-addition { color: #d73a49; }
.markdown-preview .hljs-number, .markdown-preview .hljs-string, .markdown-preview .hljs-meta .hljs-meta-string, .markdown-preview .hljs-literal, .markdown-preview .hljs-doctag, .markdown-preview .hljs-regexp { color: #032f62; }
.markdown-preview .hljs-title, .markdown-preview .hljs-section, .markdown-preview .hljs-name, .markdown-preview .hljs-selector-id, .markdown-preview .hljs-selector-class { color: #6f42c1; }
.markdown-preview .hljs-attribute, .markdown-preview .hljs-attr, .markdown-preview .hljs-variable, .markdown-preview .hljs-template-variable, .markdown-preview .hljs-class .hljs-title, .markdown-preview .hljs-type { color: #e36209; }
.markdown-preview .hljs-symbol, .markdown-preview .hljs-bullet, .markdown-preview .hljs-subst, .markdown-preview .hljs-meta, .markdown-preview .hljs-meta .hljs-keyword, .markdown-preview .hljs-selector-attr, .markdown-preview .hljs-selector-pseudo, .markdown-preview .hljs-link { color: #005cc5; }
.markdown-preview .hljs-built_in, .markdown-preview .hljs-deletion { color: #b31d28; }
.markdown-preview .hljs-formula { background: #f6f8fa; }
.markdown-preview .hljs-emphasis { font-style: italic; }
.markdown-preview .hljs-strong { font-weight: bold; }
`.trim();
}

export function getPreviewCss(colors: MarkdownThemeColors): string {
  const { link, linkUrl, codeBg, quoteBorder } = resolveColors(colors);
  return `
/* Padding on content only so scrollbar can sit at edge of device */
.markdown-preview {
  color: ${colors.foreground};
  font-size: ${MARKDOWN_FONT_SIZE}px;
  line-height: ${MARKDOWN_LINE_HEIGHT}px;
  font-family: ${MARKDOWN_FONT_FAMILY_BODY};
  box-sizing: border-box;
  margin: 0;
  padding: ${MARKDOWN_CONTENT_PADDING_PX.paddingTop}px ${MARKDOWN_CONTENT_PADDING_PX.paddingRight}px ${MARKDOWN_CONTENT_PADDING_PX.paddingBottom}px ${MARKDOWN_CONTENT_PADDING_PX.paddingLeft}px;
  width: 100%;
  min-height: 100%;
}
/* Headings: same sizes and line-heights as editor (shared constants) */
.markdown-preview h1 { font-size: ${MARKDOWN_HEADING1_EM}; font-weight: 700; margin: 0 0 0.5em 0; padding: 0; line-height: ${MARKDOWN_HEADING1_LINE_HEIGHT}; color: ${colors.foreground}; }
.markdown-preview h2 { font-size: ${MARKDOWN_HEADING2_EM}; font-weight: 700; margin: 0 0 0.5em 0; padding: 0; line-height: ${MARKDOWN_HEADING2_LINE_HEIGHT}; color: ${colors.foreground}; }
.markdown-preview h3 { font-size: ${MARKDOWN_HEADING3_EM}; font-weight: 600; margin: 0 0 0.5em 0; padding: 0; line-height: ${MARKDOWN_HEADING3_LINE_HEIGHT}; color: ${colors.foreground}; }
.markdown-preview h4 { font-size: ${MARKDOWN_HEADING4_EM}; font-weight: 600; margin: 0 0 0.5em 0; padding: 0; line-height: ${MARKDOWN_HEADING4_LINE_HEIGHT}; color: ${colors.foreground}; }
.markdown-preview h5 { font-size: ${MARKDOWN_HEADING5_EM}; font-weight: 600; margin: 0 0 0.5em 0; padding: 0; line-height: ${MARKDOWN_HEADING5_LINE_HEIGHT}; color: ${colors.foreground}; }
.markdown-preview h6 { font-size: ${MARKDOWN_HEADING6_EM}; font-weight: 600; margin: 0 0 0.5em 0; padding: 0; line-height: ${MARKDOWN_HEADING6_LINE_HEIGHT}; opacity: 0.9; color: ${colors.foreground}; }
.markdown-preview p { margin: 0 0 0.75em 0; padding: 0; color: ${colors.foreground}; }
.markdown-preview p:last-child { margin-bottom: 0; }
.markdown-preview strong { font-weight: 700; color: ${colors.foreground}; }
.markdown-preview em { font-style: italic; color: ${colors.foreground}; }
/* Inline code: same size as editor (shared constant) */
.markdown-preview code { font-family: ${MARKDOWN_FONT_FAMILY_CODE}; font-size: ${MARKDOWN_CODE_FONT_SIZE_EM}; background: ${codeBg}; padding: 0.12em 0.3em; border-radius: 4px; color: ${colors.foreground}; margin: 0; }
/* Fenced blocks (GFM): syntax highlighting via rehype-highlight (highlight.js); copy button in pre, scroll only on code wrapper */
.markdown-preview pre { position: relative; z-index: 0; background: ${colors.muted}; font-size: ${Math.round(MARKDOWN_FONT_SIZE * 0.875)}px; line-height: 1.45; margin: 0 0 1em 0; padding: 12px 16px; border-radius: 8px; font-family: ${MARKDOWN_FONT_FAMILY_CODE}; border: 1px solid ${colors.ring}; overflow: visible; }
.markdown-preview pre .code-block-scroll { overflow-x: auto; overflow-y: hidden; }
.markdown-preview pre code { padding: 0; margin: 0; font-size: inherit; background: none; }
.markdown-preview pre .code-copy-btn { position: absolute !important; top: 8px !important; right: 8px !important; left: auto !important; bottom: auto !important; width: 24px !important; min-width: 24px !important; max-width: 24px !important; height: 24px !important; margin: 0 !important; padding: 0 !important; border: none !important; border-radius: 0; background: transparent !important; color: ${colors.ring}; cursor: pointer; display: inline-flex !important; flex-shrink: 0; align-items: center; justify-content: center; opacity: 0.85; transition: opacity 0.15s; z-index: 9999 !important; box-sizing: border-box; pointer-events: auto !important; -webkit-tap-highlight-color: transparent !important; tap-highlight-color: transparent; outline: none !important; }
.markdown-preview .code-copy-btn:hover { opacity: 1; }
.markdown-preview .code-copy-btn:active { background: transparent !important; }
.markdown-preview .code-copy-btn.copied { color: ${colors.ring}; }
.markdown-preview .code-copy-btn.copied svg { color: inherit; }
.markdown-preview .code-copy-btn svg { width: 18px; height: 18px; pointer-events: none; flex-shrink: 0; display: block; }
${getHighlightCss(colors)}
/* Blockquote: border at full opacity; text content slightly faded */
.markdown-preview blockquote { border-left: 3px solid ${quoteBorder}; padding-left: 0.5em; margin: 0 0 1em 0; color: ${colors.foreground}; font-style: italic; }
.markdown-preview blockquote > * { opacity: 0.58; }
/* Lists: restore bullets/numbers (Tailwind preflight removes them). Task lists get list-style: none below. */
.markdown-preview ul { margin: 0 0 1em 0; padding-left: 1.5em; list-style-position: outside; list-style-type: disc; }
.markdown-preview ol { margin: 0 0 1em 0; padding-left: 1.5em; list-style-position: outside; list-style-type: decimal; }
.markdown-preview li { margin: 0.25em 0; color: ${colors.foreground}; }
.markdown-preview li > p { margin: 0; }
/* Links: GFM-style, match editor link highlight */
.markdown-preview a { color: ${link}; text-decoration: underline; }
.markdown-preview a:visited { color: ${linkUrl}; }
/* Tables (GFM): match old react-native-markdown-display table styles */
.markdown-preview table { border-collapse: collapse; width: 100%; margin: 16px 0; border: 1px solid ${colors.ring}; border-radius: 0; background: ${colors.background}; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.markdown-preview thead { background: color-mix(in srgb, ${colors.foreground} 10%, transparent); }
.markdown-preview tbody { background: ${colors.muted}; }
.markdown-preview th, .markdown-preview td { border: 1px solid ${colors.ring}; text-align: left; color: ${colors.foreground}; }
.markdown-preview th { padding: 14px 12px; font-weight: 600; font-size: 14px; letter-spacing: 0.3px; background: color-mix(in srgb, ${colors.foreground} 10%, transparent); }
.markdown-preview td { padding: 12px; font-size: 14px; line-height: 20px; }
/* Table alignment from markdown alignment row ( :--- left, :---: center, ---: right ) */
.markdown-preview th[align="left"], .markdown-preview td[align="left"] { text-align: left; }
.markdown-preview th[align="center"], .markdown-preview td[align="center"] { text-align: center; }
.markdown-preview th[align="right"], .markdown-preview td[align="right"] { text-align: right; }
.markdown-preview hr { border: none; height: 1px; background: ${colors.ring}; margin: 1em 0; }
.markdown-preview img { max-width: 100%; height: auto; border-radius: 4px; }
.markdown-preview .preview-placeholder { color: ${colors.mutedForeground}; font-style: italic; margin: 0; padding: 0; }
/* Task lists (GFM): same left padding as bullet lists; bullet is hidden but its space was still reserved – cancel it so checkbox aligns with bullet position */
.markdown-preview ul.contains-task-list { list-style: none; padding-left: 1.5em; }
.markdown-preview li.task-list-item { list-style: none; margin-left: -1em; padding-left: 0; padding-inline-start: 0; margin-inline-start: -1em; display: flex; flex-wrap: wrap; align-items: center; gap: 0.5em; }
.markdown-preview li.task-list-item::marker { content: none; width: 0; display: none; }
/* Keep checkbox and text on same horizontal line; prevent p from forcing a break */
.markdown-preview li.task-list-item > p { margin: 0; flex: 1 1 auto; min-width: 0; }
/* Nested task list: force ul to wrap to next line and preserve indentation */
.markdown-preview li.task-list-item > ul { flex-basis: 100%; width: 100%; min-width: 100%; margin-top: 0.25em; margin-bottom: 0; align-self: flex-start; }
.markdown-preview li.task-list-item .markdown-preview-checkbox-wrapper { display: inline-flex; flex-shrink: 0; margin-right: 0.25em; align-items: center; justify-content: center; height: 16px; }
/* Web-only custom checkbox (matches UI checkbox: green when checked, red when unchecked); click toggles completed/not completed */
.markdown-preview .md-preview-checkbox { appearance: none; margin: 0; font: inherit; line-height: 1; width: 16px; height: 16px; min-width: 16px; min-height: 16px; border-radius: 4px; border: 2px solid #ef4444; background: transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 0; transition: background-color 0.15s, border-color 0.15s; -webkit-tap-highlight-color: transparent; user-select: none; vertical-align: middle; }
.markdown-preview .md-preview-checkbox.checked { border-color: #22c55e; background-color: #22c55e; }
.markdown-preview .md-preview-checkbox svg { width: 12px; height: 12px; color: white; pointer-events: none; }
.markdown-preview input[type="checkbox"] { margin-right: 0.5em; }
`.trim();
}

// ---------------------------------------------------------------------------
// CodeMirror editor (CodeMirrorWeb, CodeMirrorDOM) – highlight + base theme
// ---------------------------------------------------------------------------

/** GitHub-style palette for code-block syntax (editor); matches preview getHighlightCss. */
function getGitHubCodeColors(isDark: boolean) {
  if (isDark) {
    return {
      base: "#c9d1d9",
      comment: "#8b949e",
      keyword: "#ff7b72",
      string: "#79c0ff",
      number: "#79c0ff",
      name: "#d2a8ff",
      typeName: "#d2a8ff",
      propertyName: "#ffa657",
      variableName: "#c9d1d9",
      operator: "#c9d1d9",
      meta: "#79c0ff",
      punctuation: "#c9d1d9",
      invalid: "#ff7b72",
    };
  }
  return {
    base: "#24292e",
    comment: "#6a737d",
    keyword: "#d73a49",
    string: "#032f62",
    number: "#032f62",
    name: "#6f42c1",
    typeName: "#6f42c1",
    propertyName: "#e36209",
    variableName: "#24292e",
    operator: "#24292e",
    meta: "#005cc5",
    punctuation: "#24292e",
    invalid: "#b31d28",
  };
}

/** Config array for HighlightStyle.define([...]) – markdown + GitHub-style for code blocks (same as preview). */
export function getMarkdownHighlightStyleConfig(colors: MarkdownThemeColors) {
  const { link, linkUrl, codeBg, quoteBorder } = resolveColors(colors);
  const code = getGitHubCodeColors(colors.isDark === true);
  return [
    // Markdown – font-size and line-height match preview (shared constants)
    { tag: tags.heading1, fontWeight: "700", fontSize: MARKDOWN_HEADING1_EM, lineHeight: MARKDOWN_HEADING1_LINE_HEIGHT },
    { tag: tags.heading2, fontWeight: "700", fontSize: MARKDOWN_HEADING2_EM, lineHeight: MARKDOWN_HEADING2_LINE_HEIGHT },
    { tag: tags.heading3, fontWeight: "600", fontSize: MARKDOWN_HEADING3_EM, lineHeight: MARKDOWN_HEADING3_LINE_HEIGHT },
    { tag: tags.heading4, fontWeight: "600", fontSize: MARKDOWN_HEADING4_EM, lineHeight: MARKDOWN_HEADING4_LINE_HEIGHT },
    { tag: tags.heading5, fontWeight: "600", fontSize: MARKDOWN_HEADING5_EM, lineHeight: MARKDOWN_HEADING5_LINE_HEIGHT },
    { tag: tags.heading6, fontWeight: "600", fontSize: MARKDOWN_HEADING6_EM, lineHeight: MARKDOWN_HEADING6_LINE_HEIGHT, opacity: "0.9" },
    { tag: tags.strong, fontWeight: "700" },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.link, color: link, textDecoration: "underline" },
    { tag: tags.url, color: linkUrl },
    {
      tag: tags.monospace,
      fontFamily: MARKDOWN_FONT_FAMILY_CODE,
      fontSize: MARKDOWN_CODE_FONT_SIZE_EM,
      backgroundColor: codeBg,
      padding: "0.12em 0.3em",
      borderRadius: "4px",
    },
    /* Quote: no per-line border here; single block border is applied via theme; text opacity on .blockquote-wrapper .cm-line */
    {
      tag: tags.quote,
      paddingLeft: "0.5em",
      fontStyle: "italic",
    },
    { tag: tags.list, opacity: "0.95" },
    { tag: tags.contentSeparator, opacity: "0.6" },
    { tag: tags.processingInstruction, opacity: "0.65" },
    { tag: tags.comment, opacity: "0.6", fontStyle: "italic" },
    // Code block content (GitHub-style – same as preview)
    { tag: tags.lineComment, color: code.comment },
    { tag: tags.blockComment, color: code.comment },
    { tag: tags.docComment, color: code.comment },
    { tag: tags.keyword, color: code.keyword },
    { tag: tags.controlKeyword, color: code.keyword },
    { tag: tags.definitionKeyword, color: code.keyword },
    { tag: tags.moduleKeyword, color: code.keyword },
    { tag: tags.operatorKeyword, color: code.keyword },
    { tag: tags.string, color: code.string },
    { tag: tags.docString, color: code.string },
    { tag: tags.character, color: code.string },
    { tag: tags.number, color: code.number },
    { tag: tags.integer, color: code.number },
    { tag: tags.float, color: code.number },
    { tag: tags.literal, color: code.string },
    { tag: tags.regexp, color: code.string },
    { tag: tags.bool, color: code.keyword },
    { tag: tags.name, color: code.name },
    { tag: tags.typeName, color: code.typeName },
    { tag: tags.tagName, color: code.typeName },
    { tag: tags.propertyName, color: code.propertyName },
    { tag: tags.attributeName, color: code.propertyName },
    { tag: tags.variableName, color: code.variableName },
    { tag: tags.labelName, color: code.name },
    { tag: tags.className, color: code.typeName },
    { tag: tags.namespace, color: code.typeName },
    { tag: tags.operator, color: code.operator },
    { tag: tags.punctuation, color: code.punctuation },
    { tag: tags.bracket, color: code.punctuation },
    { tag: tags.meta, color: code.meta },
    { tag: tags.invalid, color: code.invalid },
  ];
}

/** Options for getCodeMirrorThemeConfig. When contentPadding is false (e.g. native), padding is on the container instead of .cm-content. */
export interface CodeMirrorThemeOptions {
  /** If false, .cm-content has no padding (container provides it, e.g. native). Default true for web so scrollbar is at edge. */
  contentPadding?: boolean;
}

/** Theme object for EditorView.theme({...}) – base editor colors and typography. */
export function getCodeMirrorThemeConfig(
  colors: MarkdownThemeColors,
  options?: CodeMirrorThemeOptions
): Record<string, Record<string, string>> {
  const contentPadding = options?.contentPadding !== false;
  const bg = colors.muted ?? colors.background;
  const fg = colors.foreground;
  const codeBg = colors.codeBackground ?? DEFAULT_CODE_BG;
  const quoteBorder = colors.blockquoteBorder ?? DEFAULT_QUOTE_BORDER;
  return {
    "&.cm-editor": {
      backgroundColor: bg,
      color: fg,
      fontSize: `${MARKDOWN_FONT_SIZE}px`,
      fontFamily: MARKDOWN_FONT_FAMILY_BODY,
      minHeight: "0",
    },
    "&.cm-editor.cm-focused": {
      outline: "none",
    },
    ".cm-content": {
      padding: contentPadding
        ? `${MARKDOWN_EDITOR_CONTENT_PADDING_PX_WEB.paddingTop}px ${MARKDOWN_EDITOR_CONTENT_PADDING_PX_WEB.paddingRight}px ${MARKDOWN_EDITOR_CONTENT_PADDING_PX_WEB.paddingBottom}px ${MARKDOWN_EDITOR_CONTENT_PADDING_PX_WEB.paddingLeft}px`
        : "0",
      color: fg,
      caretColor: fg,
    },
    ".cm-line": {
      lineHeight: MARKDOWN_LINE_HEIGHT_CSS,
    },
    /* Cursor (caret) – theme responsive; override CodeMirror default (1.2px solid black) */
    ".cm-cursor": {
      borderLeft: `1.2px solid ${fg}`,
    },
    "&.cm-focused > .cm-scroller > .cm-cursorLayer .cm-cursor": {
      borderLeftColor: fg,
    },
    /* Code block: match preview – no fill, same border (ring), same size. Inline code keeps .cm-monospace pill style. */
    ".code-block-wrapper": {
      backgroundColor: "transparent",
      padding: "12px 16px",
      marginTop: "0",
      marginBottom: "1em",
      border: `1px solid ${colors.ring}`,
      borderRadius: "8px",
      overflow: "auto",
      fontSize: `${Math.round(MARKDOWN_FONT_SIZE * 0.875)}px`,
      lineHeight: "1.45",
      fontFamily: MARKDOWN_FONT_FAMILY_CODE,
    },
    ".code-block-wrapper .cm-monospace": {
      padding: "0",
      borderRadius: "0",
      backgroundColor: "transparent",
    },
    /* Blockquote: border at full opacity; text content slightly faded */
    ".blockquote-wrapper": {
      borderLeft: `3px solid ${quoteBorder}`,
      paddingLeft: "0.5em",
      marginBottom: "1em",
      fontStyle: "italic",
    },
    ".blockquote-wrapper .cm-line": {
      opacity: "0.58",
    },
    ".blockquote-wrapper .cm-quote": {
      borderLeft: "none",
    },
  };
}

// ---------------------------------------------------------------------------
// CodeMirror WebView (native) – injected CSS string
// ---------------------------------------------------------------------------

export function getCodeMirrorWebViewInjectCss(colors: MarkdownThemeColors): string {
  const bg = colors.muted ?? colors.background;
  const fg = colors.foreground;
  const { link, codeBg, quoteBorder } = resolveColors(colors);
  const ring = colors.ring;
  const codeBlockFontSize = Math.round(MARKDOWN_FONT_SIZE * 0.875);
  return (
    `body, #codemirror-root, .cm-editor, .cm-scroller { background: ${bg} !important; } ` +
    `.cm-content, .cm-line { color: ${fg} !important; caret-color: ${fg} !important; } ` +
    `.cm-cursor, .cm-cursorLayer .cm-cursor { border-left: 1.2px solid ${fg} !important; border-left-color: ${fg} !important; } ` +
    `.cm-scroller { -webkit-overflow-scrolling: touch !important; overflow-y: scroll !important; height: 100% !important; max-height: 100% !important; touch-action: pan-y !important; } ` +
    `.cm-url, .cm-link { color: ${link} !important; } ` +
    `.cm-monospace { background: ${codeBg} !important; } ` +
    `.code-block-wrapper { background: transparent !important; padding: 12px 16px !important; margin-bottom: 1em !important; border: 1px solid ${ring} !important; border-radius: 8px !important; overflow: auto !important; font-size: ${codeBlockFontSize}px !important; line-height: 1.45 !important; font-family: ${MARKDOWN_FONT_FAMILY_CODE} !important; } ` +
    `.code-block-wrapper .cm-monospace { padding: 0 !important; border-radius: 0 !important; background: transparent !important; } ` +
    `.blockquote-wrapper { border-left: 3px solid ${quoteBorder} !important; padding-left: 0.5em !important; margin-bottom: 1em !important; font-style: italic !important; } ` +
    `.blockquote-wrapper .cm-line { opacity: 0.58 !important; } ` +
    `.blockquote-wrapper .cm-quote { border-left: none !important; } `
  );
}

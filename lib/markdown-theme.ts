/**
 * Single source of truth for markdown editor and preview styling.
 * Used by preview (web + WebView) and editor (CodeMirrorWeb, CodeMirrorDOM, CodeMirrorWebView)
 * so both modes look identical and respond to light/dark theme.
 */

import {
  MARKDOWN_CODE_FONT_SIZE_EM,
  MARKDOWN_CONTENT_PADDING_PX,
  MARKDOWN_FONT_FAMILY_BODY,
  MARKDOWN_FONT_FAMILY_CODE,
  MARKDOWN_FONT_SIZE,
  MARKDOWN_HEADING1_EM,
  MARKDOWN_HEADING2_EM,
  MARKDOWN_HEADING3_EM,
  MARKDOWN_HEADING4_EM,
  MARKDOWN_HEADING5_EM,
  MARKDOWN_HEADING6_EM,
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
  /** When true, use dark variant for code block syntax highlighting (e.g. Solarized dark). */
  isDark?: boolean;
}

const DEFAULT_LINK = "#0969da";
const DEFAULT_LINK_URL = "#0550ae";
const DEFAULT_CODE_BG = "rgba(128,128,128,0.15)";
const DEFAULT_QUOTE_BORDER = "rgba(128,128,128,0.5)";

/** Build theme colors from app palette (useThemeColors). Pass isDark for code block syntax theme (e.g. Solarized). */
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

/** highlight.js Solarized light/dark theme for code blocks (rehype-highlight). Scoped under .markdown-preview. */
function getHighlightCss(colors: MarkdownThemeColors): string {
  const dark = colors.isDark === true;
  if (dark) {
    return `
.markdown-preview .hljs { display: block; overflow-x: auto; padding: 0.5em; background: transparent; color: #839496; }
.markdown-preview .hljs-comment, .markdown-preview .hljs-quote { color: #586e75; }
.markdown-preview .hljs-keyword, .markdown-preview .hljs-selector-tag, .markdown-preview .hljs-addition { color: #859900; }
.markdown-preview .hljs-number, .markdown-preview .hljs-string, .markdown-preview .hljs-meta .hljs-meta-string, .markdown-preview .hljs-literal, .markdown-preview .hljs-doctag, .markdown-preview .hljs-regexp { color: #2aa198; }
.markdown-preview .hljs-title, .markdown-preview .hljs-section, .markdown-preview .hljs-name, .markdown-preview .hljs-selector-id, .markdown-preview .hljs-selector-class { color: #268bd2; }
.markdown-preview .hljs-attribute, .markdown-preview .hljs-attr, .markdown-preview .hljs-variable, .markdown-preview .hljs-template-variable, .markdown-preview .hljs-class .hljs-title, .markdown-preview .hljs-type { color: #b58900; }
.markdown-preview .hljs-symbol, .markdown-preview .hljs-bullet, .markdown-preview .hljs-subst, .markdown-preview .hljs-meta, .markdown-preview .hljs-meta .hljs-keyword, .markdown-preview .hljs-selector-attr, .markdown-preview .hljs-selector-pseudo, .markdown-preview .hljs-link { color: #cb4b16; }
.markdown-preview .hljs-built_in, .markdown-preview .hljs-deletion { color: #dc322f; }
.markdown-preview .hljs-formula { background: #073642; }
.markdown-preview .hljs-emphasis { font-style: italic; }
.markdown-preview .hljs-strong { font-weight: bold; }
`.trim();
  }
  return `
.markdown-preview .hljs { display: block; overflow-x: auto; padding: 0.5em; background: transparent; color: #657b83; }
.markdown-preview .hljs-comment, .markdown-preview .hljs-quote { color: #93a1a1; }
.markdown-preview .hljs-keyword, .markdown-preview .hljs-selector-tag, .markdown-preview .hljs-addition { color: #859900; }
.markdown-preview .hljs-number, .markdown-preview .hljs-string, .markdown-preview .hljs-meta .hljs-meta-string, .markdown-preview .hljs-literal, .markdown-preview .hljs-doctag, .markdown-preview .hljs-regexp { color: #2aa198; }
.markdown-preview .hljs-title, .markdown-preview .hljs-section, .markdown-preview .hljs-name, .markdown-preview .hljs-selector-id, .markdown-preview .hljs-selector-class { color: #268bd2; }
.markdown-preview .hljs-attribute, .markdown-preview .hljs-attr, .markdown-preview .hljs-variable, .markdown-preview .hljs-template-variable, .markdown-preview .hljs-class .hljs-title, .markdown-preview .hljs-type { color: #b58900; }
.markdown-preview .hljs-symbol, .markdown-preview .hljs-bullet, .markdown-preview .hljs-subst, .markdown-preview .hljs-meta, .markdown-preview .hljs-meta .hljs-keyword, .markdown-preview .hljs-selector-attr, .markdown-preview .hljs-selector-pseudo, .markdown-preview .hljs-link { color: #cb4b16; }
.markdown-preview .hljs-built_in, .markdown-preview .hljs-deletion { color: #dc322f; }
.markdown-preview .hljs-formula { background: #eee8d5; }
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
/* Headings: same sizes as editor (shared constants) */
.markdown-preview h1 { font-size: ${MARKDOWN_HEADING1_EM}; font-weight: 700; margin: 0 0 0.5em 0; padding: 0; line-height: 1.3; color: ${colors.foreground}; }
.markdown-preview h2 { font-size: ${MARKDOWN_HEADING2_EM}; font-weight: 700; margin: 0 0 0.5em 0; padding: 0; line-height: 1.35; color: ${colors.foreground}; }
.markdown-preview h3 { font-size: ${MARKDOWN_HEADING3_EM}; font-weight: 600; margin: 0 0 0.5em 0; padding: 0; line-height: 1.4; color: ${colors.foreground}; }
.markdown-preview h4 { font-size: ${MARKDOWN_HEADING4_EM}; font-weight: 600; margin: 0 0 0.5em 0; padding: 0; line-height: 1.4; color: ${colors.foreground}; }
.markdown-preview h5 { font-size: ${MARKDOWN_HEADING5_EM}; font-weight: 600; margin: 0 0 0.5em 0; padding: 0; line-height: 1.4; color: ${colors.foreground}; }
.markdown-preview h6 { font-size: ${MARKDOWN_HEADING6_EM}; font-weight: 600; margin: 0 0 0.5em 0; padding: 0; line-height: 1.4; opacity: 0.9; color: ${colors.foreground}; }
.markdown-preview p { margin: 0 0 0.75em 0; padding: 0; color: ${colors.foreground}; }
.markdown-preview p:last-child { margin-bottom: 0; }
.markdown-preview strong { font-weight: 700; color: ${colors.foreground}; }
.markdown-preview em { font-style: italic; color: ${colors.foreground}; }
/* Inline code: same size as editor (shared constant) */
.markdown-preview code { font-family: ${MARKDOWN_FONT_FAMILY_CODE}; font-size: ${MARKDOWN_CODE_FONT_SIZE_EM}; background: ${codeBg}; padding: 0.12em 0.3em; border-radius: 4px; color: ${colors.foreground}; margin: 0; }
/* Fenced blocks (GFM): syntax highlighting via rehype-highlight (highlight.js) */
.markdown-preview pre { background: ${colors.muted}; font-size: ${Math.round(MARKDOWN_FONT_SIZE * 0.875)}px; line-height: 1.45; margin: 0 0 1em 0; padding: 12px 16px; border-radius: 8px; font-family: ${MARKDOWN_FONT_FAMILY_CODE}; border: 1px solid ${colors.ring}; overflow-x: auto; }
.markdown-preview pre code { padding: 0; margin: 0; font-size: inherit; background: none; }
${getHighlightCss(colors)}
/* Blockquote: match editor quote highlight */
.markdown-preview blockquote { opacity: 0.85; border-left: 3px solid ${quoteBorder}; padding-left: 0.5em; margin: 0 0 1em 0; color: ${colors.foreground}; }
.markdown-preview ul, .markdown-preview ol { margin: 0 0 1em 0; padding-left: 1.5em; list-style-position: outside; }
.markdown-preview li { margin: 0.25em 0; color: ${colors.foreground}; }
.markdown-preview li > p { margin: 0; }
/* Links: GFM-style, match editor link highlight */
.markdown-preview a { color: ${link}; text-decoration: underline; }
.markdown-preview a:visited { color: ${linkUrl}; }
/* Tables (GFM) */
.markdown-preview table { border-collapse: collapse; width: 100%; margin: 0 0 1em 0; border: 1px solid ${colors.ring}; border-radius: 6px; background: ${colors.background}; overflow: hidden; }
.markdown-preview th, .markdown-preview td { border: 1px solid ${colors.ring}; padding: 8px 12px; text-align: left; color: ${colors.foreground}; }
.markdown-preview th { font-weight: 600; font-size: ${Math.round(MARKDOWN_FONT_SIZE * 0.875)}px; background: ${colors.muted}; }
.markdown-preview td { font-size: ${Math.round(MARKDOWN_FONT_SIZE * 0.875)}px; line-height: 1.4; }
.markdown-preview hr { border: none; height: 1px; background: ${colors.ring}; margin: 1em 0; }
.markdown-preview img { max-width: 100%; height: auto; border-radius: 4px; }
.markdown-preview .preview-placeholder { color: ${colors.mutedForeground}; font-style: italic; margin: 0; padding: 0; }
/* Task lists (GFM) */
.markdown-preview input[type="checkbox"] { margin-right: 0.5em; }
`.trim();
}

// ---------------------------------------------------------------------------
// CodeMirror editor (CodeMirrorWeb, CodeMirrorDOM) – highlight + base theme
// ---------------------------------------------------------------------------

/** Solarized palette for code-block syntax (editor); matches preview getHighlightCss. */
function getSolarizedCodeColors(isDark: boolean) {
  if (isDark) {
    return {
      base: "#839496",
      comment: "#586e75",
      keyword: "#859900",
      string: "#2aa198",
      number: "#2aa198",
      name: "#268bd2",
      typeName: "#268bd2",
      propertyName: "#b58900",
      variableName: "#839496",
      operator: "#839496",
      meta: "#cb4b16",
      punctuation: "#839496",
      invalid: "#dc322f",
    };
  }
  return {
    base: "#657b83",
    comment: "#93a1a1",
    keyword: "#859900",
    string: "#2aa198",
    number: "#2aa198",
    name: "#268bd2",
    typeName: "#268bd2",
    propertyName: "#b58900",
    variableName: "#657b83",
    operator: "#657b83",
    meta: "#cb4b16",
    punctuation: "#657b83",
    invalid: "#dc322f",
  };
}

/** Config array for HighlightStyle.define([...]) – markdown + Solarized for code blocks (same as preview). */
export function getMarkdownHighlightStyleConfig(colors: MarkdownThemeColors) {
  const { link, linkUrl, codeBg, quoteBorder } = resolveColors(colors);
  const solarized = getSolarizedCodeColors(colors.isDark === true);
  return [
    // Markdown
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
    {
      tag: tags.monospace,
      fontFamily: MARKDOWN_FONT_FAMILY_CODE,
      fontSize: MARKDOWN_CODE_FONT_SIZE_EM,
      backgroundColor: codeBg,
      padding: "0.12em 0.3em",
      borderRadius: "4px",
    },
    {
      tag: tags.quote,
      opacity: "0.85",
      borderLeft: `3px solid ${quoteBorder}`,
      paddingLeft: "0.5em",
    },
    { tag: tags.list, opacity: "0.95" },
    { tag: tags.contentSeparator, opacity: "0.6" },
    { tag: tags.processingInstruction, opacity: "0.65" },
    { tag: tags.comment, opacity: "0.6", fontStyle: "italic" },
    // Code block content (Solarized – same as preview)
    { tag: tags.lineComment, color: solarized.comment },
    { tag: tags.blockComment, color: solarized.comment },
    { tag: tags.docComment, color: solarized.comment },
    { tag: tags.keyword, color: solarized.keyword },
    { tag: tags.controlKeyword, color: solarized.keyword },
    { tag: tags.definitionKeyword, color: solarized.keyword },
    { tag: tags.moduleKeyword, color: solarized.keyword },
    { tag: tags.operatorKeyword, color: solarized.keyword },
    { tag: tags.string, color: solarized.string },
    { tag: tags.docString, color: solarized.string },
    { tag: tags.character, color: solarized.string },
    { tag: tags.number, color: solarized.number },
    { tag: tags.integer, color: solarized.number },
    { tag: tags.float, color: solarized.number },
    { tag: tags.literal, color: solarized.string },
    { tag: tags.regexp, color: solarized.string },
    { tag: tags.bool, color: solarized.keyword },
    { tag: tags.name, color: solarized.name },
    { tag: tags.typeName, color: solarized.typeName },
    { tag: tags.tagName, color: solarized.typeName },
    { tag: tags.propertyName, color: solarized.propertyName },
    { tag: tags.attributeName, color: solarized.propertyName },
    { tag: tags.variableName, color: solarized.variableName },
    { tag: tags.labelName, color: solarized.name },
    { tag: tags.className, color: solarized.typeName },
    { tag: tags.namespace, color: solarized.typeName },
    { tag: tags.operator, color: solarized.operator },
    { tag: tags.punctuation, color: solarized.punctuation },
    { tag: tags.bracket, color: solarized.punctuation },
    { tag: tags.meta, color: solarized.meta },
    { tag: tags.invalid, color: solarized.invalid },
  ];
}

/** Theme object for EditorView.theme({...}) – base editor colors and typography. */
export function getCodeMirrorThemeConfig(colors: MarkdownThemeColors): Record<string, Record<string, string>> {
  const bg = colors.muted ?? colors.background;
  const fg = colors.foreground;
  const codeBg = colors.codeBackground ?? DEFAULT_CODE_BG;
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
      padding: "0",
      paddingBottom: `${MARKDOWN_CONTENT_PADDING_PX.paddingBottom}px`,
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
    `.cm-quote { border-left-color: ${quoteBorder} !important; }`
  );
}

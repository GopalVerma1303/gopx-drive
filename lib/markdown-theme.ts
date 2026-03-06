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
    /** The color for @tags like @dinner */
    mentionTag?: string;
    /** When true, use dark variant for code block syntax highlighting (e.g. GitHub dark). */
    isDark?: boolean;
}

const DEFAULT_LINK = "#0969da";
const DEFAULT_LINK_URL = "#0550ae";
const DEFAULT_CODE_BG = "rgba(128,128,128,0.15)";
const DEFAULT_QUOTE_BORDER = "rgba(128,128,128,0.5)";
const DEFAULT_MENTION_TAG_LIGHT = "#ca8a04"; // yellow-600
const DEFAULT_MENTION_TAG_DARK = "#facc15"; // yellow-400

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
        mentionTag: isDark ? DEFAULT_MENTION_TAG_DARK : DEFAULT_MENTION_TAG_LIGHT,
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

/** Convert hex (#rgb or #rrggbb) to rgba with given alpha. Matches global.css scrollbar opacity. */
function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace(/^#/, "").match(/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return hex;
  let r: number, g: number, b: number;
  if (m[1].length === 3) {
    r = parseInt(m[1][0] + m[1][0], 16);
    g = parseInt(m[1][1] + m[1][1], 16);
    b = parseInt(m[1][2] + m[1][2], 16);
  } else {
    r = parseInt(m[1].slice(0, 2), 16);
    g = parseInt(m[1].slice(2, 4), 16);
    b = parseInt(m[1].slice(4, 6), 16);
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Scrollbar CSS matching global.css (theme-responsive thumb/track). scopeSelector defaults to * for full document. */
export function getScrollbarCss(
  colors: { muted: string; mutedForeground: string },
  scopeSelector = "*"
): string {
  const thumb = hexToRgba(colors.mutedForeground, 0.45);
  const thumbHover = hexToRgba(colors.mutedForeground, 0.6);
  const track = hexToRgba(colors.muted, 0.6);
  return (
    `${scopeSelector} { scrollbar-width: thin; scrollbar-color: ${thumb} ${track}; } ` +
    `${scopeSelector}::-webkit-scrollbar { width: 8px; height: 8px; } ` +
    `${scopeSelector}::-webkit-scrollbar-track { background: ${track}; } ` +
    `${scopeSelector}::-webkit-scrollbar-thumb { background: ${thumb}; border-radius: 4px; } ` +
    `${scopeSelector}::-webkit-scrollbar-thumb:hover { background: ${thumbHover}; } `
  );
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
  const codeBlockBg = hexToRgba(colors.background, colors.isDark ? 0.22 : 0.06);
  return `
/* Padding on content only so scrollbar can sit at edge of device */
/* Long URLs and unbreakable strings: wrap so content stays visible (no horizontal cut-off). */
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
  overflow-x: hidden;
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-word;
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
/* Inline code: same size as editor (shared constant). Use pink text, no background. */
      .markdown-preview code {
      font-family: ${MARKDOWN_FONT_FAMILY_CODE};
      font-size: ${MARKDOWN_CODE_FONT_SIZE_EM};
      background: none;
      padding: 0.12em 0.3em;
      border-radius: 4px;
      color: #ec4899;
      margin: 0;
    }
/* Fenced blocks (GFM): syntax highlighting via rehype-highlight (highlight.js); copy button pinned to the top-right of the block,
   while only the inner code wrapper scrolls horizontally. Reset color for code inside pre so only inline code is pink. */
.markdown-preview pre { position: relative; z-index: 0; background: ${codeBlockBg}; font-size: ${Math.round(MARKDOWN_FONT_SIZE * 0.875)}px; line-height: 1.45; margin: 0 0 1em 0; padding: 12px 16px; border-radius: 8px; font-family: ${MARKDOWN_FONT_FAMILY_CODE}; border: 1px solid ${colors.ring}; overflow: hidden; width: 100%; box-sizing: border-box; }
.markdown-preview pre .code-block-scroll { display: block; overflow-x: auto; overflow-y: hidden; width: 100%; -webkit-overflow-scrolling: touch; box-sizing: border-box; }
.markdown-preview pre code { padding: 0; margin: 0; font-size: inherit; background: none; color: ${colors.foreground}; }
.markdown-preview pre .code-copy-btn { position: absolute !important; top: 8px !important; right: 8px !important; left: auto !important; bottom: auto !important; width: 24px !important; min-width: 24px !important; max-width: 24px !important; height: 24px !important; margin: 0 !important; padding: 0 !important; border: none !important; border-radius: 0; background: transparent !important; color: ${colors.ring}; cursor: pointer; display: inline-flex !important; flex-shrink: 0; align-items: center; justify-content: center; opacity: 0.85; transition: opacity 0.15s; z-index: 2 !important; box-sizing: border-box; pointer-events: auto !important; -webkit-tap-highlight-color: transparent !important; tap-highlight-color: transparent; outline: none !important; }
.markdown-preview .code-copy-btn:hover { opacity: 1; }
.markdown-preview .code-copy-btn:active { background: transparent !important; }
.markdown-preview .code-copy-btn.copied { color: ${colors.ring}; }
.markdown-preview .code-copy-btn.copied svg { color: inherit; }
.markdown-preview .code-copy-btn svg { width: 18px; height: 18px; pointer-events: none; flex-shrink: 0; display: block; }
/* Mermaid diagrams: wrapped in a block container similar to fenced code blocks, with a small control toolbar. */
.markdown-preview .mermaid-block {
  position: relative;
  z-index: 0;
  background: ${codeBlockBg};
  margin: 0 0 1.5em 0;
  padding: 20px 24px 24px 24px;
  border-radius: 8px;
  border: 1px solid ${colors.ring};
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
  min-height: 340px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.markdown-preview .mermaid-block .mermaid-controls {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: grid;
  grid-template-columns: repeat(3, 30px);
  grid-template-rows: repeat(3, 30px);
  grid-template-areas:
    ".    up      zoomIn"
    "left reset   right"
    ".    down    zoomOut";
  gap: 4px;
  z-index: 2;
}
.markdown-preview .mermaid-block .mermaid-copy-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid ${colors.ring};
  background: ${colors.background};
  color: ${colors.foreground};
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 2px rgba(0,0,0,0.25);
  -webkit-tap-highlight-color: transparent;
  outline: none;
}
.markdown-preview .mention-tag {
  color: ${colors.mentionTag ?? (colors.isDark ? "#facc15" : "#ca8a04")};
}
.markdown-preview .mermaid-block .mermaid-copy-btn svg {
  width: 16px;
  height: 16px;
  display: block;
}
.markdown-preview .mermaid-block .mermaid-controls button {
  font-size: 11px;
  line-height: 1;
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid ${colors.ring};
  background: ${colors.background};
  color: ${colors.foreground};
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 2px rgba(0,0,0,0.25);
  -webkit-tap-highlight-color: transparent;
  outline: none;
}
.markdown-preview .mermaid-block .mermaid-controls button:hover {
  background: ${colors.background};
  border-color: ${colors.ring};
}
.markdown-preview .mermaid-block .mermaid-controls button svg {
  width: 16px;
  height: 16px;
  display: block;
}
.markdown-preview .mermaid-block .mermaid {
  display: inline-block;
  transition: transform 0.18s ease-out;
}
.markdown-preview .mermaid-block .mermaid svg {
  max-width: 100%;
  height: auto;
  transform-origin: center center;
}
${getHighlightCss(colors)}
/* Blockquote: border + soft padding; slightly faded inner text (match editor) */
.markdown-preview blockquote {
  border-left: 3px solid ${quoteBorder};
  padding-left: 0.75em;
  margin: 1em 0 1em 0;
  color: ${colors.foreground};
  font-style: italic;
  white-space: normal;
  overflow-wrap: break-word;
  word-break: break-word;
}
.markdown-preview blockquote > * { opacity: 0.7; }
/* Lists: restore bullets/numbers (Tailwind preflight removes them). Task lists get list-style: none below. */
.markdown-preview ul { margin: 0 0 1em 0; padding-left: 1.5em; list-style-position: outside; list-style-type: disc; }
.markdown-preview ol { margin: 0 0 1em 0; padding-left: 1.5em; list-style-position: outside; list-style-type: decimal; }
.markdown-preview li { margin: 0.25em 0; color: ${colors.foreground}; }
.markdown-preview li > p { margin: 0; }
/* Links: GFM-style, match editor link highlight. Allow long URLs to wrap so they don't cut off. */
.markdown-preview a { color: ${link}; text-decoration: underline; overflow-wrap: break-word; word-wrap: break-word; word-break: break-word; }
.markdown-preview a:visited { color: ${linkUrl}; }
      /* Tables (GFM): match old react-native-markdown-display table styles */
      .markdown-preview table { border-collapse: collapse; width: 100%; margin: 16px 0; border: 1px solid ${colors.ring}; border-radius: 0; background: ${colors.background}; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
      /* When tables overflow on small screens they are wrapped in a scroll container (see MarkdownPreviewWeb / MarkdownPreviewWebView)
         which enables horizontal scrolling without breaking layout. */
      .markdown-preview .markdown-table-scroll { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; margin: 16px 0; }
      .markdown-preview .markdown-table-scroll > table { width: max-content; min-width: 100%; margin: 0; }
.markdown-preview thead { background: color-mix(in srgb, ${colors.foreground} 10%, transparent); }
.markdown-preview tbody { background: ${colors.muted}; }
.markdown-preview th, .markdown-preview td { border: 1px solid ${colors.ring}; text-align: left; color: ${colors.foreground}; overflow-wrap: break-word; word-wrap: break-word; word-break: break-word; }
.markdown-preview th { padding: 14px 12px; font-weight: 600; font-size: 14px; letter-spacing: 0.3px; background: color-mix(in srgb, ${colors.foreground} 10%, transparent); }
.markdown-preview td { padding: 12px; font-size: 14px; line-height: 20px; }
/* Table alignment from markdown alignment row ( :--- left, :---: center, ---: right ) */
.markdown-preview th[align="left"], .markdown-preview td[align="left"] { text-align: left; }
.markdown-preview th[align="center"], .markdown-preview td[align="center"] { text-align: center; }
.markdown-preview th[align="right"], .markdown-preview td[align="right"] { text-align: right; }
.markdown-preview hr { border: none; height: 1px; background: ${colors.ring}; margin: 1em 0; }
.markdown-preview img { max-width: 100%; height: auto; border-radius: 4px; display: block; margin-left: auto; margin-right: auto; }
.markdown-preview figure.image-with-caption { margin: 1.25em 0; text-align: center; }
.markdown-preview figure.image-with-caption > img { display: block; margin-left: auto; margin-right: auto; }
.markdown-preview figure.image-with-caption > figcaption {
  margin-top: 0.5em;
  font-size: 0.9em;
  line-height: 1.4;
  color: ${colors.mutedForeground};
  font-style: italic;
}
.markdown-preview .preview-placeholder { color: ${colors.mutedForeground}; font-style: italic; margin: 0; padding: 0; }
/* Task lists (GFM): same left padding as bullet/number lists; we hide the default marker and draw our own checkbox. */
.markdown-preview ul.contains-task-list,
.markdown-preview ol.contains-task-list { list-style: none; padding-left: 1.5em; }
.markdown-preview li.task-list-item {
  position: relative;
  list-style: none;
  margin: 0.25em 0;
}
.markdown-preview li.task-list-item::marker {
  content: none;
}
/* Ensure the first paragraph in a task item doesn't add extra spacing */
.markdown-preview li.task-list-item > p:first-child {
  margin-top: 0;
}
.markdown-preview li.task-list-item > p {
  margin-bottom: 0;
}
/* Checkbox wrapper: sits in the marker slot, vertically aligned with the first line of text */
.markdown-preview li.task-list-item .markdown-preview-checkbox-wrapper {
  position: absolute;
  left: -1.5em;
  top: 0.1em;
  width: 1.2em;
  display: flex;
  padding-top: 2px;
  align-items: center;
  justify-content: center;
}
/* Web-only custom checkbox (matches UI checkbox: green when checked, red when unchecked); click toggles completed/not completed */
.markdown-preview .md-preview-checkbox { appearance: none; margin: 0; font: inherit; line-height: 1; width: 16px; height: 16px; min-width: 16px; min-height: 16px; border-radius: 4px; border: 2px solid #ef4444; background: transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 0; transition: background-color 0.15s, border-color 0.15s; -webkit-tap-highlight-color: transparent; user-select: none; vertical-align: middle; }
.markdown-preview .md-preview-checkbox.checked { border-color: #22c55e; background-color: #22c55e; }
.markdown-preview .md-preview-checkbox svg { width: 12px; height: 12px; color: white; pointer-events: none; }
.markdown-preview input[type="checkbox"] {
  /* Hide the raw GFM checkbox to avoid a visual flash before it is replaced
     by the custom md-preview-checkbox on web, but keep its layout space. */
  opacity: 0;
  width: 16px;
  height: 16px;
  margin: 0 0.5em 0 0;
  padding: 0;
}
/* Theme scrollbars (match global.css) */
${getScrollbarCss({ muted: colors.muted, mutedForeground: colors.mutedForeground })}
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
    { tag: [tags.strikethrough, tags.deleted], textDecoration: "line-through", textDecorationColor: "#ec4899" },
    { tag: tags.link, color: link, textDecoration: "underline" },
    { tag: tags.url, color: linkUrl },
    {
      tag: tags.monospace,
      fontFamily: MARKDOWN_FONT_FAMILY_CODE,
      fontSize: MARKDOWN_CODE_FONT_SIZE_EM,
      color: "#ec4899",
      padding: "0.12em 0.3em",
      borderRadius: "4px",
    },
    /* Quote: text opacity on .blockquote-wrapper .cm-line */
    {
      tag: tags.quote,
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

/**
 * Minimal markdown highlight config for the editor:
 * only uses color / fontWeight / fontStyle / textDecoration – no fontSize,
 * lineHeight, padding, margin, or other size-dependent properties.
 */
export function getMarkdownHighlightStyleMinimalConfig(colors: MarkdownThemeColors) {
  const { link, linkUrl, codeBg } = resolveColors(colors);
  const code = getGitHubCodeColors(colors.isDark === true);
  return [
    // Headings and emphasis – weight + font-size/line-height (to match preview)
    {
      tag: tags.heading1,
      fontWeight: "700",
      fontSize: MARKDOWN_HEADING1_EM,
      lineHeight: MARKDOWN_HEADING1_LINE_HEIGHT,
    },
    {
      tag: tags.heading2,
      fontWeight: "700",
      fontSize: MARKDOWN_HEADING2_EM,
      lineHeight: MARKDOWN_HEADING2_LINE_HEIGHT,
    },
    {
      tag: tags.heading3,
      fontWeight: "600",
      fontSize: MARKDOWN_HEADING3_EM,
      lineHeight: MARKDOWN_HEADING3_LINE_HEIGHT,
    },
    {
      tag: tags.heading4,
      fontWeight: "600",
      fontSize: MARKDOWN_HEADING4_EM,
      lineHeight: MARKDOWN_HEADING4_LINE_HEIGHT,
    },
    {
      tag: tags.heading5,
      fontWeight: "600",
      fontSize: MARKDOWN_HEADING5_EM,
      lineHeight: MARKDOWN_HEADING5_LINE_HEIGHT,
    },
    {
      tag: tags.heading6,
      fontWeight: "600",
      fontSize: MARKDOWN_HEADING6_EM,
      lineHeight: MARKDOWN_HEADING6_LINE_HEIGHT,
    },
    { tag: tags.strong, fontWeight: "700" },
    { tag: tags.emphasis, fontStyle: "italic" },
    // Links
    { tag: tags.link, color: link, textDecoration: "underline" },
    { tag: tags.url, color: linkUrl },
    // Inline code: color + background only
    {
      tag: tags.monospace,
      // Match preview: pink inline code
      color: "#ec4899",
    },
    // Strikethrough
    { tag: [tags.strikethrough, tags.deleted], textDecoration: "line-through", textDecorationColor: "#ec4899" },
    // Blockquote + lists
    { tag: tags.quote, opacity: "0.7", fontStyle: "italic" },
    { tag: tags.list, opacity: "0.95" },
    // Comments / separators
    { tag: tags.contentSeparator, opacity: "0.6" },
    { tag: tags.processingInstruction, opacity: "0.65" },
    { tag: tags.comment, opacity: "0.6", fontStyle: "italic" },
    // Code block tokens – colors only
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
  // Slightly smaller than preview to account for different font rendering in the editor.
  const editorFontScale = 0.94;
  const contentPadding = options?.contentPadding !== false;
  const bg = colors.muted ?? colors.background;
  const fg = colors.foreground;
  const codeBg = colors.codeBackground ?? DEFAULT_CODE_BG;
  const quoteBorder = colors.blockquoteBorder ?? DEFAULT_QUOTE_BORDER;
  const codeBlockBg = hexToRgba(colors.background, colors.isDark ? 0.22 : 0.06);
  const editorFontSizePx = Math.round(MARKDOWN_FONT_SIZE * editorFontScale);
  return {
    "&.cm-editor": {
      backgroundColor: bg,
      color: fg,
      fontSize: `${editorFontSizePx}px`,
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
      lineHeight: `calc(${MARKDOWN_LINE_HEIGHT_CSS} * ${editorFontScale})`,
    },
    /* Cursor (caret) – theme responsive; override CodeMirror default (1.2px solid black) */
    ".cm-cursor": {
      borderLeft: `1.2px solid ${fg}`,
    },
    "&.cm-focused > .cm-scroller > .cm-cursorLayer .cm-cursor": {
      borderLeftColor: fg,
    },
    /* Code block: subtle darker bg + GitHub-style border; inline code keeps .cm-monospace pill style. */
    ".code-block-wrapper": {
      backgroundColor: codeBlockBg,
      fontFamily: MARKDOWN_FONT_FAMILY_CODE,
      border: `1px solid ${colors.ring}`,
      borderRadius: "8px",
    },
    ".code-block-wrapper .cm-monospace": {
      padding: "0",
      borderRadius: "0",
      backgroundColor: "transparent",
    },
    /* Blockquote: text slightly faded */
    ".blockquote-wrapper": {
      fontStyle: "italic",
    },
    ".blockquote-wrapper .cm-line": {
      opacity: "0.7",
    },
    ".cm-mention-tag": {
      color: colors.mentionTag ?? (colors.isDark ? "#facc15" : "#ca8a04"),
      fontWeight: "500",
    },
  };
}

// ---------------------------------------------------------------------------
// CodeMirror WebView (native) – injected CSS string
// ---------------------------------------------------------------------------

export function getCodeMirrorWebViewInjectCss(colors: MarkdownThemeColors): string {
  const bg = colors.muted ?? colors.background;
  const fg = colors.foreground;
  const muted = colors.muted ?? bg;
  const mutedFg = colors.mutedForeground;
  const { link, codeBg } = resolveColors(colors);
  const codeBlockFontSize = Math.round(MARKDOWN_FONT_SIZE * 0.875);
  const scrollbarCss = getScrollbarCss({ muted, mutedForeground: mutedFg });
  const codeBlockBg = hexToRgba(colors.background, colors.isDark ? 0.22 : 0.06);
  return (
    `body, #codemirror-root, .cm-editor, .cm-scroller { background: ${bg} !important; } ` +
    `.cm-content, .cm-line { color: ${fg} !important; caret-color: ${fg} !important; } ` +
    `.cm-cursor, .cm-cursorLayer .cm-cursor { border-left: 1.2px solid ${fg} !important; border-left-color: ${fg} !important; } ` +
    `.cm-scroller { -webkit-overflow-scrolling: touch !important; overflow-y: scroll !important; height: 100% !important; max-height: 100% !important; touch-action: pan-y !important; } ` +
    `.cm-url, .cm-link { color: ${link} !important; } ` +
    `.cm-monospace { background: ${codeBg} !important; } ` +
    `.code-block-wrapper { background: ${codeBlockBg} !important; overflow: auto !important; font-size: ${codeBlockFontSize}px !important; line-height: 1.45 !important; font-family: ${MARKDOWN_FONT_FAMILY_CODE} !important; border: 1px solid ${colors.ring} !important; border-radius: 8px !important; } ` +
    `.code-block-wrapper .cm-monospace { padding: 0 !important; border-radius: 0 !important; background: transparent !important; } ` +
    `.blockquote-wrapper { font-style: italic !important; } ` +
    `.blockquote-wrapper .cm-line { opacity: 0.7 !important; } ` +
    `.cm-mention-tag { color: ${colors.mentionTag ?? (colors.isDark ? "#facc15" : "#ca8a04")} !important; font-weight: 500 !important; } ` +
    scrollbarCss
  );
}

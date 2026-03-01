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
}

const DEFAULT_LINK = "#0969da";
const DEFAULT_LINK_URL = "#0550ae";
const DEFAULT_CODE_BG = "rgba(128,128,128,0.15)";
const DEFAULT_QUOTE_BORDER = "rgba(128,128,128,0.5)";

/** Build theme colors from app palette (useThemeColors). */
export function getMarkdownThemeFromPalette(palette: ThemePalette): MarkdownThemeColors {
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
/* Fenced blocks (GFM): slightly smaller than body to match editor code block feel */
.markdown-preview pre { background: ${colors.muted}; color: ${colors.foreground}; font-size: ${Math.round(MARKDOWN_FONT_SIZE * 0.875)}px; line-height: 1.45; margin: 0 0 1em 0; padding: 12px 16px; border-radius: 8px; font-family: ${MARKDOWN_FONT_FAMILY_CODE}; border: 1px solid ${colors.ring}; overflow-x: auto; }
.markdown-preview pre code { color: inherit; background: none; padding: 0; margin: 0; font-size: inherit; }
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

/** Config array for HighlightStyle.define([...]) – same look as preview. */
export function getMarkdownHighlightStyleConfig(colors: MarkdownThemeColors) {
  const { link, linkUrl, codeBg, quoteBorder } = resolveColors(colors);
  return [
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
  ];
}

/** Theme object for EditorView.theme({...}) – base editor colors and typography. */
export function getCodeMirrorThemeConfig(colors: MarkdownThemeColors): Record<string, Record<string, string>> {
  const bg = colors.muted ?? colors.background;
  const fg = colors.foreground;
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
    },
    ".cm-line": {
      lineHeight: MARKDOWN_LINE_HEIGHT_CSS,
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
  return `body, #codemirror-root, .cm-editor, .cm-scroller { background: ${bg} !important; } .cm-content, .cm-line { color: ${fg} !important; } .cm-cursor { border-left-color: ${fg} !important; } .cm-scroller { -webkit-overflow-scrolling: touch !important; overflow-y: scroll !important; height: 100% !important; max-height: 100% !important; touch-action: pan-y !important; } .cm-url, .cm-link { color: ${link} !important; } .cm-monospace { background: ${codeBg} !important; } .cm-quote { border-left-color: ${quoteBorder} !important; }`;
}

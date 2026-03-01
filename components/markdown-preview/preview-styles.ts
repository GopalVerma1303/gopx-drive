/**
 * CSS for remark/rehype markdown preview. Matches CodeMirror editor styling (WYSIWYG)
 * and GitHub Flavored Markdown: same typography, link/code/blockquote colors, and layout.
 */

import {
  MARKDOWN_CODE_FONT_SIZE_EM,
  MARKDOWN_CONTENT_PADDING_PX,
  MARKDOWN_FONT_SIZE,
  MARKDOWN_HEADING1_EM,
  MARKDOWN_HEADING2_EM,
  MARKDOWN_HEADING3_EM,
  MARKDOWN_HEADING4_EM,
  MARKDOWN_HEADING5_EM,
  MARKDOWN_HEADING6_EM,
  MARKDOWN_LINE_HEIGHT,
} from "@/lib/markdown-content-layout";

export interface PreviewThemeColors {
  foreground: string;
  muted: string;
  mutedForeground: string;
  ring: string;
  background: string;
}

/** GFM-style colors aligned with editor syntax highlighting */
const GFM_LINK = "#0969da";
const GFM_LINK_URL = "#0550ae";
const GFM_INLINE_CODE_BG = "rgba(128,128,128,0.15)";
const GFM_BLOCKQUOTE_BORDER = "rgba(128,128,128,0.5)";

export function getPreviewCss(colors: PreviewThemeColors): string {
  return `
/* Padding on content only so scrollbar can sit at edge of device */
.markdown-preview {
  color: ${colors.foreground};
  font-size: ${MARKDOWN_FONT_SIZE}px;
  line-height: ${MARKDOWN_LINE_HEIGHT}px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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
.markdown-preview code { font-family: ui-monospace, monospace; font-size: ${MARKDOWN_CODE_FONT_SIZE_EM}; background: ${GFM_INLINE_CODE_BG}; padding: 0.12em 0.3em; border-radius: 4px; color: ${colors.foreground}; margin: 0; }
/* Fenced blocks (GFM): slightly smaller than body to match editor code block feel */
.markdown-preview pre { background: ${colors.muted}; color: ${colors.foreground}; font-size: ${Math.round(MARKDOWN_FONT_SIZE * 0.875)}px; line-height: 1.45; margin: 0 0 1em 0; padding: 12px 16px; border-radius: 8px; font-family: ui-monospace, monospace; border: 1px solid ${colors.ring}; overflow-x: auto; }
.markdown-preview pre code { color: inherit; background: none; padding: 0; margin: 0; font-size: inherit; }
/* Blockquote: match editor quote highlight */
.markdown-preview blockquote { opacity: 0.85; border-left: 3px solid ${GFM_BLOCKQUOTE_BORDER}; padding-left: 0.5em; margin: 0 0 1em 0; color: ${colors.foreground}; }
.markdown-preview ul, .markdown-preview ol { margin: 0 0 1em 0; padding-left: 1.5em; list-style-position: outside; }
.markdown-preview li { margin: 0.25em 0; color: ${colors.foreground}; }
.markdown-preview li > p { margin: 0; }
/* Links: GFM-style, match editor link highlight */
.markdown-preview a { color: ${GFM_LINK}; text-decoration: underline; }
.markdown-preview a:visited { color: ${GFM_LINK_URL}; }
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

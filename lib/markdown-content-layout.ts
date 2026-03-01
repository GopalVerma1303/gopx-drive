/**
 * Shared layout and typography constants for markdown editor and preview.
 * Ensures identical padding, font size, and line height so switching between edit and preview feels seamless (WYSIWYG).
 */

export const MARKDOWN_CONTENT_PADDING = {
  paddingHorizontal: 32,
  paddingTop: 24,
  paddingBottom: 65,
} as const;

/** Web/DOM pixel values for use in inline styles (e.g. CodeMirror container, WebView HTML). */
export const MARKDOWN_CONTENT_PADDING_PX = {
  paddingLeft: 32,
  paddingRight: 32,
  paddingTop: 24,
  paddingBottom: 65,
} as const;

/** Base font size (px) for editor and preview body text. */
export const MARKDOWN_FONT_SIZE = 16;

/** Line height (px) for editor and preview. */
export const MARKDOWN_LINE_HEIGHT = 24;

/** Line height as CSS value for CodeMirror theme. */
export const MARKDOWN_LINE_HEIGHT_CSS = `${MARKDOWN_LINE_HEIGHT}px`;

/** Relative font sizes (em) so editor and preview match exactly. */
export const MARKDOWN_HEADING1_EM = "1.5em";
export const MARKDOWN_HEADING2_EM = "1.35em";
export const MARKDOWN_HEADING3_EM = "1.2em";
export const MARKDOWN_HEADING4_EM = "1.1em";
export const MARKDOWN_HEADING5_EM = "1em";
export const MARKDOWN_HEADING6_EM = "0.9375em";
/** Body text in editor (1em = inherit root size from MARKDOWN_FONT_SIZE). Use in native/WebView so one constant controls actual px. */
export const MARKDOWN_FONT_SIZE_EM = "0.875em";

/** Inline code and code blocks (slightly smaller than body). */
export const MARKDOWN_CODE_FONT_SIZE_EM = "0.875em";

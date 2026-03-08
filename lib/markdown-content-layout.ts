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

/** Web editor only: slightly smaller horizontal padding for CodeMirror .cm-content (scrollbar stays at edge). */
export const MARKDOWN_EDITOR_CONTENT_PADDING_PX_WEB = {
  ...MARKDOWN_CONTENT_PADDING_PX,
  paddingLeft: 24,
  paddingRight: 24,
} as const;

/** Native-only: same as above but with smaller horizontal padding. Used by CodeMirrorDOM. */
export const MARKDOWN_CONTENT_PADDING_PX_NATIVE = {
  ...MARKDOWN_CONTENT_PADDING_PX,
  paddingLeft: 24,
  paddingRight: 24,
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

/** Line heights for headings – shared by preview and editor so they match. */
export const MARKDOWN_HEADING1_LINE_HEIGHT = "1.3";
export const MARKDOWN_HEADING2_LINE_HEIGHT = "1.35";
export const MARKDOWN_HEADING3_LINE_HEIGHT = "1.4";
export const MARKDOWN_HEADING4_LINE_HEIGHT = "1.4";
export const MARKDOWN_HEADING5_LINE_HEIGHT = "1.4";
export const MARKDOWN_HEADING6_LINE_HEIGHT = "1.4";
/** Body text in editor (1em = inherit root size from MARKDOWN_FONT_SIZE). Use in native/WebView so one constant controls actual px. */
export const MARKDOWN_FONT_SIZE_EM = "0.875em";

/** Inline code and code blocks (slightly smaller than body). */
export const MARKDOWN_CODE_FONT_SIZE_EM = "0.875em";

/** Font family for body text – shared by preview and editor so they look identical. */
export const MARKDOWN_FONT_FAMILY_BODY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

/** Font family for inline code and code blocks. */
export const MARKDOWN_FONT_FAMILY_CODE = "ui-monospace, monospace";

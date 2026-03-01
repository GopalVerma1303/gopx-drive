/**
 * Re-exports from the single source of truth (lib/markdown-theme) for backward compatibility.
 * Preview and editor both use lib/markdown-theme for identical styling and theme responsiveness.
 */

import {
  getPreviewCss as getPreviewCssFromTheme,
  type MarkdownThemeColors,
} from "@/lib/markdown-theme";

export type PreviewThemeColors = MarkdownThemeColors;
export const getPreviewCss = getPreviewCssFromTheme;

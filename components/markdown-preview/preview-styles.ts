/**
 * CSS for remark/rehype markdown preview. Used by web (inline style block) and WebView (HTML template).
 */

export interface PreviewThemeColors {
  foreground: string;
  muted: string;
  mutedForeground: string;
  ring: string;
  background: string;
}

export function getPreviewCss(colors: PreviewThemeColors): string {
  return `
.markdown-preview {
  color: ${colors.foreground};
  font-size: 16px;
  line-height: 24px;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  width: 100%;
  min-height: 100%;
}
.markdown-preview h1 { font-size: 28px; font-weight: 700; margin: 0; padding: 0; line-height: 36px; color: ${colors.foreground}; }
.markdown-preview h2 { font-size: 26px; font-weight: 700; margin: 0; padding: 0; line-height: 32px; color: ${colors.foreground}; }
.markdown-preview h3 { font-size: 22px; font-weight: 600; margin: 0; padding: 0; line-height: 28px; color: ${colors.foreground}; }
.markdown-preview h4 { font-size: 18px; font-weight: 600; margin: 0; padding: 0; line-height: 24px; color: ${colors.foreground}; }
.markdown-preview h5 { font-size: 17px; font-weight: 600; margin: 0; padding: 0; line-height: 22px; color: ${colors.foreground}; }
.markdown-preview h6 { font-size: 15px; font-weight: 600; margin: 0; padding: 0; line-height: 20px; color: ${colors.foreground}; }
.markdown-preview p { margin: 0; padding: 0; color: ${colors.foreground}; }
.markdown-preview strong { font-weight: 700; color: ${colors.foreground}; }
.markdown-preview em { font-style: italic; color: ${colors.foreground}; }
.markdown-preview code { color: #FF69B4; font-size: 14px; font-family: ui-monospace, monospace; margin: 0; padding: 0; }
.markdown-preview pre { background: ${colors.muted}; color: ${colors.foreground}; font-size: 14px; margin: 0; padding: 0; border-radius: 8px; font-family: ui-monospace, monospace; border: 1px solid ${colors.ring}; overflow-x: auto; }
.markdown-preview pre code { color: inherit; background: none; margin: 0; padding: 0; }
.markdown-preview blockquote { background: ${colors.muted}; border-left: 4px solid ${colors.ring}; margin: 0; padding: 0; border-radius: 4px; font-style: italic; color: ${colors.mutedForeground}; }
.markdown-preview ul, .markdown-preview ol { margin: 0; padding: 0; list-style-position: inside; }
.markdown-preview li { margin: 0; padding: 0; color: ${colors.foreground}; }
.markdown-preview a { color: #3b82f6; text-decoration: underline; }
.markdown-preview table { border-collapse: collapse; width: 100%; margin: 0; padding: 0; border: 1px solid ${colors.ring}; border-radius: 0; background: ${colors.background}; }
.markdown-preview th, .markdown-preview td { border: 1px solid ${colors.ring}; margin: 0; padding: 0; text-align: left; color: ${colors.foreground}; }
.markdown-preview th { font-weight: 600; font-size: 14px; background: ${colors.muted}; }
.markdown-preview td { font-size: 14px; line-height: 20px; }
.markdown-preview hr { border: none; height: 1px; background: ${colors.ring}; margin: 0; padding: 0; }
.markdown-preview img { max-width: 100%; height: auto; }
.markdown-preview .preview-placeholder { color: ${colors.mutedForeground}; font-style: italic; margin: 0; padding: 0; }
`.trim();
}

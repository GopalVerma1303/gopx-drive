import type { PreviewThemeColors } from "./preview-styles";
import { getPreviewCss } from "./preview-styles";

/**
 * Build full HTML document for WebView. Uses theme colors and wraps body in .markdown-preview.
 */
export function getPreviewFullHtml(bodyHtml: string, colors: PreviewThemeColors): string {
  const css = getPreviewCss(colors);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <style>
    html, body { margin: 0; padding: 0; min-height: 100%; background-color: transparent; }
    ${css}
  </style>
</head>
<body>
  <div id="content" class="markdown-preview" style="width:100%;height:100%;margin:0;padding:0;">${bodyHtml}</div>
</body>
</html>`;
}

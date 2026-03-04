import type { PreviewThemeColors } from "./preview-styles";
import { getPreviewCss } from "./preview-styles";

/**
 * Build full HTML document for WebView. Uses theme colors and wraps body in .markdown-preview.
 *
 * Also wires in Mermaid via CDN so that `<div class="mermaid">` blocks produced
 * by the markdown pipeline can be rendered as diagrams inside the WebView.
 * The actual rendering is triggered after content injection from
 * `MarkdownPreviewWebView` so the HTML is always up to date.
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
  <!-- Mermaid runtime for native WebView; diagrams are rendered on-demand after content injection. -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    (function() {
      try {
        if (window.mermaid) {
          window.mermaid.initialize({
            startOnLoad: false,
            securityLevel: "loose",
            theme: ${colors.isDark ? '"dark"' : '"default"'}
          });
        }
      } catch (e) {
        // Fail silently; markdown preview should continue to work without diagrams.
      }
    })();
  </script>
</head>
<body>
  <div id="content" class="markdown-preview" style="width:100%;min-height:100%;margin:0;">${bodyHtml}</div>
</body>
</html>`;
}

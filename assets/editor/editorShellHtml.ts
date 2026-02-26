/**
 * Minimal HTML for the native CodeMirror editor WebView (Joplin-style).
 * Editor code is injected via pre-bundled EDITOR_BUNDLE — no CDN.
 * Load from file:// for a proper origin on Android (see EditorWebView).
 */
export const EDITOR_SHELL_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Editor</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
    #root { height: 100%; width: 100%; }
    .cm-editor { height: 100%; }
    .cm-scroller { overflow: auto; }
  </style>
</head>
<body>
  <div id="root"></div>
</body>
</html>
`.trim();

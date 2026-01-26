/**
 * Editor HTML Template
 *
 * Generates the HTML structure for the WebView editor.
 */

export interface EditorHtmlOptions {
  backgroundColor: string;
  foregroundColor: string;
  primaryColor: string;
  mutedForegroundColor: string;
  isDark: boolean;
}

/**
 * Generate the HTML template for the editor
 */
export function generateEditorHtml(options: EditorHtmlOptions): string {
  const {
    backgroundColor,
    foregroundColor,
    primaryColor,
    mutedForegroundColor,
    isDark,
  } = options;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <title>Markdown Editor</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        margin: 0;
        height: 100vh;
        width: 100%;
        overflow: hidden;
        background-color: ${backgroundColor};
      }
      #editor-container {
        width: 100%;
        height: 100%;
        background-color: ${backgroundColor};
        position: relative;
      }
      #editor-textarea {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border: none;
        outline: none;
        padding: 16px;
        padding-bottom: 80px;
        font-size: 16px;
        font-family: monospace;
        line-height: 1.5;
        background: transparent;
        color: transparent;
        caret-color: ${foregroundColor};
        resize: none;
        z-index: 2;
      }
      #editor-highlight {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        padding: 16px;
        padding-bottom: 80px;
        font-size: 16px;
        font-family: monospace;
        line-height: 1.5;
        background-color: ${backgroundColor};
        color: ${foregroundColor};
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow: hidden;
        z-index: 1;
        pointer-events: none;
      }
      /* CodeMirror highlighting classes (from @codemirror/lang-markdown and @lezer/highlight) */
      .cm-heading { font-weight: bold; color: ${foregroundColor}; }
      .cm-heading1 { font-weight: bold; font-size: 1.5em; color: ${foregroundColor}; }
      .cm-heading2 { font-weight: bold; font-size: 1.3em; color: ${foregroundColor}; }
      .cm-heading3 { font-weight: bold; font-size: 1.1em; color: ${foregroundColor}; }
      .cm-heading4 { font-weight: bold; color: ${foregroundColor}; }
      .cm-heading5 { font-weight: bold; color: ${foregroundColor}; }
      .cm-heading6 { font-weight: bold; color: ${foregroundColor}; }
      .cm-strong { font-weight: bold; color: ${foregroundColor}; }
      .cm-emphasis { font-style: italic; color: ${foregroundColor}; }
      .cm-strikethrough { text-decoration: line-through; color: ${mutedForegroundColor}; }
      .cm-link { color: ${primaryColor}; text-decoration: underline; }
      .cm-quote { font-style: italic; color: ${mutedForegroundColor}; }
      .cm-monospace { 
        color: ${isDark ? "#ff69b4" : "#d73a49"}; 
        background-color: ${isDark ? "rgba(255, 105, 180, 0.1)" : "rgba(215, 58, 73, 0.1)"}; 
        padding: 2px 4px;
        border-radius: 3px;
        font-family: monospace;
      }
      .cm-codeBlock { 
        display: block; 
        color: ${foregroundColor}; 
        background-color: ${isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)"}; 
        padding: 8px;
        border-radius: 4px;
        margin: 4px 0;
        font-family: monospace;
      }
      .cm-list { color: ${foregroundColor}; }
      .cm-horizontalRule { 
        border-top: 1px solid ${mutedForegroundColor}; 
        margin: 8px 0; 
        display: block;
      }
      .cm-keyword { color: ${isDark ? "#c792ea" : "#d73a49"}; }
      .cm-string { color: ${isDark ? "#c3e88d" : "#032f62"}; }
      .cm-number { color: ${isDark ? "#f78c6c" : "#005cc5"}; }
      .cm-comment { color: ${isDark ? "#546e7a" : "#6a737d"}; font-style: italic; }
      .cm-meta { color: ${isDark ? "#82aaff" : "#005cc5"}; }
      .cm-tagName { color: ${isDark ? "#f07178" : "#22863a"}; }
      .cm-attributeName { color: ${isDark ? "#c792ea" : "#6f42c1"}; }
      .cm-className { color: ${isDark ? "#ffcb6b" : "#6f42c1"}; }
      .cm-function { color: ${isDark ? "#82aaff" : "#6f42c1"}; }
      .cm-variableName { color: ${foregroundColor}; }
      .cm-propertyName { color: ${foregroundColor}; }
    </style>
  </head>
  <body>
    <div id="editor-container">
      <div id="editor-highlight"></div>
      <textarea id="editor-textarea"></textarea>
    </div>
  </body>
</html>`;
}

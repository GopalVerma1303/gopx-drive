export function getMarkdownEditorWebViewHtml() {
	// NOTE: This HTML runs inside a WebView.
	//
	// IMPORTANT: It intentionally contains **no editor logic**.
	// The CodeMirror editor is bootstrapped by injecting a locally-bundled script from
	// the React Native side via `injectedJavaScript` (offline + deterministic).
	return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <style>
      :root {
        /* Defaults chosen to match Joplin's mobile editor feel. */
        --bg: transparent;
        --fg: #111827;
        --caret: #111827;
        --selection: rgba(59, 130, 246, 0.25);
        --gutter-fg: rgba(17, 24, 39, 0.45);
        --line-highlight: rgba(0, 0, 0, 0.04);
        --placeholder: rgba(17, 24, 39, 0.35);
        --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;

        /* Joplin uses very small horizontal padding and a top inset. */
        --pad-x: 1px;
        --pad-top: 10px;
        --pad-bottom: 1px;

        /* Joplin uses 13pt. Use a close px default (can be overridden by RN). */
        --font-size: 17px;
        --line-height: 24px;
      }
      @media (max-width: 420px) {
        :root {
          --pad-x: 16px;
          --pad-top: 22px;
          --pad-bottom: 60px;
          --font-size: 15px;
          --line-height: 22px;
        }
      }
      @media (min-width: 421px) and (max-width: 768px) {
        :root {
          --pad-x: 24px;
          --pad-top: 26px;
          --pad-bottom: 65px;
          --font-size: 16px;
          --line-height: 24px;
        }
      }
      @media (min-width: 1024px) {
        :root {
          --pad-x: 40px;
        }
      }

      html,
      body,
      #root {
        height: 100%;
        margin: 0;
        padding: 0;
        background: var(--bg);
      }
      body {
        overflow: auto;
        -webkit-text-size-adjust: 100%;
      }
      #root {
        display: flex;
        min-height: 100%;
      }
      .gopx-editor {
        flex: 1;
        min-height: 100%;
      }

      /* Scrollbar styling (matches Joplin's approach). */
      * {
        scrollbar-width: thin;
        scrollbar-color: rgba(100, 100, 100, 0.7) rgba(0, 0, 0, 0.1);
      }
      @supports selector(::-webkit-scrollbar) {
        *::-webkit-scrollbar {
          width: 7px;
          height: 7px;
        }
        *::-webkit-scrollbar-corner {
          background: none;
        }
        *::-webkit-scrollbar-track {
          border: none;
        }
        *::-webkit-scrollbar-thumb {
          background: rgba(100, 100, 100, 0.3);
          border-radius: 5px;
        }
        *::-webkit-scrollbar-track:hover {
          background: rgba(0, 0, 0, 0.1);
        }
        *::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 100, 100, 0.7);
        }
        * {
          scrollbar-width: unset;
          scrollbar-color: unset;
        }
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>
      // Buffer messages until the injected bundle installs its listeners.
      (function () {
        window.__GOPX_PENDING_HOST_MESSAGES__ = [];
        function onIncoming(event) {
          window.__GOPX_PENDING_HOST_MESSAGES__.push(event);
        }
        window.addEventListener("message", onIncoming);
        document.addEventListener("message", onIncoming);
      })();
    </script>
  </body>
</html>`;
}

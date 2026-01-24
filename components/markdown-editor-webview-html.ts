export function getMarkdownEditorWebViewHtml() {
  // NOTE: This HTML runs inside a WebView. It bootstraps a CodeMirror 6 editor
  // (loaded from esm.sh) and communicates with the host via postMessage.
  //
  // If you want fully-offline/native-bundled assets (no CDN), we can bundle CM6
  // into a local file later and inline/load it instead.
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
        --bg: transparent;
        --fg: #111827;
        --caret: #111827;
        --selection: rgba(59, 130, 246, 0.25);
        --gutter-fg: rgba(17, 24, 39, 0.45);
        --line-highlight: rgba(0, 0, 0, 0.04);
        --placeholder: rgba(17, 24, 39, 0.35);
        --font: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
          "Courier New", monospace;
        --pad-x: 32px;
        --pad-top: 30px;
        --pad-bottom: 65px;
        --font-size: 16px;
        --line-height: 24px;
      }
      /* Responsive editor spacing (phones/tablets/desktop) */
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
        overflow: hidden;
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
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
      const sendToHost = (msg) => {
        try {
          const serialized = JSON.stringify(msg);
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(serialized);
          } else if (window.parent && window.parent.postMessage) {
            window.parent.postMessage(msg, "*");
          }
        } catch (e) {
          // no-op
        }
      };

      const safeParse = (data) => {
        if (data == null) return null;
        if (typeof data === "object") return data;
        if (typeof data !== "string") return null;
        try {
          return JSON.parse(data);
        } catch (e) {
          return null;
        }
      };

      const setThemeVars = (theme) => {
        if (!theme || typeof theme !== "object") return;
        const root = document.documentElement;
        const set = (k, v) => {
          if (typeof v === "string" && v.length) root.style.setProperty(k, v);
        };
        const setPx = (k, v) => {
          if (typeof v === "number" && Number.isFinite(v)) root.style.setProperty(k, v + "px");
          else if (typeof v === "string" && v.length) root.style.setProperty(k, v);
        };
        set("--bg", theme.background);
        set("--fg", theme.foreground);
        set("--caret", theme.caret);
        set("--selection", theme.selection);
        set("--gutter-fg", theme.gutterForeground);
        set("--line-highlight", theme.lineHighlight);
        set("--placeholder", theme.placeholder);
        setPx("--pad-x", theme.padX);
        setPx("--pad-top", theme.padTop);
        setPx("--pad-bottom", theme.padBottom);
        setPx("--font-size", theme.fontSize);
        setPx("--line-height", theme.lineHeight);
      };

      const clampSelection = (docLength, sel) => {
        const start = Math.max(0, Math.min(docLength, sel?.start ?? 0));
        const end = Math.max(0, Math.min(docLength, sel?.end ?? start));
        return { start, end };
      };

      let view = null;
      let themeCompartment = null;
      let placeholderCompartment = null;
      let pending = [];
      let lastSentValue = null;
      let lastSentSelection = { start: 0, end: 0 };
      let changeRaf = 0;
      let selectionRaf = 0;

      const flushPending = () => {
        if (!view) return;
        const items = pending;
        pending = [];
        for (const msg of items) {
          handleMessage(msg);
        }
      };

      const postSelection = () => {
        if (!view) return;
        const sel = view.state.selection.main;
        const next = { start: sel.from, end: sel.to };
        if (next.start === lastSentSelection.start && next.end === lastSentSelection.end) return;
        lastSentSelection = next;
        sendToHost({ type: "selection", selection: next });
      };

      const postChange = () => {
        if (!view) return;
        const nextValue = view.state.doc.toString();
        const sel = view.state.selection.main;
        const nextSel = { start: sel.from, end: sel.to };
        lastSentValue = nextValue;
        lastSentSelection = nextSel;
        sendToHost({ type: "change", value: nextValue, selection: nextSel });
      };

      const setValue = (value) => {
        if (!view) return;
        const next = typeof value === "string" ? value : "";
        const cur = view.state.doc.toString();
        if (next === cur) return;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: next },
        });
      };

      const setSelection = (sel) => {
        if (!view) return;
        const next = clampSelection(view.state.doc.length, sel);
        view.dispatch({
          selection: { anchor: next.start, head: next.end },
          scrollIntoView: true,
        });
      };

      const focus = () => {
        if (!view) return;
        view.focus();
      };

      const insertText = (text, cursorOffset) => {
        if (!view) return;
        const t = typeof text === "string" ? text : "";
        const sel = view.state.selection.main;
        const from = sel.from;
        const to = sel.to;
        const offset = typeof cursorOffset === "number" ? cursorOffset : t.length;
        view.dispatch({
          changes: { from, to, insert: t },
          selection: { anchor: from + offset },
          scrollIntoView: true,
        });
        view.focus();
      };

      const wrapSelection = (before, after, cursorOffset) => {
        if (!view) return;
        const b = typeof before === "string" ? before : "";
        const a = typeof after === "string" ? after : "";
        const sel = view.state.selection.main;
        const from = sel.from;
        const to = sel.to;
        const selected = view.state.doc.sliceString(from, to);
        if (selected && selected.length) {
          const insert = b + selected + a;
          view.dispatch({
            changes: { from, to, insert },
            selection: { anchor: from + insert.length },
            scrollIntoView: true,
          });
        } else {
          const insert = b + a;
          const offset = typeof cursorOffset === "number" ? cursorOffset : b.length;
          view.dispatch({
            changes: { from, to, insert },
            selection: { anchor: from + offset },
            scrollIntoView: true,
          });
        }
        view.focus();
      };

      const setPlaceholder = (text, makePlaceholderTheme) => {
        if (!view || !placeholderCompartment) return;
        const t = typeof text === "string" ? text : "";
        const { placeholder, EditorView } = window.__GOPX_CM__;
        const placeholderExt = placeholder(t);
        const placeholderTheme = EditorView.theme({
          ".cm-placeholder": { color: "var(--placeholder)" },
        });
        view.dispatch({
          effects: placeholderCompartment.reconfigure(
            makePlaceholderTheme ? [placeholderExt, placeholderTheme] : [placeholderExt]
          ),
        });
      };

      const setTheme = (theme) => {
        if (!view || !themeCompartment) return;
        setThemeVars(theme);
        const { EditorView } = window.__GOPX_CM__;
        const cmTheme = EditorView.theme(
          {
            "&": {
              color: "var(--fg)",
              backgroundColor: "var(--bg)",
              height: "100%",
            },
            ".cm-editor": {
              height: "100%",
            },
            ".cm-scroller": {
              overflow: "auto",
              height: "100%",
              backgroundColor: "var(--bg)",
              -webkit-overflow-scrolling: "touch",
              overscrollBehavior: "contain",
              fontFamily: "var(--font)",
            },
            ".cm-content": {
              paddingLeft: "var(--pad-x)",
              paddingRight: "var(--pad-x)",
              paddingTop: "var(--pad-top)",
              paddingBottom: "var(--pad-bottom)",
              caretColor: "var(--caret)",
              fontSize: "var(--font-size)",
              lineHeight: "var(--line-height)",
            },
            ".cm-line": {
              padding: "0",
            },
            ".cm-gutters": {
              backgroundColor: "var(--bg)",
              color: "var(--gutter-fg)",
              border: "none",
            },
            ".cm-activeLine": {
              backgroundColor: "var(--line-highlight)",
            },
            ".cm-selectionBackground, ::selection": {
              backgroundColor: "var(--selection) !important",
            },
          },
          { dark: !!theme?.dark }
        );

        view.dispatch({
          effects: themeCompartment.reconfigure(cmTheme),
        });
      };

      const handleMessage = (msg) => {
        if (!msg || typeof msg !== "object") return;
        if (!view && msg.type !== "init") {
          pending.push(msg);
          return;
        }

        switch (msg.type) {
          case "init": {
            // init can arrive before editor is fully created; queue until ready
            if (!view) {
              pending.push(msg);
              return;
            }
            if (typeof msg.value === "string") setValue(msg.value);
            if (msg.selection) setSelection(msg.selection);
            if (typeof msg.placeholder === "string") setPlaceholder(msg.placeholder, true);
            if (msg.theme) setTheme(msg.theme);
            return;
          }
          case "setValue":
            return setValue(msg.value);
          case "setSelection":
            return setSelection(msg.selection);
          case "focus":
            return focus();
          case "insertText":
            return insertText(msg.text, msg.cursorOffset);
          case "wrapSelection":
            return wrapSelection(msg.before, msg.after, msg.cursorOffset);
          case "setTheme":
            return setTheme(msg.theme);
          case "setPlaceholder":
            return setPlaceholder(msg.placeholder, true);
          default:
            return;
        }
      };

      const onIncoming = (event) => {
        const msg = safeParse(event?.data ?? event);
        handleMessage(msg);
      };
      window.addEventListener("message", onIncoming);
      document.addEventListener("message", onIncoming);

      const boot = async () => {
        try {
          const [
            stateMod,
            viewMod,
            commandsMod,
            mdMod,
            languageDataMod,
          ] = await Promise.all([
            import("https://esm.sh/@codemirror/state@6.5.4"),
            import("https://esm.sh/@codemirror/view@6.39.11"),
            import("https://esm.sh/@codemirror/commands@6.10.1"),
            import("https://esm.sh/@codemirror/lang-markdown@6.5.0"),
            import("https://esm.sh/@codemirror/language-data@6.5.2"),
          ]);

          const { EditorState, Compartment } = stateMod;
          const { EditorView, keymap, placeholder } = viewMod;
          const { defaultKeymap, history, historyKeymap, indentWithTab } = commandsMod;
          const { markdown, markdownKeymap } = mdMod;
          const { languages } = languageDataMod;

          // expose a tiny surface for reconfiguration helpers
          window.__GOPX_CM__ = { EditorView, placeholder };

          themeCompartment = new Compartment();
          placeholderCompartment = new Compartment();

          const updateListener = EditorView.updateListener.of((vu) => {
            if (vu.docChanged) {
              if (changeRaf) cancelAnimationFrame(changeRaf);
              changeRaf = requestAnimationFrame(() => {
                changeRaf = 0;
                postChange();
              });
            } else if (vu.selectionSet) {
              if (selectionRaf) cancelAnimationFrame(selectionRaf);
              selectionRaf = requestAnimationFrame(() => {
                selectionRaf = 0;
                postSelection();
              });
            }
          });

          const baseTheme = EditorView.theme(
            {
              "&": {
                color: "var(--fg)",
                backgroundColor: "var(--bg)",
                height: "100%",
              },
              ".cm-editor": {
                height: "100%",
              },
              ".cm-scroller": {
                overflow: "auto",
                height: "100%",
                backgroundColor: "var(--bg)",
                -webkit-overflow-scrolling: "touch",
                overscrollBehavior: "contain",
                fontFamily: "var(--font)",
              },
              ".cm-content": {
                paddingLeft: "var(--pad-x)",
                paddingRight: "var(--pad-x)",
                paddingTop: "var(--pad-top)",
                paddingBottom: "var(--pad-bottom)",
                caretColor: "var(--caret)",
                fontSize: "var(--font-size)",
                lineHeight: "var(--line-height)",
              },
              ".cm-gutters": {
                backgroundColor: "var(--bg)",
                color: "var(--gutter-fg)",
                border: "none",
              },
              ".cm-activeLine": {
                backgroundColor: "var(--line-highlight)",
              },
              ".cm-selectionBackground, ::selection": {
                backgroundColor: "var(--selection) !important",
              },
              ".cm-placeholder": { color: "var(--placeholder)" },
            },
            { dark: false }
          );

          const root = document.getElementById("root");
          const parent = document.createElement("div");
          parent.className = "gopx-editor";
          root.appendChild(parent);

          const initialState = EditorState.create({
            doc: "",
            extensions: [
              history(),
              markdown({ codeLanguages: languages }),
              keymap.of([
                ...defaultKeymap,
                ...historyKeymap,
                ...markdownKeymap,
                indentWithTab,
              ]),
              updateListener,
              themeCompartment.of(baseTheme),
              placeholderCompartment.of([placeholder(""), EditorView.theme({ ".cm-placeholder": { color: "var(--placeholder)" } })]),
            ],
          });

          view = new EditorView({
            state: initialState,
            parent,
          });

          sendToHost({ type: "ready" });
          flushPending();
        } catch (e) {
          sendToHost({ type: "error", message: String(e && e.message ? e.message : e) });
        }
      };

      boot();
    </script>
  </body>
</html>`;
}


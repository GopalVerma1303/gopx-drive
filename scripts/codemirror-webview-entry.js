/**
 * Entry that runs inside the WebView. Creates CodeMirror and bridges with React Native via postMessage.
 * Bundled by build-codemirror-editor.js and inlined into the HTML for offline use.
 */
const { EditorView, keymap } = require("@codemirror/view");
const { EditorState } = require("@codemirror/state");
const { defaultKeymap, indentWithTab, history, redo, undo } = require("@codemirror/commands");
const { markdown } = require("@codemirror/lang-markdown");

const TAB = "  ";

function createEditor(container, initialValue, placeholder) {
  const state = EditorState.create({
    doc: initialValue || "",
    extensions: [
      markdown(),
      history(),
      keymap.of([...defaultKeymap, indentWithTab]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && window.ReactNativeWebView) {
          const value = update.state.doc.toString();
          const sel = update.state.selection.main;
          window.ReactNativeWebView.postMessage(
            JSON.stringify({
              type: "change",
              payload: { value, selection: { start: sel.from, end: sel.to } },
            })
          );
        }
      }),
      EditorView.updateListener.of((update) => {
        if (update.selectionSet && window.ReactNativeWebView) {
          const sel = update.state.selection.main;
          window.ReactNativeWebView.postMessage(
            JSON.stringify({
              type: "selectionChange",
              payload: { start: sel.from, end: sel.to },
            })
          );
        }
      }),
    ],
  });

  const view = new EditorView({
    state,
    parent: container,
  });

  return view;
}

let editorView = null;

window.__initCodeMirror = function (initialValue, placeholder) {
  const container = document.getElementById("codemirror-root");
  if (!container) return;
  container.innerHTML = "";
  editorView = createEditor(container, initialValue || "", placeholder || "");
};

window.__receiveFromRN = function (jsonStr) {
  try {
    const msg = typeof jsonStr === "string" ? JSON.parse(jsonStr) : jsonStr;
    if (!msg || typeof msg.type !== "string") return;
    if (!editorView) return;
    const { type, payload } = msg;
    const state = editorView.state;
    const doc = state.doc.toString();

    switch (type) {
      case "setValue":
        if (payload !== doc) {
          editorView.dispatch({
            changes: { from: 0, to: doc.length, insert: payload || "" },
          });
        }
        break;
      case "setSelection": {
        const { start, end } = payload;
        editorView.dispatch({
          selection: { anchor: start, head: end },
        });
        break;
      }
      case "insertText": {
        const { text, cursorOffset } = payload;
        const sel = state.selection.main;
        const insert = text || "";
        const newPos = sel.from + (cursorOffset !== undefined ? cursorOffset : insert.length);
        editorView.dispatch({
          changes: { from: sel.from, to: sel.to, insert },
          selection: { anchor: newPos, head: newPos },
        });
        break;
      }
      case "replaceRange": {
        const { start, end, text } = payload;
        const insert = text || "";
        editorView.dispatch({
          changes: { from: start, to: end, insert },
          selection: { anchor: start + insert.length, head: start + insert.length },
        });
        break;
      }
      case "wrapSelection": {
        const { before, after, cursorOffset } = payload;
        const sel = state.selection.main;
        const selected = doc.slice(sel.from, sel.to);
        const insert = (before || "") + selected + (after || "");
        const newPos = sel.from + (cursorOffset !== undefined ? cursorOffset : (before || "").length);
        editorView.dispatch({
          changes: { from: sel.from, to: sel.to, insert },
          selection: { anchor: newPos, head: newPos },
        });
        break;
      }
      case "indent": {
        const sel = state.selection.main;
        const line = state.doc.lineAt(sel.from);
        const from = line.from;
        const endLine = state.doc.lineAt(sel.to);
        const toEnd = endLine.to;
        const text = state.doc.sliceDoc(from, toEnd);
        const lines = text.split("\n");
        const newText = lines.map((l) => TAB + l).join("\n");
        const numLines = lines.length;
        editorView.dispatch({
          changes: { from, to: toEnd, insert: newText },
          selection: { anchor: sel.from + TAB.length, head: sel.to + TAB.length * numLines },
        });
        break;
      }
      case "outdent": {
        const sel = state.selection.main;
        const line = state.doc.lineAt(sel.from);
        const from = line.from;
        const endLine = state.doc.lineAt(sel.to);
        const toEnd = endLine.to;
        const text = state.doc.sliceDoc(from, toEnd);
        const lines = text.split("\n");
        let headShift = 0;
        const newLines = lines.map((l, i) => {
          if (l.startsWith(TAB)) {
            const shift = TAB.length;
            if (i === 0) headShift += shift;
            return l.slice(TAB.length);
          }
          return l;
        });
        const newText = newLines.join("\n");
        const lenDiff = text.length - newText.length;
        editorView.dispatch({
          changes: { from, to: toEnd, insert: newText },
          selection: {
            anchor: Math.max(from, sel.from - (sel.from === line.from ? TAB.length : 0)),
            head: Math.max(from, sel.to - lenDiff),
          },
        });
        break;
      }
      case "undo":
        undo(editorView);
        break;
      case "redo":
        redo(editorView);
        break;
      case "focus":
        editorView.focus();
        break;
      case "getValue":
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(
            JSON.stringify({
              type: "valueResponse",
              payload: editorView.state.doc.toString(),
            })
          );
        }
        break;
      default:
        break;
    }
  } catch (e) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "error", payload: String(e) }));
    }
  }
};

// RN calls __initCodeMirror(value, placeholder) after WebView loads (onLoadEnd).

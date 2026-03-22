/**
 * Entry that runs inside the WebView. Creates CodeMirror and bridges with React Native via postMessage.
 * Bundled by build-codemirror-editor.js and inlined into the HTML for offline use.
 */
const { EditorView, keymap } = require("@codemirror/view");
const { EditorState, StateField } = require("@codemirror/state");
const { defaultKeymap, indentWithTab, history, redo, undo } = require("@codemirror/commands");
const { markdown } = require("@codemirror/lang-markdown");
const { Decoration, ViewPlugin, WidgetType, BlockWrapper } = require("@codemirror/view");
const { syntaxTree } = require("@codemirror/language");

const TAB = "  ";

const mentionPlugin = ViewPlugin.fromClass(
  class {
    decorations;

    constructor(view) {
      this.decorations = this.getMentions(view);
    }

    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.getMentions(update.view);
      }
    }

    getMentions(view) {
      let widgets = [];
      const MENTION_REGEX = /(^|\s)(@[\w-]+)(?=\b|\s|$)/g;

      for (let { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to);
        let match;
        MENTION_REGEX.lastIndex = 0;
        
        while ((match = MENTION_REGEX.exec(text)) !== null) {
          const mSpace = match[1];
          const mTag = match[2];
          
          const matchStart = from + match.index + mSpace.length;
          const matchEnd = matchStart + mTag.length;
          
          widgets.push(Decoration.mark({ class: "cm-mention-tag" }).range(matchStart, matchEnd));
        }
      }
      return Decoration.set(widgets);
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

const hashtagPlugin = ViewPlugin.fromClass(
  class {
    decorations;

    constructor(view) {
      this.decorations = this.getHashtags(view);
    }

    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.getHashtags(update.view);
      }
    }

    getHashtags(view) {
      let widgets = [];
      const HASHTAG_REGEX = /(^|\s)(#[\w-]+)(?=\b|\s|$)/g;

      for (let { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to);
        let match;
        HASHTAG_REGEX.lastIndex = 0;
        
        while ((match = HASHTAG_REGEX.exec(text)) !== null) {
          const mSpace = match[1];
          const mTag = match[2];
          
          const matchStart = from + match.index + mSpace.length;
          const matchEnd = matchStart + mTag.length;
          
          widgets.push(Decoration.mark({ class: "cm-hashtag-tag" }).range(matchStart, matchEnd));
        }
      }
      return Decoration.set(widgets);
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

const CODE_BLOCK_NODES = new Set(["FencedCode", "CodeBlock"]);
const CODE_BLOCK_WRAPPER_CLASS = "code-block-wrapper";
const codeBlockWrapper = BlockWrapper.create({
  tagName: "div",
  attributes: { class: CODE_BLOCK_WRAPPER_CLASS },
});

const BLOCKQUOTE_WRAPPER_CLASS = "blockquote-wrapper";
const blockquoteWrapper = BlockWrapper.create({
  tagName: "div",
  attributes: { class: BLOCKQUOTE_WRAPPER_CLASS },
});

function getBlockWrappers(state) {
  const tree = syntaxTree(state);
  const ranges = [];
  tree.iterate({
    enter: (node) => {
      if (CODE_BLOCK_NODES.has(node.name)) {
        ranges.push({ from: node.from, to: node.to, value: codeBlockWrapper });
      } else if (node.name === "Blockquote") {
        const firstLine = state.doc.lineAt(node.from);
        const match = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.exec(firstLine.text);
        if (match) {
          const type = match[1].toLowerCase();
          const alertWrapper = BlockWrapper.create({
            tagName: "div",
            attributes: { class: `cm-alert cm-alert-${type}` },
          });
          ranges.push({ from: node.from, to: node.to, value: alertWrapper });
        } else {
          ranges.push({ from: node.from, to: node.to, value: blockquoteWrapper });
        }
      }
    },
  });
  if (ranges.length === 0) return BlockWrapper.set([]);
  return BlockWrapper.set(ranges, true);
}

const blockWrapperField = StateField.define({
  create(state) {
    return getBlockWrappers(state);
  },
  update(value, tr) {
    if (tr.docChanged) return getBlockWrappers(tr.state);
    return value;
  },
});

class AlertTitleWidget extends WidgetType {
  constructor(type) {
    super();
    this.type = type.toLowerCase();
  }
  eq(other) {
    return other.type === this.type;
  }
  toDOM() {
    const div = document.createElement("div");
    div.className = "cm-alert-title";
    let svg = "";
    if (this.type === "note") {
      svg = '<svg viewBox="0 0 24 24" width="16" height="16" class="lucide" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>';
    } else if (this.type === "tip") {
      svg = '<svg viewBox="0 0 24 24" width="16" height="16" class="lucide" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.9 1.2 1.5 1.5 2.5"></path><path d="M9 18h6"></path><path d="M10 22h4"></path></svg>';
    } else if (this.type === "important") {
      svg = '<svg viewBox="0 0 24 24" width="16" height="16" class="lucide" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><path d="M12 7v2"></path><path d="M12 13h.01"></path></svg>';
    } else if (this.type === "warning") {
      svg = '<svg viewBox="0 0 24 24" width="16" height="16" class="lucide" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>';
    } else if (this.type === "caution") {
      svg = '<svg viewBox="0 0 24 24" width="16" height="16" class="lucide" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    }
    div.innerHTML = svg + "<span>" + this.type.charAt(0).toUpperCase() + this.type.slice(1) + "</span>";
    return div;
  }
}

function getAlertTextDecorations(state) {
  const tree = syntaxTree(state);
  const decos = [];
  tree.iterate({
    enter: (node) => {
      if (node.name === "Blockquote") {
        const firstLine = state.doc.lineAt(node.from);
        const match = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.exec(firstLine.text);
        if (match) {
          decos.push({
            from: firstLine.from,
            to: firstLine.from + match[0].length,
            decoration: Decoration.replace({
              widget: new AlertTitleWidget(match[1]),
              inclusive: false
            })
          });
        }
      }
    }
  });
  if (decos.length === 0) return Decoration.none;
  return Decoration.set(decos.sort((a, b) => a.from - b.from).map(d => d.decoration.range(d.from, d.to)), true);
}

const alertTextPlugin = StateField.define({
  create(state) { return getAlertTextDecorations(state); },
  update(value, tr) {
    if (tr.docChanged) return getAlertTextDecorations(tr.state);
    return value.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

function getMathMarkers(state) {
  const text = state.doc.toString();
  const tree = syntaxTree(state);
  const decos = [];
  const deco = Decoration.mark({ class: "cm-math-marker" });

  const maskedChars = text.split("");
  tree.iterate({
    enter: (node) => {
      if (node.name === "InlineCode" || node.name === "FencedCode" || node.name === "CodeBlock") {
        for (let i = node.from; i < node.to; i++) {
          maskedChars[i] = "X";
        }
      }
    }
  });
  const maskedText = maskedChars.join("");

  const blockRegex = /\$\$[\s\S]*?\$\$/g;
  let match;
  while ((match = blockRegex.exec(maskedText)) !== null) {
    decos.push({ from: match.index, to: match.index + 2, decoration: deco });
    decos.push({ from: match.index + match[0].length - 2, to: match.index + match[0].length, decoration: deco });
  }

  if (decos.length === 0) return Decoration.none;
  return Decoration.set(decos.sort((a, b) => a.from - b.from).map(d => d.decoration.range(d.from, d.to)), true);
}

function getMarkHighlights(state) {
  const text = state.doc.toString();
  const tree = syntaxTree(state);
  const decos = [];
  const deco = Decoration.mark({ class: "cm-highlight" });

  const maskedChars = text.split("");
  tree.iterate({
    enter: (node) => {
      if (node.name === "InlineCode" || node.name === "FencedCode" || node.name === "CodeBlock") {
        for (let i = node.from; i < node.to; i++) {
          maskedChars[i] = "X";
        }
      }
    }
  });
  const maskedText = maskedChars.join("");

  const MARK_REGEX = /==([^ \s](?:[^]*?[^ \s])?)==/g;
  let match;
  const markerDeco = Decoration.mark({ class: "cm-math-marker" });
  while ((match = MARK_REGEX.exec(maskedText)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    
    // Delimiters
    decos.push({ from: start, to: start + 2, decoration: markerDeco });
    decos.push({ from: end - 2, to: end, decoration: markerDeco });
    // Content
    decos.push({ from: start + 2, to: end - 2, decoration: deco });
  }

  if (decos.length === 0) return Decoration.none;
  return Decoration.set(decos.sort((a, b) => a.from - b.from).map(d => d.decoration.range(d.from, d.to)), true);
}

const markHighlightPlugin = StateField.define({
  create(state) { return getMarkHighlights(state); },
  update(value, tr) {
    if (tr.docChanged) return getMarkHighlights(tr.state);
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const mathMarkerPlugin = StateField.define({
  create(state) { return getMathMarkers(state); },
  update(value, tr) {
    if (tr.docChanged) return getMathMarkers(tr.state);
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

function createEditor(container, initialValue, placeholder) {
  const state = EditorState.create({
    doc: initialValue || "",
    extensions: [
      markdown(),
      history(),
      mentionPlugin,
      hashtagPlugin,
      blockWrapperField,
      EditorView.blockWrappers.of((view) => view.state.field(blockWrapperField)),
      alertTextPlugin,
      mathMarkerPlugin,
      markHighlightPlugin,
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

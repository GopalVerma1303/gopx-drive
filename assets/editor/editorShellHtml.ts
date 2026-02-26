/**
 * Embedded HTML for the native CodeMirror editor WebView shell.
 * Loaded via source={{ html: EDITOR_SHELL_HTML }} so it works offline after first load (CDN inside).
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
  <script type="module">
    (async () => {
      const CDN = 'https://esm.sh/';
      const { EditorState } = await import(CDN + '@codemirror/state');
      const { EditorView, keymap } = await import(CDN + '@codemirror/view');
      const { defaultKeymap, history, historyKeymap } = await import(CDN + '@codemirror/commands');
      const { markdown, markdownLanguage } = await import(CDN + '@codemirror/lang-markdown');
      const { undo, redo } = await import(CDN + '@codemirror/history');

      let view = null;
      let themeExtension = null;

      function post(msg) {
        if (typeof window.ReactNativeWebView !== 'undefined') {
          window.ReactNativeWebView.postMessage(JSON.stringify(msg));
        }
      }

      function themeFromOptions(opts) {
        const bg = opts?.background || '#ffffff';
        const fg = opts?.foreground || '#000000';
        const sel = opts?.selection || '#cce4ff';
        const line = opts?.lineHighlight || '#f5f5f5';
        return EditorView.theme({
          '&': { color: fg, backgroundColor: bg },
          '.cm-content': { caretColor: fg },
          '&.cm-focused .cm-cursor': { borderLeftColor: fg },
          '&.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: sel },
          '.cm-activeLine': { backgroundColor: line },
        }, { dark: false });
      }

      function runCommand(cmd, args) {
        if (!view) return;
        const state = view.state;
        const dispatch = view.dispatch.bind(view);
        const range = state.selection.main;
        const from = range.from;
        const to = range.to;
        const doc = state.doc.toString();
        const selected = doc.slice(from, to);

        const commands = {
          ToggleBold: () => wrap('**', '**'),
          ToggleItalic: () => wrap('*', '*'),
          ToggleStrikethrough: () => wrap('~~', '~~'),
          ToggleInlineCode: () => wrap('\`', '\`'),
          ToggleHeading: () => insertAtLineStart('# '),
          ToggleBlockQuote: () => insertAtLineStart('> '),
          InsertLink: () => insertAt('[]()', from + 1),
          InsertImage: () => insertAt('![]()', from + 2),
          ToggleBulletList: () => insertAt('- ', from + 2),
          ToggleOrderedList: () => insertAt('1. ', from + 3),
          ToggleTaskList: () => insertAt('- [ ] ', from + 6),
          ToggleCodeBlock: () => insertAt('\`\`\`\n\n\`\`\`', from + 4),
          InsertTable: () => insertAt('| Col1 | Col2 |\n|------|------|\n|      |      |', from + 29),
          Undo: () => { undo(view); return true; },
          Redo: () => { redo(view); return true; },
          Indent: () => indent(),
          Outdent: () => outdent(),
        };

        function wrap(before, after) {
          const hasWrap = selected.startsWith(before) && selected.endsWith(after) && selected.length >= before.length + after.length;
          const next = hasWrap ? selected.slice(before.length, -after.length) : before + selected + after;
          const pos = hasWrap ? from + next.length : from + before.length + selected.length;
          dispatch({ changes: { from, to, insert: next }, selection: { anchor: pos, head: pos } });
          return true;
        }
        function insertAt(text, cursorPos) {
          dispatch({ changes: { from, to, insert: text }, selection: { anchor: cursorPos, head: cursorPos } });
          return true;
        }
        function insertAtLineStart(prefix) {
          const line = state.doc.lineAt(from);
          dispatch({ changes: { from: line.from, to: line.from, insert: prefix }, selection: { anchor: from + prefix.length, head: from + prefix.length } });
          return true;
        }
        function indent() {
          const lines = [];
          for (let line = state.doc.lineAt(from); line.from <= to; line = state.doc.lineAt(line.from + line.length + 1)) {
            if (line.from > to) break;
            lines.push({ from: line.from, insert: '  ' });
          }
          if (lines.length === 0) return false;
          const changes = lines.map(({ from: f, insert: i }) => ({ from: f, to: f, insert: i }));
          const insBeforeFrom = changes.filter(c => c.from < from).length * 2;
          const insBeforeTo = changes.filter(c => c.from < to).length * 2;
          dispatch({ changes, selection: { anchor: from + insBeforeFrom, head: to + insBeforeTo } });
          return true;
        }
        function outdent() {
          const changes = [];
          for (let line = state.doc.lineAt(from); line.from <= to; line = state.doc.lineAt(line.from + line.length + 1)) {
            if (line.from > to) break;
            const lineText = state.sliceDoc(line.from, line.to);
            const m = lineText.match(/^(\s{1,2}|\t)/);
            if (m) changes.push({ from: line.from, to: line.from + m[1].length, insert: '' });
          }
          if (changes.length === 0) return false;
          let newFrom = from, newTo = to;
          for (const c of changes) {
            const len = c.to - c.from;
            if (c.from + len <= from) newFrom -= len;
            else if (c.from < from) newFrom = c.from;
            if (c.from + len <= to) newTo -= len;
            else if (c.from < to) newTo = c.from + Math.max(0, to - c.from - len);
          }
          dispatch({ changes, selection: { anchor: Math.max(0, newFrom), head: Math.max(0, newTo) } });
          return true;
        }

        const fn = commands[cmd];
        if (fn) fn();
      }

      window.EditorBridge = {
        init(opts) {
          const text = opts?.text ?? '';
          const themeOpts = opts?.theme;
          themeExtension = themeFromOptions(themeOpts);
          const extensions = [
            history(),
            keymap.of([...defaultKeymap, ...historyKeymap]),
            markdown({ base: markdownLanguage, codeLanguages: [] }),
            themeExtension,
          ];
          const state = EditorState.create({ doc: text, extensions });
          const parent = document.getElementById('root');
          if (view) view.destroy();
          view = new EditorView({
            state,
            parent,
            dispatch(tr) {
              view.update([tr]);
              if (tr.docChanged) post({ type: 'change', text: view.state.doc.toString() });
              if (tr.selection) {
                const s = view.state.selection.main;
                post({ type: 'selectionChange', from: s.from, to: s.to });
              }
            },
          });
        },
        execCommand(cmd, args) {
          runCommand(cmd, args);
        },
      };

      window.EditorBridge.replaceRange = function(start, end, text) {
        if (!view) return;
        view.dispatch({ changes: { from: start, to: end, insert: text }, selection: { anchor: start + text.length, head: start + text.length } });
      };
      window.EditorBridge.insertText = function(args) {
        if (!view || !args) return;
        const { from, to, text, cursorPos } = args;
        const f = from ?? view.state.selection.main.from;
        const t = to ?? view.state.selection.main.to;
        const pos = cursorPos ?? f + (text?.length ?? 0);
        view.dispatch({ changes: { from: f, to: t, insert: text || '' }, selection: { anchor: pos, head: pos } });
      };
      window.EditorBridge.wrapSelection = function(args) {
        if (!view || !args) return;
        const { before, after, cursorOffset } = args;
        const r = view.state.selection.main;
        const doc = view.state.doc.toString();
        const selected = doc.slice(r.from, r.to);
        const next = before + selected + after;
        const pos = r.from + (cursorOffset ?? before.length);
        view.dispatch({ changes: { from: r.from, to: r.to, insert: next }, selection: { anchor: pos, head: pos } });
      };

      window.addEventListener('message', (e) => {
        try {
          const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (data.type === 'init') window.EditorBridge.init(data);
          if (data.type === 'execCommand') {
            const cmd = data.command;
            const args = data.args;
            if (cmd === 'ReplaceRange' && args) window.EditorBridge.replaceRange(args.start, args.end, args.text);
            else if (cmd === 'InsertText' && args) window.EditorBridge.insertText(args);
            else if (cmd === 'WrapSelection' && args) window.EditorBridge.wrapSelection(args);
            else window.EditorBridge.execCommand(cmd, args);
          }
        } catch (err) {}
      });

      post({ type: 'bridgeReady' });
    })();
  </script>
</body>
</html>
`.trim();

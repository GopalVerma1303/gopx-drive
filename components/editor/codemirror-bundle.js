// CodeMirror bundle for WebView
// This will be injected as a string into the WebView
// We'll use a CDN approach or bundle this separately

(function() {
  'use strict';

  // Check if CodeMirror is already loaded
  if (window.CodeMirror6) {
    return;
  }

  // For now, we'll use a simple textarea-based editor
  // In production, you'd bundle CodeMirror 6 and inject it here
  // This is a placeholder that will be replaced with actual CodeMirror setup

  window.editorApi = {
    init(parentElement, initialText, settings) {
      if (window.cmEditor) {
        console.warn('Editor already initialized');
        return;
      }

      // Create a simple textarea for now
      // TODO: Replace with actual CodeMirror 6 setup
      const textarea = document.createElement('textarea');
      textarea.value = initialText || '';
      textarea.style.width = '100%';
      textarea.style.height = '100%';
      textarea.style.border = 'none';
      textarea.style.outline = 'none';
      textarea.style.padding = '16px';
      textarea.style.fontSize = (settings?.fontSize || 16) + 'px';
      textarea.style.fontFamily = settings?.fontFamily || 'monospace';
      textarea.style.lineHeight = (settings?.lineHeight || 1.5).toString();
      textarea.style.backgroundColor = 'transparent';
      textarea.style.color = settings?.theme === 'dark' ? '#fafafa' : '#0a0a0a';
      textarea.style.resize = 'none';
      textarea.style.boxSizing = 'border-box';

      parentElement.appendChild(textarea);
      window.cmEditor = textarea;

      // Set up event listeners
      textarea.addEventListener('input', () => {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'event',
          eventType: 'change',
          payload: { kind: 'change', value: textarea.value }
        }));
      });

      textarea.addEventListener('scroll', () => {
        const scrollTop = textarea.scrollTop;
        const scrollHeight = textarea.scrollHeight - textarea.clientHeight;
        const fraction = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'event',
          eventType: 'scroll',
          payload: { kind: 'scroll', scrollFraction: fraction }
        }));
      });

      textarea.addEventListener('select', () => {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'event',
          eventType: 'selectionChange',
          payload: {
            kind: 'selectionChange',
            selection: { start: textarea.selectionStart, end: textarea.selectionEnd }
          }
        }));
      });

      return true;
    },

    updateSettings(settings) {
      if (!window.cmEditor) return;
      const textarea = window.cmEditor;
      textarea.style.fontSize = (settings?.fontSize || 16) + 'px';
      textarea.style.fontFamily = settings?.fontFamily || 'monospace';
      textarea.style.lineHeight = (settings?.lineHeight || 1.5).toString();
      textarea.style.color = settings?.theme === 'dark' ? '#fafafa' : '#0a0a0a';
    },

    insertText(text, cursorOffset) {
      if (!window.cmEditor) return;
      const textarea = window.cmEditor;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      const newValue = value.substring(0, start) + text + value.substring(end);
      textarea.value = newValue;
      const newCursor = start + text.length + (cursorOffset || 0);
      textarea.setSelectionRange(newCursor, newCursor);
      
      // Trigger input event
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    },

    wrapSelection(before, after, cursorOffset) {
      if (!window.cmEditor) return;
      const textarea = window.cmEditor;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = textarea.value.substring(start, end);
      const newText = before + selectedText + after;
      const value = textarea.value;
      const newValue = value.substring(0, start) + newText + value.substring(end);
      textarea.value = newValue;
      const newCursor = start + before.length + selectedText.length + (cursorOffset || 0);
      textarea.setSelectionRange(newCursor, newCursor);
      
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    },

    indent() {
      if (!window.cmEditor) return;
      const textarea = window.cmEditor;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const lines = textarea.value.split('\n');
      const startLine = textarea.value.substring(0, start).split('\n').length - 1;
      const endLine = textarea.value.substring(0, end).split('\n').length - 1;
      
      for (let i = startLine; i <= endLine; i++) {
        if (lines[i]) {
          lines[i] = '  ' + lines[i];
        }
      }
      
      textarea.value = lines.join('\n');
      textarea.setSelectionRange(start + 2, end + (endLine - startLine + 1) * 2);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    },

    outdent() {
      if (!window.cmEditor) return;
      const textarea = window.cmEditor;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const lines = textarea.value.split('\n');
      const startLine = textarea.value.substring(0, start).split('\n').length - 1;
      const endLine = textarea.value.substring(0, end).split('\n').length - 1;
      let removedChars = 0;
      
      for (let i = startLine; i <= endLine; i++) {
        if (lines[i] && lines[i].startsWith('  ')) {
          lines[i] = lines[i].substring(2);
          removedChars += 2;
        } else if (lines[i] && lines[i].startsWith('\t')) {
          lines[i] = lines[i].substring(1);
          removedChars += 1;
        }
      }
      
      textarea.value = lines.join('\n');
      const newStart = Math.max(0, start - 2);
      const newEnd = Math.max(0, end - removedChars);
      textarea.setSelectionRange(newStart, newEnd);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    },

    undo() {
      if (!window.cmEditor) return;
      document.execCommand('undo');
    },

    redo() {
      if (!window.cmEditor) return;
      document.execCommand('redo');
    },

    focus() {
      if (!window.cmEditor) return;
      window.cmEditor.focus();
    },

    getSelection() {
      if (!window.cmEditor) return { start: 0, end: 0 };
      return {
        start: window.cmEditor.selectionStart,
        end: window.cmEditor.selectionEnd
      };
    },

    updateBody(newBody) {
      if (!window.cmEditor) return;
      window.cmEditor.value = newBody;
      window.cmEditor.dispatchEvent(new Event('input', { bubbles: true }));
    },

    setScrollPercent(fraction) {
      if (!window.cmEditor) return;
      const textarea = window.cmEditor;
      const scrollHeight = textarea.scrollHeight - textarea.clientHeight;
      textarea.scrollTop = fraction * scrollHeight;
    },

    select(anchor, head) {
      if (!window.cmEditor) return;
      window.cmEditor.setSelectionRange(anchor, head);
    },
  };

  window.CodeMirror6 = true;
})();

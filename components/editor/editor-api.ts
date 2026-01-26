/**
 * Editor API
 * 
 * Provides the imperative handle API for controlling the editor from React.
 */

import { RefObject } from 'react';
import { WebViewControl } from './ExtendedWebView';

export interface CodeMirrorEditorRef {
  insertText: (text: string, cursorOffset?: number) => void;
  wrapSelection: (before: string, after: string, cursorOffset?: number) => void;
  indent: () => void;
  outdent: () => void;
  undo: () => void;
  redo: () => void;
  focus: () => void;
  getSelection: () => Promise<{ start: number; end: number }>;
}

/**
 * Create the imperative handle implementation
 */
export function createEditorApi(webviewRef: RefObject<WebViewControl | null>): CodeMirrorEditorRef {
  return {
    insertText(text: string, cursorOffset?: number) {
      const offset = cursorOffset ?? 0;
      // Explicitly ensure offset is a number, not a string in the template literal
      const numOffset = typeof offset === 'number' ? offset : parseFloat(String(offset)) || 0;
      webviewRef.current?.injectJS(
        `window.editorApi.insertText(${JSON.stringify(text)}, ${numOffset});`
      );
    },

    wrapSelection(before: string, after: string, cursorOffset?: number) {
      const offset = cursorOffset ?? 0;
      // Explicitly ensure offset is a number, not a string in the template literal
      const numOffset = typeof offset === 'number' ? offset : parseFloat(String(offset)) || 0;
      webviewRef.current?.injectJS(
        `window.editorApi.wrapSelection(${JSON.stringify(before)}, ${JSON.stringify(after)}, ${numOffset});`
      );
    },

    indent() {
      webviewRef.current?.injectJS('window.editorApi.indent();');
    },

    outdent() {
      webviewRef.current?.injectJS('window.editorApi.outdent();');
    },

    undo() {
      webviewRef.current?.injectJS('window.editorApi.undo();');
    },

    redo() {
      webviewRef.current?.injectJS('window.editorApi.redo();');
    },

    focus() {
      webviewRef.current?.injectJS('window.editorApi.focus();');
    },

    async getSelection() {
      return new Promise((resolve) => {
        const script = `
          (function() {
            const selection = window.editorApi.getSelection();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'selection',
              selection: selection
            }));
          })();
          true;
        `;
        webviewRef.current?.injectJS(script);
        // For now, return a promise that resolves immediately
        // In a real implementation, you'd wait for the response
        resolve({ start: 0, end: 0 });
      });
    },
  };
}

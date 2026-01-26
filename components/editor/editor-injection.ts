/**
 * Editor Injection Script
 * 
 * Generates the JavaScript code that initializes the editor in the WebView.
 */

import { EditorSettings } from './types';
import { createEditorBundle } from './editor-bundle';

export interface EditorInjectionOptions {
  value: string;
  editorSettings: EditorSettings;
  colors: {
    foreground?: string;
    primary?: string;
    mutedForeground?: string;
  };
  isDark: boolean;
}

/**
 * Generate the injected JavaScript code
 */
export function generateInjectedJavaScript(options: EditorInjectionOptions): string {
  const { value, editorSettings, colors, isDark } = options;

  // Safely stringify value with fallback
  let safeValue = '';
  try {
    safeValue = JSON.stringify(value || '');
  } catch (e) {
    console.warn('Failed to stringify value, using empty string');
    safeValue = '""';
  }

  const codemirrorBundle = createEditorBundle();

  return `${codemirrorBundle}
try {
  if (typeof window.ReactNativeWebView === 'undefined') {
    console.error('ReactNativeWebView is not available');
  } else {
    window.onerror = (message, source, lineno, colno, error) => {
      const errorDetails = {
        message: String(message),
        source: String(source || 'unknown'),
        lineno: lineno || 0,
        colno: colno || 0,
        stack: error?.stack || 'No stack trace',
        error: error?.toString() || 'Unknown error'
      };
      console.error('WebView error:', errorDetails);
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(
            "error: " + JSON.stringify(errorDetails)
          );
        }
      } catch (e) {
        // Fallback if JSON.stringify fails
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(
            "error: " + String(message) + " in " + String(source) + ":" + (lineno || 0)
          );
        }
      }
    };
    
    window.onunhandledrejection = (event) => {
      const errorDetails = {
        reason: String(event.reason || event),
        stack: event.reason?.stack || 'No stack trace',
        type: 'unhandledRejection'
      };
      console.error('WebView unhandled rejection:', errorDetails);
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(
            "error: " + JSON.stringify(errorDetails)
          );
        }
      } catch (e) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(
            "error: Unhandled promise rejection: " + String(event.reason || event)
          );
        }
      }
    };
    
    var initRetryCount = 0;
    var maxInitRetries = 20; // Max 1 second of retries (20 * 50ms)
    
    function initEditor() {
      try {
        // Prevent infinite retries
        if (initRetryCount >= maxInitRetries) {
          console.error('Max init retries reached');
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(
              "error: " + JSON.stringify({ type: 'initError', message: 'Max init retries reached' })
            );
          }
          return;
        }
        
        // Ensure document and window are available
        if (typeof document === 'undefined' || typeof window === 'undefined') {
          initRetryCount++;
          setTimeout(initEditor, 50);
          return;
        }
        
        const container = document.getElementById('editor-container');
        if (!container) {
          initRetryCount++;
          setTimeout(initEditor, 50);
          return;
        }
        if (!window.editorApi) {
          initRetryCount++;
          setTimeout(initEditor, 50);
          return;
        }
        
        // Reset retry count on successful initialization attempt
        initRetryCount = 0;
        // Explicitly construct settings object with numeric values as numbers (not JSON strings)
        // This prevents Android WebView bridge from trying to cast strings to doubles
        // Ensure values are valid numbers with fallbacks
        const fontSize = ${typeof editorSettings.fontSize === 'number' && !isNaN(editorSettings.fontSize) ? editorSettings.fontSize : 16};
        const lineHeight = ${typeof editorSettings.lineHeight === 'number' && !isNaN(editorSettings.lineHeight) ? editorSettings.lineHeight : 1.5};
        const backgroundColor = ${JSON.stringify(editorSettings.backgroundColor || (isDark ? '#262626' : '#f5f5f5'))};
        const foregroundColor = ${JSON.stringify(colors.foreground || (isDark ? '#fafafa' : '#0a0a0a'))};
        const primaryColor = ${JSON.stringify(colors.primary || '#3b82f6')};
        const mutedForegroundColor = ${JSON.stringify(colors.mutedForeground || (isDark ? '#888' : '#666'))};
        const settings = {
          fontSize: fontSize,
          lineHeight: lineHeight,
          theme: ${JSON.stringify(editorSettings.theme)},
          fontFamily: ${JSON.stringify(editorSettings.fontFamily)},
          spellcheck: ${editorSettings.spellcheck === true},
          backgroundColor: backgroundColor,
          foregroundColor: foregroundColor,
          primaryColor: primaryColor,
          mutedForegroundColor: mutedForegroundColor
        };
        const initialText = ${safeValue};
        const result = window.editorApi.init(container, initialText, settings);
        if (result) {
          window.editorReady = true;
        } else {
          console.error('Editor initialization returned false');
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(
              "error: " + JSON.stringify({ type: 'initError', message: 'Editor initialization returned false' })
            );
          }
        }
      } catch (error) {
        console.error('Error initializing editor:', error);
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(
            "error: " + JSON.stringify({
              type: 'initError',
              message: error?.message || String(error),
              stack: error?.stack || 'No stack trace'
            })
          );
        }
      }
    }
    
    // Wait for DOM to be ready
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEditor);
      } else {
        // Use setTimeout to ensure everything is initialized
        setTimeout(initEditor, 0);
      }
    } else {
      // Fallback: try again after a short delay
      setTimeout(function() {
        if (typeof document !== 'undefined') {
          initEditor();
        }
      }, 100);
    }
  }
} catch (error) {
  console.error('Fatal error in injected script:', error);
  if (typeof window !== 'undefined' && window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    try {
      window.ReactNativeWebView.postMessage(
        "error: " + JSON.stringify({
          type: 'fatalError',
          message: error?.message || String(error),
          stack: error?.stack || 'No stack trace'
        })
      );
    } catch (e) {
      // Last resort - can't even send error message
      console.error('Cannot send error message:', e);
    }
  }
}
true;
  `.trim();
}

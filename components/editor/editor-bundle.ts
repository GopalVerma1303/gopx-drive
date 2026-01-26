// @ts-nocheck
/**
 * Editor Bundle
 *
 * This file contains the JavaScript code that runs inside the WebView.
 * It provides the editor API and markdown highlighting functionality.
 *
 * Best Practices:
 * - Use template literals for code generation
 * - Properly escape special characters in strings
 * - Use IIFE to avoid global scope pollution
 * - Check for existing initialization to prevent re-initialization
 * - Use 'use strict' mode for better error catching
 *
 * Note: This file contains JavaScript code as template strings.
 * TypeScript type checking is disabled because the template strings contain
 * JavaScript code that will be executed in a WebView, not TypeScript.
 */

/**
 * Creates the markdown syntax highlighting function using CodeMirror's highlighting structure.
 * This implementation follows CodeMirror's markdown language specification and uses
 * the same highlighting tags as @codemirror/lang-markdown and @lezer/highlight.
 *
 * @returns {string} JavaScript code as a string to be injected into WebView
 */
export function createMarkdownHighlighter(): string {
  // @ts-ignore - Template string contains JavaScript code
  return `
    /**
     * Highlights markdown syntax using CodeMirror's highlighting structure
     * Uses the same tags as @codemirror/lang-markdown: heading, strong, emphasis, link, quote, monospace, etc.
     * @param {string} text - The markdown text to highlight
     * @param {boolean} isDark - Whether dark theme is active
     * @param {Object} colors - Color configuration object
     * @returns {string} HTML string with syntax highlighting using CodeMirror CSS classes
     */
    function highlightMarkdown(text, isDark, colors) {
      if (!text) return '';
      
      const foreground = colors?.foreground || (isDark ? '#fafafa' : '#0a0a0a');
      const primary = colors?.primary || '#3b82f6';
      const mutedForeground = colors?.mutedForeground || (isDark ? '#888' : '#666');
      const codeColor = isDark ? '#ff69b4' : '#d73a49';
      
      const lines = text.split('\\n');
      let html = '';
      let inCodeBlock = false;
      let codeBlockLang = '';
      
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        let lineHtml = '';
        
        const backtick = String.fromCharCode(96);
        const codeBlockMatch = line.match(new RegExp('^(\\\\s*)(' + backtick + backtick + backtick + ')(\\\\w*)?'));
        if (codeBlockMatch) {
          if (inCodeBlock) {
            // End of code block
            inCodeBlock = false;
            codeBlockLang = '';
            lineHtml += '<span class="cm-codeBlock">' + escapeHtml(line) + '</span>';
          } else {
            // Start of code block
            inCodeBlock = true;
            codeBlockLang = codeBlockMatch[3] || '';
            lineHtml += '<span class="cm-codeBlock">' + escapeHtml(line) + '</span>';
          }
          html += lineHtml;
          if (lineIdx < lines.length - 1) html += '\\n';
          continue;
        }
        
        // If inside code block, treat entire line as code - CodeMirror tag: monospace
        if (inCodeBlock) {
          lineHtml += '<span class="cm-monospace">' + escapeHtml(line) + '</span>';
          html += lineHtml;
          if (lineIdx < lines.length - 1) html += '\\n';
          continue;
        }
        
        // Headers (# ## ### #### ##### ######) - CodeMirror tags: heading, heading1-6
        const headerMatch = line.match(/^(#{1,6})\\s+(.+)$/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const headerText = headerMatch[2];
          // Use CodeMirror's heading classes: cm-heading, cm-heading1-6
          const headingClass = 'cm-heading cm-heading' + level;
          lineHtml += '<span class="' + headingClass + '">' + escapeHtml(headerMatch[1] + ' ') + '</span>';
          lineHtml += highlightInlineMarkdown(headerText, isDark, colors);
          html += lineHtml;
          if (lineIdx < lines.length - 1) html += '\\n';
          continue;
        }
        
        // Horizontal rules (--- or *** or ___) - CodeMirror tag: horizontalRule
        if (line.match(/^[-*_]{3,}\\s*$/)) {
          lineHtml += '<span class="cm-horizontalRule">' + escapeHtml(line) + '</span>';
          html += lineHtml;
          if (lineIdx < lines.length - 1) html += '\\n';
          continue;
        }
        
        // Blockquotes (>) - CodeMirror tag: quote
        if (line.match(/^>\\s/)) {
          lineHtml += '<span class="cm-quote">' + escapeHtml(line) + '</span>';
          html += lineHtml;
          if (lineIdx < lines.length - 1) html += '\\n';
          continue;
        }
        
        // List items (-, *, +, or numbered) - CodeMirror tag: list
        if (line.match(/^(\\s*)([-*+]|\\d+\\.)\\s/)) {
          const listMatch = line.match(/^(\\s*)([-*+]|\\d+\\.)\\s(.+)$/);
          if (listMatch) {
            lineHtml += '<span class="cm-list">' + escapeHtml(listMatch[1] + listMatch[2] + ' ') + '</span>';
            lineHtml += highlightInlineMarkdown(listMatch[3], isDark, colors);
          } else {
            lineHtml += highlightInlineMarkdown(line, isDark, colors);
          }
          html += lineHtml;
          if (lineIdx < lines.length - 1) html += '\\n';
          continue;
        }
        
        // Regular line - process inline markdown
        lineHtml += highlightInlineMarkdown(line, isDark, colors);
        html += lineHtml;
        if (lineIdx < lines.length - 1) html += '\\n';
      }
      
      return html;
    }
    
    /**
     * Highlights inline markdown syntax using CodeMirror's highlighting tags
     * Tags: strong, emphasis, link, monospace, strikethrough (from @lezer/highlight)
     * @param {string} text - The text to process
     * @param {boolean} isDark - Whether dark theme is active
     * @param {Object} colors - Color configuration object
     * @returns {string} HTML string with inline syntax highlighting using CodeMirror CSS classes
     */
    function highlightInlineMarkdown(text, isDark, colors) {
      if (!text) return '';
      
      const foreground = colors?.foreground || (isDark ? '#fafafa' : '#0a0a0a');
      const primary = colors?.primary || '#3b82f6';
      const codeColor = isDark ? '#ff69b4' : '#d73a49';
      
      let result = '';
      let pos = 0;
      const len = text.length;
      
      while (pos < len) {
        let matched = false;

        const backtick = String.fromCharCode(96);
        const codeMatch = text.substring(pos).match(new RegExp('^' + backtick + '([^' + backtick + ']+)' + backtick));
        if (codeMatch) {
          result += '<span class="cm-monospace">' + backtick + escapeHtml(codeMatch[1]) + backtick + '</span>';
          pos += codeMatch[0].length;
          matched = true;
          continue;
        }
        
        // Bold (**text** or __text__) - CodeMirror tag: strong
        const boldDoubleStar = text.substring(pos).match(/^\\*\\*([^*\\n]+?)\\*\\*/);
        const boldDoubleUnderscore = text.substring(pos).match(/^__([^_\\n]+?)__/);
        
        if (boldDoubleStar && boldDoubleStar[1].length > 0) {
          // Check if it's not actually part of a longer sequence (***text***)
          const beforeChar = pos > 0 ? text[pos - 1] : '';
          const afterPos = pos + boldDoubleStar[0].length;
          const afterChar = afterPos < len ? text[afterPos] : '';
          if (beforeChar !== '*' && afterChar !== '*') {
            result += '<span class="cm-strong">' + escapeHtml(boldDoubleStar[0]) + '</span>';
            pos += boldDoubleStar[0].length;
            matched = true;
            continue;
          }
        }
        
        if (!matched && boldDoubleUnderscore && boldDoubleUnderscore[1].length > 0) {
          // Check if it's not actually part of a longer sequence
          const beforeChar = pos > 0 ? text[pos - 1] : '';
          const afterPos = pos + boldDoubleUnderscore[0].length;
          const afterChar = afterPos < len ? text[afterPos] : '';
          if (beforeChar !== '_' && afterChar !== '_') {
            result += '<span class="cm-strong">' + escapeHtml(boldDoubleUnderscore[0]) + '</span>';
            pos += boldDoubleUnderscore[0].length;
            matched = true;
            continue;
          }
        }
        
        // Strikethrough (~~text~~) - CodeMirror tag: strikethrough
        const strikeMatch = text.substring(pos).match(/^~~([^~\\n]+?)~~/);
        if (strikeMatch && strikeMatch[1].length > 0) {
          result += '<span class="cm-strikethrough">' + escapeHtml(strikeMatch[0]) + '</span>';
          pos += strikeMatch[0].length;
          matched = true;
          continue;
        }
        
        // Links [text](url) or [text](url "title") - CodeMirror tag: link
        const linkMatch = text.substring(pos).match(/^\\[([^\\]]+)\\]\\(([^\\)]+)(?:\\s+"([^"]+)")?\\)/);
        if (linkMatch) {
          result += '<span class="cm-link">' + escapeHtml(linkMatch[0]) + '</span>';
          pos += linkMatch[0].length;
          matched = true;
          continue;
        }
        
        // Images ![alt](url) - CodeMirror tag: link
        const imageMatch = text.substring(pos).match(/^!\\[([^\\]]*)\\]\\(([^\\)]+)\\)/);
        if (imageMatch) {
          result += '<span class="cm-link">' + escapeHtml(imageMatch[0]) + '</span>';
          pos += imageMatch[0].length;
          matched = true;
          continue;
        }
        
        // Italic (*text* or _text_) - CodeMirror tag: emphasis
        if (!matched) {
          // Check for *text* pattern (single asterisk, not double)
          if (text[pos] === '*' && pos + 1 < len) {
            const beforeChar = pos > 0 ? text[pos - 1] : '';
            // Make sure it's not part of ** (bold)
            if (beforeChar !== '*') {
              const nextStar = text.indexOf('*', pos + 1);
              if (nextStar > pos + 1) {
                const afterChar = nextStar + 1 < len ? text[nextStar + 1] : '';
                // Make sure the closing * is not part of **
                if (afterChar !== '*') {
                  const italicText = text.substring(pos, nextStar + 1);
                  // Make sure there's actual content between the asterisks
                  if (italicText.length > 2) {
                    result += '<span class="cm-emphasis">' + escapeHtml(italicText) + '</span>';
                    pos = nextStar + 1;
                    matched = true;
                    continue;
                  }
                }
              }
            }
          }
          
          // Check for _text_ pattern (single underscore, not double)
          if (!matched && text[pos] === '_' && pos + 1 < len) {
            const beforeChar = pos > 0 ? text[pos - 1] : '';
            // Make sure it's not part of __ (bold)
            if (beforeChar !== '_') {
              const nextUnderscore = text.indexOf('_', pos + 1);
              if (nextUnderscore > pos + 1) {
                const afterChar = nextUnderscore + 1 < len ? text[nextUnderscore + 1] : '';
                // Make sure the closing _ is not part of __
                if (afterChar !== '_') {
                  const italicText = text.substring(pos, nextUnderscore + 1);
                  // Make sure there's actual content between the underscores
                  if (italicText.length > 2) {
                    result += '<span class="cm-emphasis">' + escapeHtml(italicText) + '</span>';
                    pos = nextUnderscore + 1;
                    matched = true;
                    continue;
                  }
                }
              }
            }
          }
        }
        
        // If no match, add the character
        if (!matched) {
          result += escapeHtml(text[pos]);
          pos++;
        }
      }
      
      return result;
    }
    
    /**
     * Escapes HTML special characters to prevent XSS attacks
     * @param {string} text - The text to escape
     * @returns {string} Escaped HTML string
     */
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  `;
}

/**
 * Creates the update highlight function that syncs the highlight layer with textarea content.
 *
 * @returns {string} JavaScript code as a string to be injected into WebView
 */
export function createUpdateHighlightFunction(): string {
  // @ts-ignore - Template string contains JavaScript code
  return `
    /**
     * Updates the syntax highlighting overlay to match the textarea content
     */
    function updateHighlight() {
      const textarea = document.getElementById('editor-textarea');
      const highlight = document.getElementById('editor-highlight');
      if (!textarea || !highlight) return;
      
      const text = textarea.value;
      const isDark = textarea.dataset.theme === 'dark';
      const colors = {
        foreground: textarea.dataset.foreground || (isDark ? '#fafafa' : '#0a0a0a'),
        primary: textarea.dataset.primary || '#3b82f6',
        mutedForeground: textarea.dataset.mutedForeground || (isDark ? '#888' : '#666')
      };
      
      highlight.innerHTML = highlightMarkdown(text, isDark, colors);
      
      // Sync scroll
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
    }
  `;
}

/**
 * Creates the editor API object that will be exposed to React Native.
 * This API provides methods for controlling the editor from the native side.
 *
 * @returns {string} JavaScript code as a string to be injected into WebView
 */
export function createEditorApi(): string {
  // @ts-ignore - Template string contains JavaScript code
  return `
    /**
     * Editor API exposed to React Native
     * All methods are designed to work with the WebView bridge
     */
    window.editorApi = {
      /**
       * Initializes the editor with the given settings
       * @param {HTMLElement} parentElement - The parent container element
       * @param {string} initialText - The initial text content
       * @param {Object} settings - Editor settings (theme, colors, etc.)
       * @returns {boolean} True if initialization was successful
       */
      init(parentElement, initialText, settings) {
        if (window.cmEditor) {
          console.warn('Editor already initialized');
          return false;
        }
        
        const textarea = document.getElementById('editor-textarea');
        const highlight = document.getElementById('editor-highlight');
        
        if (!textarea || !highlight) {
          console.error('Editor elements not found');
          return false;
        }
        
        const isDark = settings?.theme === 'dark';
        const bgColor = settings?.backgroundColor || (isDark ? '#262626' : '#f5f5f5');
        const fgColor = settings?.foregroundColor || (isDark ? '#fafafa' : '#0a0a0a');
        
        // Store settings in dataset for highlighting
        textarea.dataset.theme = isDark ? 'dark' : 'light';
        textarea.dataset.foreground = fgColor;
        textarea.dataset.primary = settings?.primaryColor || '#3b82f6';
        textarea.dataset.mutedForeground = settings?.mutedForegroundColor || (isDark ? '#888' : '#666');
        
        textarea.value = initialText || '';
        textarea.style.caretColor = fgColor;
        
        // Update highlight on input
        textarea.addEventListener('input', () => {
          updateHighlight();
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'event',
              eventType: 'change',
              payload: { kind: 'change', value: textarea.value }
            }));
          }
        });
        
        // Sync scroll
        textarea.addEventListener('scroll', () => {
          highlight.scrollTop = textarea.scrollTop;
          highlight.scrollLeft = textarea.scrollLeft;
        });
        
        // Initial highlight
        updateHighlight();
        
        // Track keyboard dismissal
        let lastBlurTime = 0;
        let isUserInteraction = false;
        const BLUR_COOLDOWN_MS = 500;
        
        const markUserInteraction = () => {
          isUserInteraction = true;
          setTimeout(() => { isUserInteraction = false; }, 100);
        };
        
        textarea.addEventListener('mousedown', markUserInteraction);
        textarea.addEventListener('touchstart', markUserInteraction);
        textarea.addEventListener('click', markUserInteraction);
        
        textarea.addEventListener('blur', () => {
          lastBlurTime = Date.now();
          isUserInteraction = false;
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'event',
              eventType: 'blur',
              payload: { kind: 'blur' }
            }));
          }
        });
        
        const originalFocus = textarea.focus.bind(textarea);
        textarea.focus = function() {
          const timeSinceBlur = Date.now() - lastBlurTime;
          if (timeSinceBlur >= BLUR_COOLDOWN_MS || isUserInteraction) {
            originalFocus();
          } else {
            console.log('Prevented auto-focus after blur');
          }
        };
        
        textarea.addEventListener('focus', () => {
          const timeSinceBlur = Date.now() - lastBlurTime;
          if (timeSinceBlur < BLUR_COOLDOWN_MS && !isUserInteraction) {
            setTimeout(() => {
              if (document.activeElement === textarea) {
                textarea.blur();
              }
            }, 10);
            return;
          }
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'event',
              eventType: 'focus',
              payload: { kind: 'focus' }
            }));
          }
        });
        
        window.cmEditor = textarea;
        return true;
      },
      
      /**
       * Updates editor settings (theme, colors, etc.)
       * @param {Object} settings - New settings object
       */
      updateSettings(settings) {
        const textarea = document.getElementById('editor-textarea');
        if (!textarea) return;
        
        const isDark = settings?.theme === 'dark';
        textarea.dataset.theme = isDark ? 'dark' : 'light';
        textarea.dataset.foreground = settings?.foregroundColor || (isDark ? '#fafafa' : '#0a0a0a');
        textarea.dataset.primary = settings?.primaryColor || '#3b82f6';
        textarea.dataset.mutedForeground = settings?.mutedForegroundColor || (isDark ? '#888' : '#666');
        textarea.style.caretColor = textarea.dataset.foreground;
        updateHighlight();
      },
      
      /**
       * Inserts text at the current cursor position
       * @param {string} text - Text to insert
       * @param {number} cursorOffset - Optional cursor offset after insertion
       */
      insertText(text, cursorOffset) {
        const textarea = document.getElementById('editor-textarea');
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        const newValue = value.substring(0, start) + text + value.substring(end);
        textarea.value = newValue;
        const numOffset = typeof cursorOffset === 'string' ? parseInt(cursorOffset, 10) : (cursorOffset || 0);
        const newCursor = start + text.length + numOffset;
        textarea.setSelectionRange(newCursor, newCursor);
        updateHighlight();
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      },
      
      /**
       * Wraps the current selection with before and after strings
       * @param {string} before - Text to insert before selection
       * @param {string} after - Text to insert after selection
       * @param {number} cursorOffset - Optional cursor offset after wrapping
       */
      wrapSelection(before, after, cursorOffset) {
        const textarea = document.getElementById('editor-textarea');
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        const newText = before + selectedText + after;
        const value = textarea.value;
        const newValue = value.substring(0, start) + newText + value.substring(end);
        textarea.value = newValue;
        const numOffset = typeof cursorOffset === 'string' ? parseInt(cursorOffset, 10) : (cursorOffset || 0);
        const newCursor = start + before.length + selectedText.length + numOffset;
        textarea.setSelectionRange(newCursor, newCursor);
        updateHighlight();
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      },
      
      /**
       * Indents the selected lines
       */
      indent() {
        const textarea = document.getElementById('editor-textarea');
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const lines = textarea.value.split('\\n');
        const startLine = textarea.value.substring(0, start).split('\\n').length - 1;
        const endLine = textarea.value.substring(0, end).split('\\n').length - 1;
        for (let i = startLine; i <= endLine; i++) {
          if (lines[i]) lines[i] = '  ' + lines[i];
        }
        textarea.value = lines.join('\\n');
        textarea.setSelectionRange(start + 2, end + (endLine - startLine + 1) * 2);
        updateHighlight();
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      },
      
      /**
       * Outdents (removes indentation from) the selected lines
       */
      outdent() {
        const textarea = document.getElementById('editor-textarea');
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const lines = textarea.value.split('\\n');
        const startLine = textarea.value.substring(0, start).split('\\n').length - 1;
        const endLine = textarea.value.substring(0, end).split('\\n').length - 1;
        let removedChars = 0;
        for (let i = startLine; i <= endLine; i++) {
          if (lines[i] && lines[i].startsWith('  ')) {
            lines[i] = lines[i].substring(2);
            removedChars += 2;
          } else if (lines[i] && lines[i].startsWith('\\t')) {
            lines[i] = lines[i].substring(1);
            removedChars += 1;
          }
        }
        textarea.value = lines.join('\\n');
        const newStart = Math.max(0, start - 2);
        const newEnd = Math.max(0, end - removedChars);
        textarea.setSelectionRange(newStart, newEnd);
        updateHighlight();
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      },
      
      /**
       * Undoes the last action
       */
      undo() {
        const textarea = document.getElementById('editor-textarea');
        if (!textarea) return;
        document.execCommand('undo');
        updateHighlight();
      },
      
      /**
       * Redoes the last undone action
       */
      redo() {
        const textarea = document.getElementById('editor-textarea');
        if (!textarea) return;
        document.execCommand('redo');
        updateHighlight();
      },
      
      /**
       * Focuses the editor
       */
      focus() {
        const textarea = document.getElementById('editor-textarea');
        if (textarea) textarea.focus();
      },
      
      /**
       * Gets the current selection range
       * @returns {{start: number, end: number}} Selection range
       */
      getSelection() {
        const textarea = document.getElementById('editor-textarea');
        if (!textarea) return { start: 0, end: 0 };
        return {
          start: Number(textarea.selectionStart),
          end: Number(textarea.selectionEnd)
        };
      },
      
      /**
       * Updates the entire editor content
       * @param {string} newBody - New text content
       */
      updateBody(newBody) {
        const textarea = document.getElementById('editor-textarea');
        if (!textarea) return;
        textarea.value = newBody || '';
        updateHighlight();
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      },
      
      /**
       * Sets the scroll position as a percentage
       * @param {number} fraction - Scroll fraction (0-1)
       */
      setScrollPercent(fraction) {
        const textarea = document.getElementById('editor-textarea');
        const highlight = document.getElementById('editor-highlight');
        if (!textarea || !highlight) return;
        const numFraction = typeof fraction === 'string' ? parseFloat(fraction) : (fraction || 0);
        const scrollHeight = textarea.scrollHeight - textarea.clientHeight;
        textarea.scrollTop = numFraction * scrollHeight;
        highlight.scrollTop = textarea.scrollTop;
      },
      
      /**
       * Sets the text selection range
       * @param {number} anchor - Selection anchor position
       * @param {number} head - Selection head position
       */
      select(anchor, head) {
        const textarea = document.getElementById('editor-textarea');
        if (!textarea) return;
        const numAnchor = typeof anchor === 'string' ? parseInt(anchor, 10) : (anchor || 0);
        const numHead = typeof head === 'string' ? parseInt(head, 10) : (head || 0);
        textarea.setSelectionRange(numAnchor, numHead);
      }
    };
  `;
}

/**
 * Creates the complete editor bundle that will be injected into the WebView.
 * This function combines all the individual pieces into a single IIFE (Immediately Invoked Function Expression)
 * to avoid polluting the global scope.
 *
 * Best Practices Applied:
 * - Uses IIFE to avoid global scope pollution
 * - Checks for existing initialization to prevent re-initialization
 * - Uses 'use strict' mode for better error catching
 * - Properly escapes template strings
 *
 * @returns {string} Complete JavaScript bundle as a string
 */
export function createEditorBundle(): string {
  const markdownHighlighter = createMarkdownHighlighter();
  const updateHighlightFn = createUpdateHighlightFunction();
  const editorApi = createEditorApi();

  // Use string concatenation to avoid TypeScript parsing issues with nested template strings
  return (
    `(function() {
  'use strict';
  
  // Prevent re-initialization if already loaded
  if (window.editorApi) {
    return;
  }
  
  ` +
    markdownHighlighter +
    `
  
  ` +
    updateHighlightFn +
    `
  
  ` +
    editorApi +
    `
  
  // Initialize when DOM is ready (if not already initialized)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      const textarea = document.getElementById('editor-textarea');
      const highlight = document.getElementById('editor-highlight');
      if (textarea && highlight) {
        // Elements are already in the DOM, ready to use
        // Editor will be initialized via window.editorApi.init() call
      }
    });
  }
})();`
  ).trim();
}

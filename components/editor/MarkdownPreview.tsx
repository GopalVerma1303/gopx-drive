import { useThemeColors } from '@/lib/use-theme-colors';
import { detectCheckboxInLine, toggleCheckboxInMarkdown } from '@/components/markdown-toolbar';
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { NativeSyntheticEvent } from 'react-native';
import { WebViewErrorEvent } from 'react-native-webview/lib/RNCWebViewNativeComponent';
import ExtendedWebView, { OnMessageEvent, WebViewControl } from './ExtendedWebView';

// Markdown-it bundle (simplified version for WebView)
// In production, this would be bundled separately or loaded from CDN
const markdownItBundle = `
(function() {
  'use strict';
  
  // Simple markdown parser (using a lightweight approach)
  // For production, consider using a CDN version of markdown-it
  const markdownItUrl = 'https://cdn.jsdelivr.net/npm/markdown-it@14.0.0/dist/markdown-it.min.js';
  
  if (window.markdownItLoaded) {
    return;
  }
  
  window.markdownItLoaded = false;
  window.markdownRenderer = null;
  
  // Load markdown-it from CDN
  function loadMarkdownIt(callback) {
    if (window.markdownit) {
      window.markdownRenderer = window.markdownit({
        html: true,
        linkify: true,
        typographer: true,
        breaks: true
      });
      window.markdownItLoaded = true;
      if (callback) callback();
      return;
    }
    
    const script = document.createElement('script');
    script.src = markdownItUrl;
    script.onload = function() {
      if (window.markdownit) {
        window.markdownRenderer = window.markdownit({
          html: true,
          linkify: true,
          typographer: true,
          breaks: true
        });
        window.markdownItLoaded = true;
        if (callback) callback();
      }
    };
    script.onerror = function() {
      console.error('Failed to load markdown-it');
      // Fallback: use simple regex-based markdown parser
      window.markdownRenderer = {
        render: function(text) {
          return simpleMarkdownRender(text);
        }
      };
      window.markdownItLoaded = true;
      if (callback) callback();
    };
    document.head.appendChild(script);
  }
  
  // Simple fallback markdown renderer
  function simpleMarkdownRender(text) {
    if (!text) return '';
    
    // Build regex patterns using string concatenation to avoid Babel parsing issues
    // Use character codes to avoid template literal parsing issues
    const backtickChar = String.fromCharCode(96);
    const codeBlockStart = backtickChar + backtickChar + backtickChar;
    const codeBlockEnd = codeBlockStart;
    const codeBlockPattern = codeBlockStart + '([\\s\\S]*?)' + codeBlockEnd;
    const codeBlockRegex = new RegExp(codeBlockPattern, 'gim');
    const inlineCodePattern = backtickChar + '(.+?)' + backtickChar;
    const inlineCodeRegex = new RegExp(inlineCodePattern, 'gim');
    
    let html = text
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\\*\\*(.+?)\\*\\*/gim, '<strong>$1</strong>')
      .replace(/__(.+?)__/gim, '<strong>$1</strong>')
      // Italic
      .replace(/\\*(.+?)\\*/gim, '<em>$1</em>')
      .replace(/_(.+?)_/gim, '<em>$1</em>')
      // Code blocks
      .replace(codeBlockRegex, '<pre><code>$1</code></pre>')
      // Inline code
      .replace(inlineCodeRegex, '<code>$1</code>')
      // Links
      .replace(/\\[([^\\]]+)\\]\\(([^\\)]+)\\)/gim, '<a href="$2">$1</a>')
      // Line breaks
      .replace(/\\n/gim, '<br>');
    
    // Wrap paragraphs
    const lines = html.split('<br>');
    html = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<h') || trimmed.startsWith('<pre') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol')) {
        return trimmed;
      }
      return '<p>' + trimmed + '</p>';
    }).join('');
    
    return html;
  }
  
  window.initMarkdownPreview = function(container, markdown, theme, colors, checkboxData) {
    if (!container) {
      console.error('Container not found');
      return;
    }
    
    loadMarkdownIt(function() {
      if (!window.markdownRenderer) {
        console.error('Markdown renderer not available');
        return;
      }
      
      // Pre-process markdown: replace checkbox patterns with unique HTML comments
      // HTML comments won't be processed by markdown-it and will be preserved in the output
      let processedMarkdown = markdown || '';
      const checkboxPlaceholders = [];
      
      if (checkboxData && checkboxData.length > 0) {
        const lines = processedMarkdown.split('\\n');
        checkboxData.forEach(function(checkboxItem) {
          const lineIndex = checkboxItem.lineIndex;
          const info = checkboxItem.info;
          if (lineIndex >= 0 && lineIndex < lines.length) {
            const line = lines[lineIndex];
            // Match checkbox pattern: [ ], [x], [X], [*]
            const checkboxPattern = /\\[\\s*[xX*]?\\s*\\]/;
            if (checkboxPattern.test(line)) {
              // Create unique HTML comment placeholder that markdown-it will preserve
              const placeholder = '<!-- CHECKBOX_' + lineIndex + '_' + (info.isChecked ? 'CHECKED' : 'UNCHECKED') + ' -->';
              checkboxPlaceholders.push({
                placeholder: placeholder,
                lineIndex: lineIndex,
                info: info
              });
              // Replace checkbox in the line with HTML comment placeholder
              lines[lineIndex] = line.replace(checkboxPattern, placeholder);
            }
          }
        });
        processedMarkdown = lines.join('\\n');
      }
      
      // Render markdown to HTML
      let html = window.markdownRenderer.render(processedMarkdown);
      
      // Replace placeholders with interactive checkboxes
      checkboxPlaceholders.forEach(function(item) {
        // Match the Checkbox component styling: green when checked, red when unchecked
        const checkboxColor = item.info.isChecked ? '#22c55e' : '#ef4444';
        const checkboxHtml = '<span class="markdown-checkbox-wrapper" data-line-index="' + item.lineIndex + '" style="' +
          'display: inline-flex; ' +
          'align-items: flex-start; ' +
          'margin-right: 8px; ' +
          'margin-top: 4.5px; ' +
          'cursor: pointer; ' +
          'user-select: none; ' +
          '-webkit-tap-highlight-color: transparent; ' +
          'vertical-align: top;' +
        '">' +
          '<span class="markdown-checkbox" style="' +
            'width: 16px; ' +
            'height: 16px; ' +
            'border-radius: 4px; ' +
            'border: 2px solid ' + checkboxColor + '; ' +
            'background-color: ' + (item.info.isChecked ? checkboxColor : 'transparent') + '; ' +
            'display: inline-flex; ' +
            'align-items: center; ' +
            'justify-content: center; ' +
            'flex-shrink: 0; ' +
            'transition: all 0.2s; ' +
            'box-sizing: border-box; ' +
            'flex: 0 0 auto;' +
          '">' +
          (item.info.isChecked ? '<span style="color: white; font-size: 12px; line-height: 1; font-weight: bold; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">✓</span>' : '') +
          '</span>' +
        '</span>';
        
        // Replace placeholder in HTML
        // Use split and join to avoid regex escaping issues in template literal
        const placeholderParts = item.placeholder.split('');
        const escapedParts = placeholderParts.map(function(char) {
          if ('[](){}*+?^$|.\\\\'.indexOf(char) !== -1) {
            return '\\\\' + char;
          }
          return char;
        });
        const escapedPattern = escapedParts.join('');
        html = html.replace(new RegExp(escapedPattern, 'g'), checkboxHtml);
      });
      
      // After replacing checkboxes, also add has-checkbox class to parent list items in the HTML string
      // This prevents the bullet from flashing by ensuring the class is in the HTML from the start
      // We'll do a simple string replacement to add the class to <li> tags that contain checkbox wrappers
      // This is a bit of a hack but ensures no flash
      html = html.replace(/<li([^>]*)>([^<]*<[^>]*markdown-checkbox-wrapper)/g, '<li$1 class="has-checkbox">$2');
      
      const backgroundColor = colors.muted || (theme === 'dark' ? '#262626' : '#f5f5f5');
      const foregroundColor = colors.foreground || (theme === 'dark' ? '#fafafa' : '#0a0a0a');
      const mutedForeground = colors.mutedForeground || (theme === 'dark' ? '#a3a3a3' : '#737373');
      const ringColor = colors.ring || (theme === 'dark' ? '#525252' : '#a3a3a3');
      
      const styleContent = '<style>' +
          '.markdown-content { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }' +
          '.markdown-content h1 { color: ' + foregroundColor + '; font-size: 32px; font-weight: bold; margin-top: 16px; margin-bottom: 8px; line-height: 32px; }' +
          '.markdown-content h2 { color: ' + foregroundColor + '; font-size: 28px; font-weight: bold; margin-top: 14px; margin-bottom: 7px; line-height: 28px; }' +
          '.markdown-content h3 { color: ' + foregroundColor + '; font-size: 24px; font-weight: 600; margin-top: 12px; margin-bottom: 6px; line-height: 24px; }' +
          '.markdown-content h4 { color: ' + foregroundColor + '; font-size: 20px; font-weight: 600; margin-top: 10px; margin-bottom: 5px; line-height: 20px; }' +
          '.markdown-content h5, .markdown-content h6 { color: ' + foregroundColor + '; font-size: 16px; font-weight: 600; margin-top: 8px; margin-bottom: 4px; }' +
          '.markdown-content p { color: ' + foregroundColor + '; font-size: 16px; line-height: 24px; margin-top: 8px; margin-bottom: 8px; }' +
          '.markdown-content strong { font-weight: bold; color: ' + foregroundColor + '; }' +
          '.markdown-content em { font-style: italic; color: ' + foregroundColor + '; }' +
          '.markdown-content code { color: #FF69B4; font-size: 14px; font-family: monospace; }' +
          '.markdown-content pre { background-color: ' + backgroundColor + '; color: ' + foregroundColor + '; font-size: 14px; padding: 12px; border-radius: 8px; margin-top: 8px; margin-bottom: 8px; font-family: monospace; border: 1px solid ' + ringColor + '; overflow-x: auto; }' +
          '.markdown-content pre code { background-color: transparent; padding: 0; color: ' + foregroundColor + '; border: none; }' +
          '.markdown-content blockquote { background-color: ' + backgroundColor + '; border-left: 4px solid ' + ringColor + '; padding-left: 16px; padding-right: 16px; padding-top: 8px; padding-bottom: 8px; margin-left: 0; margin-top: 8px; margin-bottom: 8px; border-radius: 4px; font-style: italic; color: ' + mutedForeground + '; }' +
          '.markdown-content ul, .markdown-content ol { margin-top: 8px; margin-bottom: 8px; padding-left: 24px; list-style: none; }' +
          '.markdown-content li { color: ' + foregroundColor + '; font-size: 16px; line-height: 24px; margin-top: 4px; margin-bottom: 4px; display: flex; align-items: flex-start; position: relative; padding-left: 0; }' +
          '.markdown-content li::before { content: "• "; margin-right: 8px; visibility: visible; }' +
          '.markdown-content li.has-checkbox::before { content: ""; margin-right: 0; visibility: hidden; width: 0; }' +
          '.markdown-content li .markdown-checkbox-wrapper { flex-shrink: 0; }' +
          '.markdown-content li > p, .markdown-content li > span:not(.markdown-checkbox-wrapper) { flex: 1; }' +
          '.markdown-content a { color: #3b82f6; text-decoration: underline; }' +
          '.markdown-content hr { background-color: ' + ringColor + '; height: 1px; margin-top: 16px; margin-bottom: 16px; border: none; }' +
          '.markdown-content img { max-width: 100%; height: auto; margin-top: 16px; margin-bottom: 16px; }' +
          '.markdown-content table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 8px; }' +
          '.markdown-content table th, .markdown-content table td { border: 1px solid ' + ringColor + '; padding: 8px; text-align: left; }' +
          '.markdown-content table th { background-color: ' + backgroundColor + '; font-weight: bold; }' +
          '.markdown-checkbox-wrapper { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }' +
          '.markdown-checkbox-wrapper:active .markdown-checkbox { transform: scale(0.95); }' +
        '</style>';
      
      container.innerHTML = '<div class="markdown-content" style="' +
        'padding: 32px; ' +
        'padding-top: 20px; ' +
        'padding-bottom: 80px; ' +
        'background-color: ' + backgroundColor + '; ' +
        'color: ' + foregroundColor + '; ' +
        'font-size: 16px; ' +
        'line-height: 24px; ' +
        'min-height: 100%;' +
        '">' +
        html +
        '</div>' +
        styleContent;
      
      // Immediately add has-checkbox class to list items with checkboxes (synchronously, no delay)
      // This prevents the bullet from flashing
      const checkboxes = container.querySelectorAll('.markdown-checkbox-wrapper');
      checkboxes.forEach(function(checkbox) {
        // Add class to parent list item to hide bullet immediately
        const listItem = checkbox.closest('li');
        if (listItem) {
          listItem.classList.add('has-checkbox');
        }
      });
      
      // Add click handlers for checkboxes (can be async, but class addition is synchronous)
      setTimeout(function() {
        checkboxes.forEach(function(checkbox) {
          // Add click handler
          checkbox.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const lineIndex = parseInt(checkbox.getAttribute('data-line-index') || '0', 10);
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'checkboxToggle',
                lineIndex: lineIndex
              }));
            }
          });
        });
      }, 0);
    });
  };
  
  window.updateMarkdownPreview = function(markdown, theme, colors, checkboxData) {
    const container = document.getElementById('markdown-preview-container');
    if (container && window.markdownItLoaded) {
      // Use the same init function which handles checkbox class addition synchronously
      window.initMarkdownPreview(container, markdown, theme, colors, checkboxData);
    }
  };
})();
`;

interface MarkdownPreviewProps {
  value: string;
  placeholder?: string;
  onChangeText?: (text: string) => void;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  value,
  placeholder = 'Start writing in markdown...',
  onChangeText,
}) => {
  const { colors, isDark } = useThemeColors();
  const webviewRef = React.useRef<WebViewControl>(null);
  const [isReady, setIsReady] = React.useState(false);

  // Pre-process markdown to extract checkbox information
  const checkboxData = useMemo(() => {
    const lines = value.split('\n');
    const checkboxLines: Array<{
      lineIndex: number;
      info: { hasCheckbox: boolean; isChecked: boolean; prefix: string; restText: string; fullMatch: string }
    }> = [];

    lines.forEach((line, index) => {
      const checkboxInfo = detectCheckboxInLine(line);
      if (checkboxInfo?.hasCheckbox) {
        checkboxLines.push({ lineIndex: index, info: checkboxInfo });
      }
    });

    return checkboxLines;
  }, [value]);

  // Helper function to toggle checkbox
  const toggleCheckbox = React.useCallback((lineIndex: number) => {
    if (!onChangeText) return;
    const newValue = toggleCheckboxInMarkdown(value, lineIndex);
    if (newValue !== value) {
      onChangeText(newValue);
    }
  }, [value, onChangeText]);

  // Update preview when value changes
  React.useEffect(() => {
    if (isReady && webviewRef.current) {
      const safeValue = JSON.stringify(value || '');
      const theme = isDark ? 'dark' : 'light';
      const colorsJson = JSON.stringify({
        muted: colors.muted || (isDark ? '#262626' : '#f5f5f5'),
        foreground: colors.foreground || (isDark ? '#fafafa' : '#0a0a0a'),
        mutedForeground: colors.mutedForeground || (isDark ? '#a3a3a3' : '#737373'),
        ring: colors.ring || (isDark ? '#525252' : '#a3a3a3'),
      });
      const checkboxDataJson = JSON.stringify(checkboxData);
      
      const updateScript = `
        (function() {
          const markdown = ${safeValue};
          const theme = ${JSON.stringify(theme)};
          const colors = ${colorsJson};
          const checkboxData = ${checkboxDataJson};
          if (window.updateMarkdownPreview) {
            window.updateMarkdownPreview(markdown, theme, colors, checkboxData);
          }
        })();
        true;
      `;
      
      webviewRef.current.injectJS(updateScript);
    }
  }, [value, isDark, colors, checkboxData, isReady]);

  // Generate HTML
  const html = useMemo(
    () => {
      const backgroundColor = colors.muted || (isDark ? '#262626' : '#f5f5f5');
      return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
          <title>Markdown Preview</title>
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
              overflow: auto;
              -webkit-overflow-scrolling: touch;
              background-color: ${backgroundColor};
            }
            #markdown-preview-container {
              width: 100%;
              min-height: 100%;
              background-color: ${backgroundColor};
            }
          </style>
        </head>
        <body>
          <div id="markdown-preview-container"></div>
        </body>
      </html>
    `;
    },
    [colors.muted, isDark]
  );

  // Generate CSS
  const css = useMemo(
    () => {
      const backgroundColor = colors.muted || (isDark ? '#262626' : '#f5f5f5');
      return `
        body {
          background-color: ${backgroundColor};
        }
        #markdown-preview-container {
          background-color: ${backgroundColor};
        }
      `;
    },
    [colors.muted, isDark]
  );

  // Injected JavaScript
  const injectedJavaScript = useMemo(() => {
    const safeValue = JSON.stringify(value || '');
    const theme = isDark ? 'dark' : 'light';
    const colorsJson = JSON.stringify({
      muted: colors.muted || (isDark ? '#262626' : '#f5f5f5'),
      foreground: colors.foreground || (isDark ? '#fafafa' : '#0a0a0a'),
      mutedForeground: colors.mutedForeground || (isDark ? '#a3a3a3' : '#737373'),
      ring: colors.ring || (isDark ? '#525252' : '#a3a3a3'),
    });
    const checkboxDataJson = JSON.stringify(checkboxData);

    return `
      ${markdownItBundle}
      
      (function() {
        try {
          var initRetryCount = 0;
          var maxInitRetries = 20;
          
          function initPreview() {
            if (initRetryCount >= maxInitRetries) {
              console.error('Max init retries reached for markdown preview');
              return;
            }
            
            if (typeof document === 'undefined' || typeof window === 'undefined') {
              initRetryCount++;
              setTimeout(initPreview, 50);
              return;
            }
            
            const container = document.getElementById('markdown-preview-container');
            if (!container) {
              initRetryCount++;
              setTimeout(initPreview, 50);
              return;
            }
            
            if (typeof window.initMarkdownPreview === 'undefined') {
              initRetryCount++;
              setTimeout(initPreview, 50);
              return;
            }
            
            initRetryCount = 0;
            const markdown = ${safeValue};
            const theme = ${JSON.stringify(theme)};
            const colors = ${colorsJson};
            
            if (!markdown || markdown.trim() === '') {
              container.innerHTML = \`
                <div style="
                  padding: 32px;
                  padding-top: 20px;
                  padding-bottom: 80px;
                  background-color: \${colors.muted};
                  color: \${colors.mutedForeground};
                  font-style: italic;
                  font-size: 16px;
                ">
                  ${placeholder}
                </div>
              \`;
              return;
            }
            
            const checkboxData = ${JSON.stringify(checkboxData)};
            window.initMarkdownPreview(container, markdown, theme, colors, checkboxData);
          }
          
          if (typeof document !== 'undefined') {
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', initPreview);
            } else {
              setTimeout(initPreview, 0);
            }
          } else {
            setTimeout(function() {
              if (typeof document !== 'undefined') {
                initPreview();
              }
            }, 100);
          }
        } catch (error) {
          console.error('Fatal error in markdown preview script:', error);
        }
      })();
      true;
    `;
  }, [value, isDark, colors, placeholder, checkboxData]);

  // Handle messages from WebView
  const onMessage = React.useCallback((event: OnMessageEvent) => {
    const data = event.nativeEvent.data;
    
    if (typeof data === 'string' && data.indexOf('error:') === 0) {
      try {
        const errorJson = data.substring(6);
        const errorDetails = JSON.parse(errorJson);
        console.error('MarkdownPreview WebView error:', errorDetails);
      } catch {
        console.error('MarkdownPreview WebView error:', data);
      }
      return;
    }
    
    // Handle checkbox toggle messages
    try {
      const message = JSON.parse(data);
      if (message.type === 'checkboxToggle' && typeof message.lineIndex === 'number') {
        toggleCheckbox(message.lineIndex);
      }
    } catch (error) {
      // Not a JSON message, ignore
    }
  }, [toggleCheckbox]);

  // Handle WebView load
  const onLoadEnd = React.useCallback(() => {
    setIsReady(true);
  }, []);

  // Handle errors
  const onError = React.useCallback((event: NativeSyntheticEvent<WebViewErrorEvent>) => {
    console.error(`MarkdownPreview WebView load error: Code ${event.nativeEvent.code}: ${event.nativeEvent.description}`);
  }, []);

  return (
    <ExtendedWebView
      ref={webviewRef}
      webviewInstanceId="MarkdownPreview"
      testID="MarkdownPreview"
      scrollEnabled={true}
      html={html}
      css={css}
      injectedJavaScript={injectedJavaScript}
      onMessage={onMessage}
      onLoadEnd={onLoadEnd}
      onError={onError}
      allowFileAccessFromJs={true}
    />
  );
};

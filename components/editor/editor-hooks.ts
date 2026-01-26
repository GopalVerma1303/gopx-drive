/**
 * Editor Hooks
 * 
 * Custom React hooks for editor functionality.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { NativeSyntheticEvent } from 'react-native';
import { WebViewErrorEvent } from 'react-native-webview/lib/RNCWebViewNativeComponent';
import { OnMessageEvent } from './ExtendedWebView';
import { EditorEvent, EditorSettings } from './types';
import { generateEditorHtml } from './editor-html';
import { generateInjectedJavaScript } from './editor-injection';

export interface UseEditorSettingsOptions {
  isDark: boolean;
  colors: {
    muted?: string;
    foreground?: string;
    primary?: string;
    mutedForeground?: string;
  };
}

/**
 * Hook to generate editor settings
 */
export function useEditorSettings(options: UseEditorSettingsOptions): EditorSettings {
  const { isDark, colors } = options;

  return useMemo(
    () => ({
      theme: isDark ? 'dark' : 'light',
      fontSize: 16,
      fontFamily: 'monospace',
      lineHeight: 1.5,
      spellcheck: true,
      backgroundColor: colors.muted || (isDark ? '#262626' : '#f5f5f5'),
    }),
    [isDark, colors.muted]
  );
}

export interface UseEditorHtmlOptions {
  colors: {
    muted?: string;
    foreground?: string;
    primary?: string;
    mutedForeground?: string;
  };
  isDark: boolean;
}

/**
 * Hook to generate editor HTML
 */
export function useEditorHtml(options: UseEditorHtmlOptions): string {
  const { colors, isDark } = options;

  return useMemo(() => {
    const backgroundColor = colors.muted || (isDark ? '#262626' : '#f5f5f5');
    const foregroundColor = colors.foreground || (isDark ? '#fafafa' : '#0a0a0a');
    const primaryColor = colors.primary || '#3b82f6';
    const mutedForegroundColor = colors.mutedForeground || (isDark ? '#888' : '#666');

    return generateEditorHtml({
      backgroundColor,
      foregroundColor,
      primaryColor,
      mutedForegroundColor,
      isDark,
    });
  }, [colors.muted, colors.foreground, colors.mutedForeground, colors.primary, isDark]);
}

export interface UseEditorInjectionOptions {
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
 * Hook to generate injected JavaScript
 */
export function useEditorInjection(options: UseEditorInjectionOptions): string {
  const { value, editorSettings, colors, isDark } = options;

  return useMemo(
    () =>
      generateInjectedJavaScript({
        value,
        editorSettings,
        colors,
        isDark,
      }),
    [value, editorSettings, colors, isDark]
  );
}

export interface UseEditorMessageHandlerOptions {
  onChangeText: (text: string) => void;
  lastValueRef: React.MutableRefObject<string>;
}

/**
 * Hook to handle messages from WebView
 */
export function useEditorMessageHandler(
  options: UseEditorMessageHandlerOptions
): (event: OnMessageEvent) => void {
  const { onChangeText, lastValueRef } = options;

  return useCallback(
    (event: OnMessageEvent) => {
      const data = event.nativeEvent.data;

      if (typeof data === 'string' && data.indexOf('error:') === 0) {
        // Try to parse error details if it's JSON, otherwise log as-is
        try {
          const errorJson = data.substring(6); // Remove "error: " prefix
          const errorDetails = JSON.parse(errorJson);
          console.error('CodeMirror WebView error:', errorDetails);
        } catch {
          // Not JSON, log as string
          console.error('CodeMirror WebView error:', data);
        }
        return;
      }

      try {
        const message = JSON.parse(data);
        if (message.type === 'event') {
          const event = message.payload as EditorEvent;
          if (event.kind === 'change' && event.value !== undefined) {
            if (event.value !== lastValueRef.current) {
              lastValueRef.current = event.value;
              onChangeText(event.value);
            }
          }
        }
      } catch (error) {
        console.error('Error parsing WebView message:', error);
      }
    },
    [onChangeText, lastValueRef]
  );
}

/**
 * Hook to handle WebView errors
 */
export function useEditorErrorHandler(): (event: NativeSyntheticEvent<WebViewErrorEvent>) => void {
  return useCallback((event: NativeSyntheticEvent<WebViewErrorEvent>) => {
    console.error(
      `WebView load error: Code ${event.nativeEvent.code}: ${event.nativeEvent.description}`
    );
  }, []);
}

export interface UseEditorUpdateOptions {
  value: string;
  isReady: boolean;
  webviewRef: React.RefObject<{ injectJS: (script: string) => void } | null>;
  lastValueRef: React.MutableRefObject<string>;
}

/**
 * Hook to update editor when value changes externally
 */
export function useEditorUpdate(options: UseEditorUpdateOptions): void {
  const { value, isReady, webviewRef, lastValueRef } = options;

  useEffect(() => {
    if (isReady && value !== lastValueRef.current && webviewRef.current) {
      lastValueRef.current = value;
      webviewRef.current.injectJS(`window.editorApi.updateBody(${JSON.stringify(value)});`);
    }
  }, [value, isReady, webviewRef, lastValueRef]);
}

export interface UseEditorSettingsUpdateOptions {
  editorSettings: EditorSettings;
  isReady: boolean;
  isDark: boolean;
  colors: {
    foreground?: string;
    primary?: string;
    mutedForeground?: string;
  };
  webviewRef: React.RefObject<{ injectJS: (script: string) => void } | null>;
}

/**
 * Hook to update editor settings when theme changes
 */
export function useEditorSettingsUpdate(options: UseEditorSettingsUpdateOptions): void {
  const { editorSettings, isReady, isDark, colors, webviewRef } = options;

  useEffect(() => {
    if (isReady && webviewRef.current) {
      // Write numeric values directly as number literals (not strings) to avoid Android casting errors
      // Ensure values are valid numbers with fallbacks
      const fontSize =
        typeof editorSettings.fontSize === 'number' && !isNaN(editorSettings.fontSize)
          ? editorSettings.fontSize
          : 16;
      const lineHeight =
        typeof editorSettings.lineHeight === 'number' && !isNaN(editorSettings.lineHeight)
          ? editorSettings.lineHeight
          : 1.5;
      const backgroundColor = editorSettings.backgroundColor || (isDark ? '#262626' : '#f5f5f5');
      const foregroundColor = colors.foreground || (isDark ? '#fafafa' : '#0a0a0a');
      const primaryColor = colors.primary || '#3b82f6';
      const mutedForegroundColor = colors.mutedForeground || (isDark ? '#888' : '#666');

      webviewRef.current.injectJS(
        `(function() {
          const settings = {
            fontSize: ${fontSize},
            lineHeight: ${lineHeight},
            theme: ${JSON.stringify(editorSettings.theme)},
            fontFamily: ${JSON.stringify(editorSettings.fontFamily)},
            spellcheck: ${editorSettings.spellcheck === true},
            backgroundColor: ${JSON.stringify(backgroundColor)},
            foregroundColor: ${JSON.stringify(foregroundColor)},
            primaryColor: ${JSON.stringify(primaryColor)},
            mutedForegroundColor: ${JSON.stringify(mutedForegroundColor)}
          };
          window.editorApi.updateSettings(settings);
        })();`
      );
    }
  }, [editorSettings, isReady, colors, isDark, webviewRef]);
}

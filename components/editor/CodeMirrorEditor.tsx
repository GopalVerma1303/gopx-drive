import { useThemeColors } from '@/lib/use-theme-colors';
import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import ExtendedWebView, { WebViewControl } from './ExtendedWebView';
import { EditorMessenger } from './messaging';
import { MarkdownPreview } from './MarkdownPreview';
import { createEditorApi, CodeMirrorEditorRef } from './editor-api';
import {
  useEditorSettings,
  useEditorHtml,
  useEditorInjection,
  useEditorMessageHandler,
  useEditorErrorHandler,
  useEditorUpdate,
  useEditorSettingsUpdate,
} from './editor-hooks';

interface CodeMirrorEditorProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  className?: string;
  isPreview?: boolean;
}

export type { CodeMirrorEditorRef };

export const CodeMirrorEditor = React.forwardRef<CodeMirrorEditorRef, CodeMirrorEditorProps>(
  function CodeMirrorEditor(
    { value, onChangeText, placeholder = 'Start writing in markdown...', className, isPreview = false },
    ref
  ) {
    const { colors, isDark } = useThemeColors();
    const webviewRef = useRef<WebViewControl>(null);
    const messengerRef = useRef<EditorMessenger | null>(null);
    const [isReady, setIsReady] = useState(false);
    const lastValueRef = useRef<string>(value);

    // Initialize messenger
    useEffect(() => {
      if (webviewRef.current) {
        messengerRef.current = new EditorMessenger(webviewRef);
      }
    }, []);

    // Editor settings
    const editorSettings = useEditorSettings({ isDark, colors });

    // Generate HTML
    const html = useEditorHtml({ colors, isDark });

    // Generate CSS (empty string as CSS is now in HTML)
    const css = '';

    // Injected JavaScript
    const injectedJavaScript = useEditorInjection({
      value,
      editorSettings,
      colors: {
        foreground: colors.foreground,
        primary: colors.primary,
        mutedForeground: colors.mutedForeground,
      },
      isDark,
    });

    // Handle messages from WebView
    const onMessage = useEditorMessageHandler({
      onChangeText,
      lastValueRef,
    });

    // Handle WebView load
    const onLoadEnd = () => {
      setIsReady(true);
    };

    // Handle errors
    const onError = useEditorErrorHandler();

    // Expose editor control API
    useImperativeHandle(ref, () => createEditorApi(webviewRef), []);

    // Update editor when value changes externally
    useEditorUpdate({
      value,
      isReady,
      webviewRef,
      lastValueRef,
    });

    // Update settings when theme changes
    useEditorSettingsUpdate({
      editorSettings,
      isReady,
      isDark,
      colors: {
        foreground: colors.foreground,
        primary: colors.primary,
        mutedForeground: colors.mutedForeground,
      },
      webviewRef,
    });

    // Preview mode: use MarkdownPreview component
    if (isPreview) {
      return (
        <MarkdownPreview
          value={value}
          placeholder={placeholder}
          onChangeText={onChangeText}
        />
      );
    }

    // Editor mode: use WebView with textarea
    return (
      <ExtendedWebView
        ref={webviewRef}
        webviewInstanceId="CodeMirrorEditor"
        testID="CodeMirrorEditor"
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
  }
);

CodeMirrorEditor.displayName = 'CodeMirrorEditor';

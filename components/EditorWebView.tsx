"use client";

import type { MarkdownEditorRef } from "@/components/markdown-editor/types";
import { EDITOR_SHELL_HTML } from "@/assets/editor/editorShellHtml";
import { EDITOR_BUNDLE } from "@/assets/editor/editorBundle.generated";
import * as FileSystem from "expo-file-system";
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

const WebView =
  Platform.OS === "web"
    ? null
    : require("react-native-webview").WebView;

// RCA: Android keyboard/cursor dismiss is caused by (1) WebView source switching after first
// paint (inline html → file URI) which triggers reload and focus loss; (2) injectedJavaScript
// with file:// can run before DOM is ready. Fix: Android uses a single stable source (file://
// only, rendered after file is ready) and we inject the editor bundle in onLoadEnd so it runs
// once after DOM is ready; we never change source after the WebView is shown.

export interface EditorWebViewProps {
  value: string;
  onChangeText?: (text: string) => void;
  onSelectionChange?: (selection: { start: number; end: number }) => void;
  theme?: {
    background: string;
    foreground: string;
    selection?: string;
    lineHighlight?: string;
  };
}

function postMessage(webViewRef: React.RefObject<any>, msg: object) {
  const script = `window.postMessage(${JSON.stringify(msg)}, '*'); true;`;
  webViewRef.current?.injectJavaScript?.(script);
}

export const EditorWebView = forwardRef<MarkdownEditorRef, EditorWebViewProps>(
  function EditorWebView({ value, onChangeText, onSelectionChange, theme = {} }, ref) {
    const webViewRef = useRef<any>(null);
    const [bridgeReady, setBridgeReady] = useState(false);
    const [fileSourceUri, setFileSourceUri] = useState<string | null>(null);
    const [readAccessUrl, setReadAccessUrl] = useState<string | null>(null);
    const [androidUseInlineFallback, setAndroidUseInlineFallback] = useState(false);
    const [reloadCounter, setReloadCounter] = useState(0);
    const lastSelectionRef = useRef({ start: 0, end: 0 });
    const lastValueRef = useRef<string>(value);
    /** Last value we pushed to the WebView (init or setValue). Stops us re-sending stale content when parent re-renders without updating (e.g. Android ref-based typing). */
    const lastSentValueRef = useRef<string>(value);
    const initSentRef = useRef(false);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingChangeRef = useRef<string | null>(null);
    const onChangeTextRef = useRef(onChangeText);
    onChangeTextRef.current = onChangeText;

    const sendInit = useCallback(() => {
      if (!bridgeReady || initSentRef.current) return;
      initSentRef.current = true;
      lastSentValueRef.current = value;
      postMessage(webViewRef, {
        type: "init",
        text: value,
        theme: {
          background: theme.background ?? "#ffffff",
          foreground: theme.foreground ?? "#000000",
          selection: theme.selection ?? "#cce4ff",
          lineHighlight: theme.lineHighlight ?? "#f5f5f5",
        },
      });
    }, [bridgeReady, value, theme]);

    React.useEffect(() => {
      if (bridgeReady) {
        initSentRef.current = false;
        sendInit();
      }
    }, [bridgeReady, sendInit]);

    // Android: write shell HTML to file once; we only ever render WebView with this URI (no source switch).
    React.useEffect(() => {
      if (Platform.OS !== "android") return;
      let cancelled = false;

      async function ensureHtmlFile() {
        try {
          const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
          if (!baseDir) {
            if (!cancelled) setAndroidUseInlineFallback(true);
            return;
          }
          const htmlPath = `${baseDir}editor-webview-shell.html`;
          await FileSystem.writeAsStringAsync(htmlPath, EDITOR_SHELL_HTML, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          if (cancelled) return;
          setReadAccessUrl(baseDir);
          setFileSourceUri(`${htmlPath}?r=${Math.round(Math.random() * 100000000)}`);
        } catch (_) {
          if (!cancelled) setAndroidUseInlineFallback(true);
        }
      }

      void ensureHtmlFile();
      return () => {
        cancelled = true;
      };
    }, []);

    // Sync external value changes (e.g. note loaded, switch note) into the WebView. Only push when parent actually gave us new content (value !== lastSentValueRef), not when re-rendering with stale content (e.g. Android ref-based typing).
    React.useEffect(() => {
      if (!bridgeReady || initSentRef.current !== true) return;
      if (value === lastSentValueRef.current) return;
      lastSentValueRef.current = value;
      lastValueRef.current = value;
      postMessage(webViewRef, { type: "setValue", text: value });
    }, [bridgeReady, value]);

    const handleMessage = useCallback(
      (e: { nativeEvent: { data: string } }) => {
        try {
          const data = JSON.parse(e.nativeEvent.data);
          switch (data.type) {
            case "bridgeReady":
              setBridgeReady(true);
              break;
            case "bridgeError":
              if (__DEV__) console.warn("[EditorWebView] bridgeError", data.message);
              break;
            case "change":
              lastValueRef.current = data.text;
              pendingChangeRef.current = data.text;
              // Debounce parent updates so re-renders don't steal focus / dismiss keyboard on Android
              if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
              debounceTimerRef.current = setTimeout(() => {
                debounceTimerRef.current = null;
                const text = pendingChangeRef.current;
                if (text !== null) {
                  pendingChangeRef.current = null;
                  onChangeTextRef.current?.(text);
                }
              }, 150);
              break;
            case "selectionChange":
              lastSelectionRef.current = { start: data.from, end: data.to };
              onSelectionChange?.({ start: data.from, end: data.to });
              break;
          }
        } catch (_) {}
      },
      [onChangeText, onSelectionChange]
    );

    React.useEffect(() => () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      const text = pendingChangeRef.current;
      if (text !== null) {
        pendingChangeRef.current = null;
        onChangeTextRef.current?.(text);
      }
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        insertText: (text: string, cursorOffset?: number) => {
          const { start, end } = lastSelectionRef.current;
          const newCursor = start + (cursorOffset ?? text.length);
          postMessage(webViewRef, {
            type: "execCommand",
            command: "InsertText",
            args: { text, from: start, to: end, cursorPos: newCursor },
          });
        },
        wrapSelection: (before: string, after: string, cursorOffset?: number) => {
          postMessage(webViewRef, {
            type: "execCommand",
            command: "WrapSelection",
            args: { before, after, cursorOffset },
          });
        },
        indent: () => {
          postMessage(webViewRef, { type: "execCommand", command: "Indent", args: null });
        },
        outdent: () => {
          postMessage(webViewRef, { type: "execCommand", command: "Outdent", args: null });
        },
        undo: () => {
          postMessage(webViewRef, { type: "execCommand", command: "Undo", args: null });
        },
        redo: () => {
          postMessage(webViewRef, { type: "execCommand", command: "Redo", args: null });
        },
        canUndo: () => true,
        canRedo: () => true,
        focus: () => {
          webViewRef.current?.focus?.();
        },
        getSelection: () => lastSelectionRef.current,
        replaceRange: (start: number, end: number, text: string) => {
          postMessage(webViewRef, {
            type: "execCommand",
            command: "ReplaceRange",
            args: { start, end, text },
          });
        },
      }),
      []
    );

    if (Platform.OS === "web" || !WebView) {
      return <View style={styles.placeholder} />;
    }

    const isAndroid = Platform.OS === "android";
    const androidUsingFile = isAndroid && fileSourceUri !== null;
    const androidReady = !isAndroid || fileSourceUri !== null || androidUseInlineFallback;

    const source =
      androidUsingFile
        ? { uri: fileSourceUri! }
        : { html: EDITOR_SHELL_HTML, baseUrl: "about:blank" as const };

    const bundleScript =
      "try { " +
      EDITOR_BUNDLE +
      " } catch (e) { typeof window !== 'undefined' && window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'bridgeError', message: (e && (e.message || String(e))) || 'Unknown' })); } true;";

    const injectEditorOnLoadEnd = useCallback(() => {
      if (!webViewRef.current?.injectJavaScript) return;
      webViewRef.current.injectJavaScript(bundleScript);
    }, []);

    if (isAndroid && !androidReady) {
      return <View style={styles.container} collapsable={false} />;
    }

    return (
      <View style={styles.container} collapsable={false}>
        <WebView
          ref={webViewRef}
          key={`editor-webview-${reloadCounter}`}
          source={source}
          injectedJavaScript={androidUsingFile ? "" : bundleScript}
          onLoadEnd={androidUsingFile ? injectEditorOnLoadEnd : undefined}
          onMessage={handleMessage}
          onRenderProcessGone={() => setReloadCounter((c: number) => c + 1)}
          onContentProcessDidTerminate={() => setReloadCounter((c: number) => c + 1)}
          onError={(e) => {
            if (__DEV__) {
              console.warn("[EditorWebView] onError", e.nativeEvent?.description);
            }
          }}
          onHttpError={(e) => {
            if (__DEV__) {
              console.warn("[EditorWebView] onHttpError", e.nativeEvent?.statusCode, e.nativeEvent?.url);
            }
          }}
          style={styles.webview}
          scrollEnabled={true}
          useWebKit={true}
          setSupportMultipleWindows={true}
          hideKeyboardAccessoryView={true}
          keyboardDisplayRequiresUserAction={false}
          originWhitelist={["file://*", "about:srcdoc", "http://*", "https://*", "*"]}
          allowingReadAccessToURL={readAccessUrl ?? undefined}
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 200 },
  webview: { flex: 1 },
  placeholder: { flex: 1 },
});

"use client";

import type { MarkdownEditorRef } from "@/components/markdown-editor/types";
import { EDITOR_SHELL_HTML } from "@/assets/editor/editorShellHtml";
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

const WebView =
  Platform.OS === "web"
    ? null
    : require("react-native-webview").WebView;

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
    const lastSelectionRef = useRef({ start: 0, end: 0 });
    const lastValueRef = useRef<string>(value);
    const initSentRef = useRef(false);

    const sendInit = useCallback(() => {
      if (!bridgeReady || initSentRef.current) return;
      initSentRef.current = true;
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

    const handleMessage = useCallback(
      (e: { nativeEvent: { data: string } }) => {
        try {
          const data = JSON.parse(e.nativeEvent.data);
          switch (data.type) {
            case "bridgeReady":
              setBridgeReady(true);
              break;
            case "change":
              lastValueRef.current = data.text;
              onChangeText?.(data.text);
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

    return (
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ html: EDITOR_SHELL_HTML, baseUrl: "about:blank" }}
          onMessage={handleMessage}
          style={styles.webview}
          scrollEnabled={true}
          keyboardDisplayRequiresUserAction={false}
          originWhitelist={["*"]}
          javaScriptEnabled={true}
          domStorageEnabled={true}
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

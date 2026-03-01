"use client";

import {
  getCodeMirrorWebViewInjectCss,
  getMarkdownThemeFromPalette,
} from "@/lib/markdown-theme";
import { useThemeColors } from "@/lib/use-theme-colors";
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Dimensions, Platform, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";

import { CODEMIRROR_EDITOR_HTML } from "./editor-html.generated";

export interface CodeMirrorEditorHandle {
  setSelection: (start: number, end: number) => void;
  focus: () => void;
  /** Get current editor content (for flushing before switching to preview). Returns a promise that resolves with the WebView textarea value. */
  getValueAsync?: () => Promise<string>;
}

interface CodeMirrorWebViewProps {
  value: string;
  onChangeText?: (text: string) => void;
  /** Called with raw content when WebView sends a change. Use to keep parent state in sync (e.g. setContent). */
  onContentSync?: (text: string) => void;
  onSelectionChange?: (selection: { start: number; end: number }) => void;
  placeholder?: string;
  style?: any;
}

export const CodeMirrorWebView = React.forwardRef<CodeMirrorEditorHandle, CodeMirrorWebViewProps>(
  function CodeMirrorWebView(
    { value, onChangeText, onContentSync, onSelectionChange, placeholder },
    ref
  ) {
    const webViewRef = useRef<WebView>(null);
    const [loaded, setLoaded] = useState(false);
    const { colors } = useThemeColors();
    /** Resolve for the pending getValueAsync() call when we receive valueResponse from WebView. */
    const pendingGetValueRef = useRef<((v: string) => void) | null>(null);
    /** Last value we sent to or received from the editor. Used to only push parent→WebView when value changed externally. */
    const lastSyncedValueRef = useRef<string>(value);
    /** Refs so we always use latest value/callbacks when WebView loads or sends messages (avoids stale closures). */
    const valueRef = useRef<string>(value);
    const onChangeTextRef = useRef(onChangeText);
    const onContentSyncRef = useRef(onContentSync);
    valueRef.current = value;
    onChangeTextRef.current = onChangeText;
    onContentSyncRef.current = onContentSync;

    const inject = useCallback((script: string) => {
      webViewRef.current?.injectJavaScript(script);
    }, []);

    const sendToEditor = useCallback(
      (type: string, payload?: any) => {
        const msgStr = JSON.stringify({ type, payload: payload ?? {} });
        inject(`window.__receiveFromRN && window.__receiveFromRN(${JSON.stringify(msgStr)}); true;`);
      },
      [inject]
    );

    const getValueAsync = useCallback((): Promise<string> => {
      return new Promise((resolve) => {
        pendingGetValueRef.current = resolve;
        sendToEditor("getValue");
        // Timeout fallback: if WebView doesn't respond (e.g. not loaded), resolve with current value
        setTimeout(() => {
          if (pendingGetValueRef.current) {
            pendingGetValueRef.current = null;
            resolve(valueRef.current);
          }
        }, 500);
      });
    }, [sendToEditor]);

    useImperativeHandle(
      ref,
      () => ({
        setSelection: (start: number, end: number) => {
          sendToEditor("setSelection", { start, end });
        },
        focus: () => {
          sendToEditor("focus", {});
        },
        getValueAsync,
      }),
      [sendToEditor, getValueAsync]
    );

    const theme = getMarkdownThemeFromPalette(colors);
    const injectTheme = useCallback(() => {
      const styleContent = getCodeMirrorWebViewInjectCss(theme);
      inject(
        `(function(){ var s = document.getElementById('rn-cm-theme'); if (!s) { s = document.createElement('style'); s.id = 'rn-cm-theme'; document.documentElement.appendChild(s); } s.textContent = ${JSON.stringify(styleContent)}; })(); true;`
      );
    }, [inject, theme.foreground, theme.background, theme.muted, theme.link, theme.codeBackground, theme.blockquoteBorder]);

    // Init editor when WebView loads. Use a short delay so the WebView's script has run, then set initial value, theme, and mark loaded.
    const onLoadEnd = useCallback(() => {
      const initDelay = 50;
      setTimeout(() => {
        const initialValue = valueRef.current;
        lastSyncedValueRef.current = initialValue;
        inject(
          `window.__initCodeMirror && window.__initCodeMirror(${JSON.stringify(initialValue)}, ${JSON.stringify(placeholder || "")}); true;`
        );
        injectTheme();
        setLoaded(true);
      }, initDelay);
    }, [placeholder, inject, injectTheme]);

    // Re-inject theme when light/dark changes
    useEffect(() => {
      if (loaded) injectTheme();
    }, [loaded, injectTheme]);

    // Sync value from parent → WebView when it changed externally (note load, refresh, undo, toolbar). Skip when value matches what we last synced.
    useEffect(() => {
      if (!loaded) return;
      if (value === lastSyncedValueRef.current) return;
      lastSyncedValueRef.current = value;
      sendToEditor("setValue", value);
    }, [loaded, value, sendToEditor]);

    const onMessage = useCallback(
      (event: { nativeEvent: { data: string } }) => {
        try {
          const data = event.nativeEvent?.data;
          if (data == null || typeof data !== "string") return;
          const msg = JSON.parse(data);
          if (msg.type === "change" && msg.payload != null) {
            const newValue = msg.payload.value;
            if (typeof newValue === "string") {
              lastSyncedValueRef.current = newValue;
              onChangeTextRef.current?.(newValue);
              onContentSyncRef.current?.(newValue);
            }
            if (msg.payload.selection && onSelectionChange) {
              onSelectionChange(msg.payload.selection);
            }
          } else if (msg.type === "valueResponse" && msg.payload !== undefined) {
            const resolve = pendingGetValueRef.current;
            pendingGetValueRef.current = null;
            resolve?.(typeof msg.payload === "string" ? msg.payload : String(msg.payload ?? ""));
          } else if (msg.type === "selectionChange" && msg.payload && onSelectionChange) {
            onSelectionChange(msg.payload);
          }
        } catch (_) { }
      },
      [onSelectionChange]
    );

    if (Platform.OS === "web") return null;

    const windowHeight = Dimensions.get("window").height;
    const minEditorHeight = Math.max(300, Math.round(windowHeight * 0.5));

    return (
      <View style={[styles.container, { minHeight: minEditorHeight }]}>
        <WebView
          ref={webViewRef}
          source={{ html: CODEMIRROR_EDITOR_HTML }}
          style={[styles.webview, { minHeight: minEditorHeight, backgroundColor: theme.muted ?? theme.background }]}
          scrollEnabled={true}
          nestedScrollEnabled={true}
          keyboardDisplayRequiresUserAction={false}
          onMessage={onMessage}
          onLoadEnd={onLoadEnd}
          originWhitelist={["*"]}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 200,
  },
  webview: {
    flex: 1,
  },
});

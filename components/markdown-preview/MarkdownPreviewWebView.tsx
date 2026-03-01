"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";
import { useThemeColors } from "@/lib/use-theme-colors";
import type { PreviewThemeColors } from "./preview-styles";
import { getPreviewFullHtml } from "./getPreviewHtml";

interface MarkdownPreviewWebViewProps {
  html: string;
  contentContainerStyle?: object;
}

export function MarkdownPreviewWebView({ html, contentContainerStyle }: MarkdownPreviewWebViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [loaded, setLoaded] = useState(false);
  const colors = useThemeColors();
  const theme: PreviewThemeColors = {
    foreground: colors.foreground,
    muted: colors.muted,
    mutedForeground: colors.mutedForeground,
    ring: colors.ring,
    background: colors.background,
  };

  // Use stable empty shell so WebView doesn't reload when html changes; we update content via inject only.
  const initialHtml = useRef<string | null>(null);
  if (initialHtml.current === null) {
    initialHtml.current = getPreviewFullHtml("", theme);
  }
  const sourceHtml = initialHtml.current;

  const injectContent = useCallback(
    (bodyHtml: string) => {
      if (Platform.OS === "web") return;
      const escaped = JSON.stringify(bodyHtml || "");
      const script = `(function(){ var html = ${escaped}; var el = document.getElementById('content'); if(el) el.innerHTML = html; })(); true;`;
      webViewRef.current?.injectJavaScript(script);
    },
    []
  );

  useEffect(() => {
    if (!loaded) return;
    injectContent(html || "");
  }, [loaded, html, injectContent]);

  const onLoadEnd = useCallback(() => {
    setLoaded(true);
    injectContent(html || "");
  }, [html, injectContent]);

  return (
    <View style={[styles.container, { backgroundColor: colors.muted }, contentContainerStyle]}>
      <WebView
        ref={webViewRef}
        source={{ html: sourceHtml }}
        onLoadEnd={onLoadEnd}
        style={[styles.webview, { backgroundColor: "transparent" }]}
        scrollEnabled
        showsVerticalScrollIndicator
        originWhitelist={["*"]}
        javaScriptEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: "100%", height: "100%", minHeight: 200 },
  webview: { flex: 1, width: "100%", height: "100%" },
});

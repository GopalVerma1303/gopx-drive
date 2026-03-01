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
  const { colors } = useThemeColors();
  const theme: PreviewThemeColors = {
    foreground: colors.foreground,
    muted: colors.muted,
    mutedForeground: colors.mutedForeground,
    ring: colors.ring,
    background: colors.background,
    link: colors.link,
    linkUrl: colors.linkUrl,
    codeBackground: colors.codeBackground,
    blockquoteBorder: colors.blockquoteBorder,
  };

  // Use stable empty shell so WebView doesn't reload when html changes; we update content via inject only.
  const initialHtml = useRef<string | null>(null);
  if (initialHtml.current === null) {
    initialHtml.current = getPreviewFullHtml("", theme);
  }
  const sourceHtml = initialHtml.current;

  // When theme changes, inject CSS override so preview colors update without full reload
  useEffect(() => {
    if (!loaded || Platform.OS === "web") return;
    const css = `.markdown-preview{color:${theme.foreground}!important;background:transparent!important}.markdown-preview h1,.markdown-preview h2,.markdown-preview h3,.markdown-preview h4,.markdown-preview h5,.markdown-preview h6,.markdown-preview p,.markdown-preview li,.markdown-preview strong,.markdown-preview em{color:${theme.foreground}!important}.markdown-preview code{color:${theme.foreground}!important;background:${colors.codeBackground ?? "rgba(128,128,128,0.15)"}!important}.markdown-preview pre{background:${theme.muted}!important;color:${theme.foreground}!important;border-color:${theme.ring}!important}.markdown-preview blockquote{color:${theme.foreground}!important;border-left-color:${colors.blockquoteBorder ?? "rgba(128,128,128,0.5)"}!important}.markdown-preview a{color:${colors.link ?? "#0969da"}!important}.markdown-preview table,.markdown-preview th,.markdown-preview td{border-color:${theme.ring}!important;color:${theme.foreground}!important}.markdown-preview th{background:${theme.muted}!important}.markdown-preview hr{background:${theme.ring}!important}.markdown-preview .preview-placeholder{color:${theme.mutedForeground}!important}`;
    const script = `(function(){var s=document.getElementById('preview-theme-override');if(!s){s=document.createElement('style');s.id='preview-theme-override';document.head.appendChild(s);}s.textContent=${JSON.stringify(css)};})(); true;`;
    webViewRef.current?.injectJavaScript(script);
  }, [loaded, theme.foreground, theme.muted, theme.mutedForeground, theme.ring, theme.background, colors.link, colors.codeBackground, colors.blockquoteBorder]);

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
    <View style={[styles.container, { backgroundColor: theme.muted }, contentContainerStyle]}>
      <WebView
        ref={webViewRef}
        source={{ html: sourceHtml }}
        onLoadEnd={onLoadEnd}
        style={[styles.webview, { backgroundColor: "transparent" }]}
        scrollEnabled={true}
        nestedScrollEnabled={true}
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

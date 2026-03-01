"use client";

import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useThemeColors } from "@/lib/use-theme-colors";
import type { PreviewThemeColors } from "./preview-styles";
import { getPreviewCss } from "./preview-styles";

interface MarkdownPreviewWebProps {
  html: string;
  contentContainerStyle?: object;
  className?: string;
}

export function MarkdownPreviewWeb({
  html,
  contentContainerStyle,
  className,
}: MarkdownPreviewWebProps) {
  const colors = useThemeColors();
  const theme: PreviewThemeColors = {
    foreground: colors.foreground,
    muted: colors.muted,
    mutedForeground: colors.mutedForeground,
    ring: colors.ring,
    background: colors.background,
  };
  const css = getPreviewCss(theme);

  if (!html) {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.contentBase, contentContainerStyle]}
      >
        <View className={className} />
      </ScrollView>
    );
  }

  /* contentContainerStyle has no horizontal padding so scrollbar sits at edge; padding is on .markdown-preview in CSS */
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.contentBase, contentContainerStyle]}
      removeClippedSubviews={false}
      nestedScrollEnabled
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div
        className={`markdown-preview ${className ?? ""}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  contentBase: {
    flexGrow: 1,
    minHeight: "100%",
  },
});

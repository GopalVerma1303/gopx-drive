import { useThemeColors } from "@/lib/use-theme-colors";
import React, { useMemo } from "react";
import { Platform, ScrollView, View } from "react-native";
import RNSyntaxHighlighter from "react-native-syntax-highlighter";
// Use full CJS index path for Metro bundler compatibility
// The index file exports named exports
import { atomOneDark, atomOneLight } from "react-syntax-highlighter/dist/cjs/styles/hljs";

interface SyntaxHighlighterProps {
  code: string;
  language?: string;
  style?: any;
}

export function SyntaxHighlighter({ code, language, style }: SyntaxHighlighterProps) {
  const { colors, isDark } = useThemeColors();

  // Select theme based on dark/light mode
  const highlightStyle = useMemo(() => {
    return isDark ? atomOneDark : atomOneLight;
  }, [isDark]);

  // Normalize language name (handle aliases and common variations)
  const normalizedLanguage = useMemo(() => {
    if (!language) return undefined;

    const lang = language.toLowerCase().trim();
    const languageAliases: Record<string, string> = {
      js: "javascript",
      ts: "typescript",
      py: "python",
      sh: "bash",
      zsh: "shell",
      yaml: "yaml",
      yml: "yaml",
      md: "markdown",
      jsonc: "json",
    };

    return languageAliases[lang] || lang;
  }, [language]);

  // Custom style to match app theme
  const customStyle = useMemo(
    () => ({
      backgroundColor: colors.muted,
      padding: 0,
      ...style,
    }),
    [colors.muted, style]
  );

  if (!code) {
    return null;
  }

  // Wrap in View for React Native to ensure proper rendering
  // Use "highlightjs" (library default) instead of "hljs" for better compatibility
  // Explicitly set PreTag and CodeTag to ScrollView (library default) to avoid HTML tag issues
  const content = (
    <RNSyntaxHighlighter
      language={normalizedLanguage}
      style={highlightStyle}
      customStyle={customStyle}
      highlighter="highlightjs"
      fontFamily="monospace"
      fontSize={14}
      PreTag={Platform.OS === "web" ? undefined : ScrollView}
      CodeTag={Platform.OS === "web" ? undefined : ScrollView}
    >
      {code}
    </RNSyntaxHighlighter>
  );

  // On native, wrap in View to ensure proper container
  if (Platform.OS !== "web") {
    return <View style={{ flex: 1 }}>{content}</View>;
  }

  return content;
}

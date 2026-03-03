import { useColorScheme } from "nativewind";

/** Editor and preview semantic colors (links, code, blockquote) for theme-responsive rendering. */
export const editorPreviewColors = {
  light: {
    background: "#ffffff",
    foreground: "#0a0a0a",
    muted: "#f5f5f5",
    mutedForeground: "#737373",
    ring: "#a3a3a3",
    link: "#0969da",
    linkUrl: "#0550ae",
    codeBackground: "rgba(128,128,128,0.15)",
    blockquoteBorder: "rgba(128,128,128,0.5)",
  },
  dark: {
    background: "#0a0a0a",
    foreground: "#fafafa",
    muted: "#262626",
    mutedForeground: "#a3a3a3",
    ring: "#525252",
    link: "#58a6ff",
    linkUrl: "#79c0ff",
    codeBackground: "rgba(128,128,128,0.25)",
    blockquoteBorder: "rgba(128,128,128,0.5)",
  },
} as const;

export interface ThemePalette {
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  ring: string;
  link: string;
  linkUrl: string;
  codeBackground: string;
  blockquoteBorder: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
}

const palettes: { light: ThemePalette; dark: ThemePalette } = {
  light: {
    ...editorPreviewColors.light,
    card: "#ffffff",
    cardForeground: "#0a0a0a",
    primary: "#171717",
    primaryForeground: "#fafafa",
    secondary: "#f5f5f5",
    secondaryForeground: "#171717",
    accent: "#f5f5f5",
    accentForeground: "#171717",
    destructive: "#ef4444",
    destructiveForeground: "#ef4444",
    border: "#e5e5e5",
    input: "#e5e5e5",
  },
  dark: {
    ...editorPreviewColors.dark,
    card: "#0a0a0a",
    cardForeground: "#fafafa",
    primary: "#fafafa",
    primaryForeground: "#171717",
    secondary: "#262626",
    secondaryForeground: "#fafafa",
    accent: "#262626",
    accentForeground: "#fafafa",
    destructive: "#7f1d1d",
    destructiveForeground: "#dc2626",
    border: "#262626",
    input: "#262626",
  },
};

export function useThemeColors(): { colors: ThemePalette; isDark: boolean } {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return {
    colors: isDark ? palettes.dark : palettes.light,
    isDark,
  };
}

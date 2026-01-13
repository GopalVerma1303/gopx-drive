import { useColorScheme } from "nativewind";

const colors = {
  light: {
    background: "#ffffff",
    foreground: "#0a0a0a",
    card: "#ffffff",
    cardForeground: "#0a0a0a",
    primary: "#171717",
    primaryForeground: "#fafafa",
    secondary: "#f5f5f5",
    secondaryForeground: "#171717",
    muted: "#f5f5f5",
    mutedForeground: "#737373",
    accent: "#f5f5f5",
    accentForeground: "#171717",
    destructive: "#ef4444",
    destructiveForeground: "#ef4444",
    border: "#e5e5e5",
    input: "#e5e5e5",
    ring: "#a3a3a3",
  },
  dark: {
    background: "#0a0a0a",
    foreground: "#fafafa",
    card: "#0a0a0a",
    cardForeground: "#fafafa",
    primary: "#fafafa",
    primaryForeground: "#171717",
    secondary: "#262626",
    secondaryForeground: "#fafafa",
    muted: "#262626",
    mutedForeground: "#a3a3a3",
    accent: "#262626",
    accentForeground: "#fafafa",
    destructive: "#7f1d1d",
    destructiveForeground: "#dc2626",
    border: "#262626",
    input: "#262626",
    ring: "#525252",
  },
};

export function useThemeColors() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return {
    colors: isDark ? colors.dark : colors.light,
    isDark,
  };
}

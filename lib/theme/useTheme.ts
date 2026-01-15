/**
 * Theme Hook - Provides theme colors and utilities
 * Replaces NativeWind's useColorScheme
 */

import { useTheme as useThemeContext } from "@/contexts/theme-context";
import { colors, type ColorScheme, type ThemeColors } from "./tokens";

export function useThemeColors() {
  const { resolvedTheme } = useThemeContext();
  const isDark = resolvedTheme === "dark";

  return {
    colors: (isDark ? colors.dark : colors.light) as ThemeColors,
    isDark,
    colorScheme: resolvedTheme as ColorScheme,
  };
}

export function useTheme() {
  return useThemeContext();
}

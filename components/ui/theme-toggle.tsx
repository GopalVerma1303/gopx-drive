/**
 * Theme Toggle Component
 * Toggle between light and dark themes
 */

"use client";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/contexts/theme-context";
import { useThemeColors } from "@/lib/theme/useTheme";
import { getRadius, getSpacing } from "@/lib/theme/styles";
import { composeStyle } from "@/lib/utils";
import { Moon, Sun } from "lucide-react-native";
import { Pressable, View, type ViewStyle } from "react-native";
import * as React from "react";

export interface ThemeToggleProps {
  size?: number;
  showLabel?: boolean;
  style?: ViewStyle;
}

export function ThemeToggle({
  size = 22,
  showLabel = false,
  style,
}: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { colors } = useThemeColors();
  const isDark = resolvedTheme === "dark";

  const containerStyle: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    padding: getSpacing(2),
    borderRadius: getRadius("lg"),
  };

  const iconContainerStyle: ViewStyle = {
    position: "relative",
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  };

  const textStyle: ViewStyle = {
    marginLeft: getSpacing(2),
    color: colors.foreground,
  };

  return (
    <Pressable
      onPress={toggleTheme}
      style={({ pressed }) =>
        composeStyle(
          containerStyle,
          pressed && { opacity: 0.7 },
          style
        )
      }
    >
      <View style={iconContainerStyle}>
        {isDark ? (
          <Moon size={size} color={colors.foreground} />
        ) : (
          <Sun size={size} color={colors.foreground} />
        )}
      </View>
      {showLabel && (
        <Text style={textStyle}>{isDark ? "Dark" : "Light"}</Text>
      )}
    </Pressable>
  );
}

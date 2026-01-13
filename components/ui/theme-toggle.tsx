"use client";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/contexts/theme-context";
import { Moon, Sun } from "lucide-react-native";
import { Pressable, View } from "react-native";

interface ThemeToggleProps {
  size?: number;
  showLabel?: boolean;
  className?: string;
}

export function ThemeToggle({
  size = 22,
  showLabel = false,
  className,
}: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Define colors based on theme - these match the CSS variables in globals.css
  const iconColor = isDark ? "hsl(210, 40%, 98%)" : "hsl(222.2, 84%, 4.9%)";

  return (
    <Pressable
      onPress={toggleTheme}
      className={`flex-row items-center p-2 rounded-lg active:opacity-70 ${className}`}
    >
      <View className="relative w-6 h-6 items-center justify-center">
        {isDark ? (
          <Moon size={size} color={iconColor} />
        ) : (
          <Sun size={size} color={iconColor} />
        )}
      </View>
      {showLabel && (
        <Text className="ml-2 text-foreground">
          {isDark ? "Dark" : "Light"}
        </Text>
      )}
    </Pressable>
  );
}

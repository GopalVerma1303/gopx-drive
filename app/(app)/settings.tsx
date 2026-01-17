"use client";

import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/use-theme-colors";
import { Stack } from "expo-router";
import { View } from "react-native";

export default function SettingsScreen() {
  const { colors } = useThemeColors();

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: "600",
            color: colors.foreground,
          }}
        >
          Settings
        </Text>
      </View>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontSize: 18,
            color: colors.mutedForeground,
          }}
        >
          Settings
        </Text>
      </View>
    </View>
  );
}

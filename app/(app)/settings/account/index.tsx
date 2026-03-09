"use client";

import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { useThemeColors } from "@/lib/use-theme-colors";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft, Lock, Mail } from "lucide-react-native";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AccountScreen() {
  const { colors } = useThemeColors();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handlePress = (route: any) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push(route);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top,
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            height: 56,
            paddingHorizontal: 6,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                router.back();
              }}
              style={{ padding: 8 }}
            >
              <ArrowLeft color={colors.foreground} size={24} />
            </Pressable>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: colors.foreground,
              }}
            >
              Account
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 23,
          gap: 24,
        }}
      >
        <View className="w-full max-w-2xl mx-auto">
          <View className="bg-muted border border-border rounded-2xl overflow-hidden">
            <Pressable
              className="flex flex-row items-center gap-3 p-4"
              onPress={() => handlePress("/(app)/settings/account/update-email")}
            >
              <Mail size={20} color={colors.foreground} />
              <Text
                style={{
                  fontSize: 16,
                  color: colors.foreground,
                  fontWeight: "500",
                }}
              >
                Update Email
              </Text>
            </Pressable>

            <Pressable
              className="flex flex-row items-center gap-3 p-4 border-t border-border"
              onPress={() => handlePress("/(app)/settings/account/update-password")}
            >
              <Lock size={20} color={colors.foreground} />
              <Text
                style={{
                  fontSize: 16,
                  color: colors.foreground,
                  fontWeight: "500",
                }}
              >
                Update Password
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

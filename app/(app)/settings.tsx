"use client";

import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { useThemeColors } from "@/lib/use-theme-colors";
import * as Haptics from "expo-haptics";
import { Stack } from "expo-router";
import { LogOut, Mail } from "lucide-react-native";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const { colors } = useThemeColors();
  const { user, signOut } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const handleLogoutPress = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            handleSignOut();
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
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
            justifyContent: "space-between",
            height: 56,
            paddingHorizontal: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
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
        </View>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          gap: 24,
        }}
      >
        {/* Account Section */}
        <View className="w-full max-w-2xl mx-auto">
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.mutedForeground,
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Account
          </Text>
          <View className="bg-muted border border-border rounded-2xl overflow-hidden">
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
                gap: 12,
              }}
            >
              <Mail
                color={colors.mutedForeground}
                size={20}
                strokeWidth={2.5}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.mutedForeground,
                    marginBottom: 4,
                  }}
                >
                  Email
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    color: colors.foreground,
                    fontWeight: "500",
                  }}
                >
                  {user?.email || "Not available"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Appearance Section */}
        <View className="w-full max-w-2xl mx-auto">
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.mutedForeground,
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Appearance
          </Text>
          <View className="bg-muted border border-border rounded-2xl overflow-hidden">
            <Pressable
              className="flex flex-row justify-between items-center p-4 gap-12"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toggleTheme();
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 16,
                    color: colors.foreground,
                    fontWeight: "500",
                    marginBottom: 4,
                  }}
                >
                  Dark Mode
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.mutedForeground,
                  }}
                >
                  {resolvedTheme === "dark"
                    ? "Dark theme enabled"
                    : "Light theme enabled"}
                </Text>
              </View>
              <Switch
                checked={resolvedTheme === "dark"}
                onCheckedChange={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleTheme();
                }}
              />
            </Pressable>
          </View>
        </View>

        {/* Actions Section */}
        <View className="w-full max-w-2xl mx-auto">
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.mutedForeground,
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Actions
          </Text>
          <View className="bg-muted border border-border rounded-2xl overflow-hidden">
            <Pressable
            className="flex flex-row  p-4 gap-12"
              onPress={handleLogoutPress}
            >
              <View className="flex flex-row items-center gap-2">
              <LogOut
                color={"#ef4444"}
                size={20}
                strokeWidth={2.5}
              />
              <Text
                style={{
                  fontSize: 16,
                  color:"#ef4444",
                  fontWeight: "500",
                }}
              >
                Sign Out
              </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

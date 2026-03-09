"use client";

import { Text } from "@/components/ui/text";
import { useAlert } from "@/contexts/alert-context";
import { useAuth } from "@/contexts/auth-context";
import { useThemeColors } from "@/lib/use-theme-colors";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft, Lock, Mail, UserX } from "lucide-react-native";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AccountScreen() {
  const { colors } = useThemeColors();
  const { alert } = useAlert();
  const { user, deleteAccount } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handlePress = (route: any) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push(route);
  };

  const handleDeleteAccount = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action is permanent and all your data will be lost forever.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();
              // AuthContext will handle state cleanup and router will redirect because of AuthLayout
            } catch (error: any) {
              alert("Error", error.message || "Failed to delete account");
            }
          }
        }
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
          padding: 16,
          gap: 32,
        }}
      >
        {/* Credentials Section */}
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
            Update Credentials
          </Text>
          <View className="bg-muted border border-border rounded-2xl overflow-hidden">
            <Pressable
              className="flex flex-row items-center gap-3 p-4 active:bg-accent/50"
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
              className="flex flex-row items-center gap-3 p-4 border-t border-border active:bg-accent/50"
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

        {/* Danger Zone Section */}
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
            Danger Zone
          </Text>
          <View className="bg-muted border border-border rounded-2xl overflow-hidden">
            <Pressable
              className="flex flex-row items-center gap-3 p-4 active:bg-red-500/10"
              onPress={handleDeleteAccount}
            >
              <UserX size={20} color="#ef4444" />
              <Text
                style={{
                  fontSize: 16,
                  color: "#ef4444",
                  fontWeight: "500",
                }}
              >
                Delete Account
              </Text>
            </Pressable>
          </View>
          <Text className="text-muted-foreground text-xs mt-3 px-1 leading-normal">
            Once you delete your account, there is no going back. Please be certain.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

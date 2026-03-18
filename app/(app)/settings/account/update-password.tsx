"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { Text } from "@/components/ui/text";
import { useAlert } from "@/contexts/alert-context";
import { useAuth } from "@/contexts/auth-context";
import { useThemeColors } from "@/lib/use-theme-colors";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft, Lock, Eye, EyeOff } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { NAV_BAR_HEIGHT } from "@/lib/layout";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function UpdatePasswordScreen() {
  const { colors } = useThemeColors();
  const { alert } = useAlert();
  const { user, updatePassword, signIn, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      alert("Error", "Please fill in all fields");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      alert("Error", "New passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      // Re-authenticate user before updating password
      await signIn(user?.email || "", currentPassword);
      
      await updatePassword(newPassword);
      
      alert(
        "Success",
        "Your password has been updated. Please sign in with your new password."
      );
      
      await signOut();
      router.replace("/(auth)/login");
    } catch (error: any) {
      alert("Error", error.message || "Failed to update password. Ensure your current password is correct.");
    } finally {
      setIsLoading(false);
    }
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
              Update Password
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 32,
          gap: 24,
        }}
      >
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
            Current Password
          </Text>
          <View className="bg-muted border border-border rounded-2xl p-4">
            <Text className="mb-2 text-sm font-medium text-foreground">Verify Identity</Text>
            <View className="flex-row items-center bg-background rounded-2xl pl-4 pr-2 h-14 border border-border">
              <Lock
                className="text-muted-foreground"
                color={colors.mutedForeground}
                size={20}
              />
              <Input
                className="flex-1 ml-2 border-0 bg-transparent h-full shadow-none"
                placeholder="Enter current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPassword}
              />
              <Pressable onPress={() => setShowCurrentPassword(!showCurrentPassword)} className="p-2">
                {showCurrentPassword ? 
                  <EyeOff size={20} color={colors.mutedForeground} /> : 
                  <Eye size={20} color={colors.mutedForeground} />
                }
              </Pressable>
            </View>
          </View>
        </View>

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
            New Password
          </Text>
          <View className="bg-muted border border-border rounded-2xl p-4 gap-6">
            <View>
              <Text className="mb-2 text-sm font-medium text-foreground">New Password</Text>
              <View className="flex-row items-center bg-background rounded-2xl pl-4 pr-2 h-14 border border-border">
                <Lock
                  className="text-muted-foreground"
                  color={colors.mutedForeground}
                  size={20}
                />
                <Input
                  className="flex-1 ml-2 border-0 bg-transparent h-full shadow-none"
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                />
                <Pressable onPress={() => setShowNewPassword(!showNewPassword)} className="p-2">
                  {showNewPassword ? 
                    <EyeOff size={20} color={colors.mutedForeground} /> : 
                    <Eye size={20} color={colors.mutedForeground} />
                  }
                </Pressable>
              </View>
            </View>

            <View>
              <Text className="mb-2 text-sm font-medium text-foreground">Confirm New Password</Text>
              <View className="flex-row items-center bg-background rounded-2xl pl-4 pr-2 h-14 border border-border">
                <Lock
                  className="text-muted-foreground"
                  color={colors.mutedForeground}
                  size={20}
                />
                <Input
                  className="flex-1 ml-2 border-0 bg-transparent h-full shadow-none"
                  placeholder="Repeat new password"
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  secureTextEntry={!showConfirmNewPassword}
                />
                <Pressable onPress={() => setShowConfirmNewPassword(!showConfirmNewPassword)} className="p-2">
                  {showConfirmNewPassword ? 
                    <EyeOff size={20} color={colors.mutedForeground} /> : 
                    <Eye size={20} color={colors.mutedForeground} />
                  }
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        <View className="w-full max-w-2xl mx-auto items-center">
          <Pressable
            onPress={handleUpdatePassword}
            className="h-14 w-full rounded-2xl items-center justify-center"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader color="#3b82f6" />
            ) : (
              <Text className="text-blue-500 font-semibold text-base">
                Update Password & Sign Out
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

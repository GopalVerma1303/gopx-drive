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
import { ArrowLeft, Lock, Mail, Eye, EyeOff } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function UpdateEmailScreen() {
  const { colors } = useThemeColors();
  const { alert } = useAlert();
  const { user, updateEmail, signIn, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleUpdateEmail = async () => {
    if (!newEmail || !password) {
      alert("Error", "Please enter both new email and your current password");
      return;
    }

    setIsLoading(true);
    try {
      // Re-authenticate user before updating email
      await signIn(user?.email || "", password);
      
      await updateEmail(newEmail);
      
      alert(
        "Success",
        "Verification emails sent to both your old and new email addresses. Once verified, you will be signed out."
      );
      
      // Optionally sign out immediately or wait for them to click back
      await signOut();
      router.replace("/(auth)/login");
    } catch (error: any) {
      alert("Error", error.message || "Failed to update email. Ensure your password is correct.");
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
              Update Email
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 100,
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
            Current Account
          </Text>
          <View className="bg-muted border border-border rounded-2xl p-4">
            <Text className="text-muted-foreground text-xs font-medium mb-1">EMAIL</Text>
            <Text className="text-foreground text-base">{user?.email}</Text>
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
            New Credentials
          </Text>
          <View className="bg-muted border border-border rounded-2xl p-4 gap-6">
            <View>
              <Text className="mb-2 text-sm font-medium text-foreground">New Email Address</Text>
              <View className="flex-row items-center bg-background rounded-2xl px-4 h-14 border border-border">
                <Mail
                  className="text-muted-foreground"
                  color={colors.mutedForeground}
                  size={20}
                />
                <Input
                  value={newEmail}
                  onChangeText={setNewEmail}
                  placeholder="yours@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="flex-1 ml-2 border-0 bg-transparent h-full shadow-none"
                />
              </View>
            </View>

            <View>
              <Text className="mb-2 text-sm font-medium text-foreground">Current Password</Text>
              <View className="flex-row items-center bg-background rounded-2xl pl-4 pr-2 h-14 border border-border">
                <Lock
                  className="text-muted-foreground"
                  color={colors.mutedForeground}
                  size={20}
                />
                <Input
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password to confirm"
                  secureTextEntry={!showPassword}
                  className="flex-1 ml-2 border-0 bg-transparent h-full shadow-none"
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} className="p-2">
                  {showPassword ? 
                    <EyeOff size={20} color={colors.mutedForeground} /> : 
                    <Eye size={20} color={colors.mutedForeground} />
                  }
                </Pressable>
              </View>
              <Text className="text-muted-foreground text-xs mt-2 px-1">
                For security reasons, we need your current password to process this change.
              </Text>
            </View>
          </View>
        </View>

        <View className="w-full max-w-2xl mx-auto items-center">
          <Pressable
            onPress={handleUpdateEmail}
            className="h-14 w-full rounded-2xl items-center justify-center"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader color="#3b82f6" />
            ) : (
              <Text className="text-blue-500 font-semibold text-base">
                Update Email & Sign Out
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

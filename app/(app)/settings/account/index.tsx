"use client";

import { Text } from "@/components/ui/text";
import { useAlert } from "@/contexts/alert-context";
import { useAuth } from "@/contexts/auth-context";
import { useThemeColors } from "@/lib/use-theme-colors";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft, Eye, EyeOff, Lock, Mail, UserX } from "lucide-react-native";
import { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function AccountScreen() {
  const { colors } = useThemeColors();
  const { alert } = useAlert();
  const { user, verifyPassword, deleteAccount } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web" || !isVerifyModalOpen) return;
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [isVerifyModalOpen]);

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
    setIsVerifyModalOpen(true);
  };

  const handleVerifyConfirm = async () => {
    if (!password) {
      alert("Error", "Please enter your password");
      return;
    }

    setIsVerifying(true);
    try {
      await verifyPassword(password);
      setIsVerifyModalOpen(false);
      setPassword("");
      
      // Final confirmation Alert after password check
      setTimeout(() => {
        alert(
          "Final Confirmation",
          "Are you sure you want to permanently delete your account? This cannot be undone.",
          [
            { text: "Cancel", style: "cancel" },
            { 
              text: "Delete My Account", 
              style: "destructive",
              onPress: handleFinalDelete
            }
          ]
        );
      }, 300);
    } catch (error: any) {
      alert("Error", error.message || "Incorrect password");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleFinalDelete = async () => {
    try {
      await deleteAccount();
    } catch (error: any) {
      alert("Error", error.message || "Failed to delete account");
    }
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

      {/* Password Verification Modal */}
      {Platform.OS === "web" ? (
        isVerifyModalOpen && (
          <View 
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
            style={{ position: "fixed" as any, top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <Pressable
              className="absolute inset-0"
              style={{ position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 }}
              onPress={() => setIsVerifyModalOpen(false)}
            />
            <View 
              className="w-full max-w-[500px] rounded-lg border border-border bg-muted p-6 shadow-lg"
            >
              <Text className="mb-2 text-lg font-semibold text-foreground">
                Verify Identity
              </Text>
              <Text className="mb-4 text-sm text-muted-foreground">
                Please enter your password to continue with account deletion.
              </Text>

              <View className="gap-2 mb-6">
                <View 
                  className="flex-row items-center rounded-md px-4 h-14 border border-border bg-background"
                >
                  <Lock
                    className="text-muted-foreground"
                    color={colors.mutedForeground}
                    size={20}
                  />
                  <Input
                    className="flex-1 ml-2 border-0 bg-transparent h-full shadow-none text-sm"
                    placeholder="Enter your password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    editable={!isVerifying}
                    style={{ color: colors.foreground }}
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    className="p-2"
                  >
                    {showPassword ? (
                      <EyeOff color={colors.mutedForeground} size={20} />
                    ) : (
                      <Eye color={colors.mutedForeground} size={20} />
                    )}
                  </Pressable>
                </View>
              </View>

              <View className="flex-row items-center justify-end gap-3">
                <Pressable
                  className="px-4 py-2"
                  onPress={() => setIsVerifyModalOpen(false)}
                  disabled={isVerifying}
                >
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className={`rounded-md px-4 py-2 ${password.trim() && !isVerifying ? "opacity-100" : "opacity-50"}`}
                  onPress={handleVerifyConfirm}
                  disabled={!password.trim() || isVerifying}
                >
                  <Text className="font-semibold text-red-500">
                    {isVerifying ? "Verifying..." : "Verify"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )
      ) : (
        <Modal
          visible={isVerifyModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsVerifyModalOpen(false)}
        >
          <KeyboardAvoidingView
            className="flex-1"
            behavior="padding"
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            enabled={keyboardVisible}
          >
            <View className="flex-1 bg-black/50 p-4 justify-center items-center">
              <Pressable
                className="absolute inset-0"
                onPress={() => setIsVerifyModalOpen(false)}
              />
              <View 
                className="w-full max-w-[500px] rounded-lg border border-border bg-muted p-6 shadow-lg"
              >
                <Text className="mb-2 text-lg font-semibold text-foreground">
                  Verify Identity
                </Text>
                <Text className="mb-4 text-sm text-muted-foreground">
                  Please enter your password to continue with account deletion.
                </Text>

                <View className="gap-2 mb-6">
                  <View 
                    className="flex-row items-center rounded-md px-4 h-14 border border-border bg-background"
                  >
                    <Lock
                      className="text-muted-foreground"
                      color={colors.mutedForeground}
                      size={20}
                    />
                    <Input
                      className="flex-1 ml-2 border-0 bg-transparent h-full shadow-none text-sm"
                      placeholder="Enter your password"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      editable={!isVerifying}
                      style={{ color: colors.foreground }}
                    />
                    <Pressable
                      onPress={() => setShowPassword(!showPassword)}
                      className="p-2"
                    >
                      {showPassword ? (
                        <EyeOff color={colors.mutedForeground} size={20} />
                      ) : (
                        <Eye color={colors.mutedForeground} size={20} />
                      )}
                    </Pressable>
                  </View>
                </View>

                <View className="flex-row items-center justify-end gap-3">
                  <Pressable
                    className="px-4 py-2"
                    onPress={() => setIsVerifyModalOpen(false)}
                    disabled={isVerifying}
                  >
                    <Text className="text-foreground">Cancel</Text>
                  </Pressable>
                  <Pressable
                    className={`rounded-md px-4 py-2 ${password.trim() && !isVerifying ? "opacity-100" : "opacity-50"}`}
                    onPress={handleVerifyConfirm}
                    disabled={!password.trim() || isVerifying}
                  >
                    <Text className="font-semibold text-red-500">
                      {isVerifying ? "Verifying..." : "Verify"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  );
}

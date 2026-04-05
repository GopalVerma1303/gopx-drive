"use client";

import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { useAlert } from "@/contexts/alert-context";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { clearAppCache } from "@/lib/clear-cache";
import { NAV_BAR_HEIGHT } from "@/lib/layout";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { Archive, ChevronRight, Eraser, Eye, EyeOff, FileText, Heart, ImageIcon, Lock, LogOut, Settings2, Trash2, WandSparkles } from "lucide-react-native";
import { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Input } from "@/components/ui/input";

export default function SettingsScreen() {
  const { colors } = useThemeColors();
  const { alert } = useAlert();
  const { user, signOut } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [clearCacheDialogOpen, setClearCacheDialogOpen] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  // Data Deletion State
  const { verifyPassword, deleteAllContent } = useAuth();
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

  const handleClearDataPress = () => {
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
          "Are you sure you want to permanently clear ALL your data? This includes all notes, files, events, and folders. This cannot be undone.",
          [
            { text: "Cancel", style: "cancel" },
            { 
              text: "Clear Everything", 
              style: "destructive",
              onPress: handleFinalDeleteContent
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

  const handleFinalDeleteContent = async () => {
    try {
      await deleteAllContent();
      queryClient.clear();
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      alert("Done", "All your data has been permanently cleared.");
    } catch (error: any) {
      alert("Error", error.message || "Failed to clear all data");
    }
  };

  const handleSignOut = async () => {
    try {
      setLogoutDialogOpen(false);
      await signOut();
    } catch (error: any) {
      alert("Error", error.message);
    }
  };

  const handleLogoutPress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setLogoutDialogOpen(true);
  };

  const handleLogoutConfirm = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    handleSignOut();
  };

  const handleClearCachePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setClearCacheDialogOpen(true);
  };

  const handleClearCacheConfirm = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setClearCacheDialogOpen(false);
    setClearingCache(true);
    try {
      await clearAppCache();
      queryClient.clear();
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      alert("Done", "Cache cleared. Your data will refresh when you open each screen.");
    } catch (error: any) {
      alert("Error", error?.message ?? "Failed to clear cache");
    } finally {
      setClearingCache(false);
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
            justifyContent: "space-between",
            height: 56,
            paddingHorizontal: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingLeft: 8 }}>
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
          paddingBottom: insets.bottom + NAV_BAR_HEIGHT + 32,
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
            <Pressable
              style={{
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(app)/settings/account");
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
                  Email
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.mutedForeground,
                  }}
                >
                  {user?.email || "Not available"}
                </Text>
              </View>
              <ChevronRight
                color={colors.mutedForeground}
                size={20}
                style={{ marginRight: -4 }}
              />
            </Pressable>
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
                  }}
                >
                  Dark Mode
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

        {/* Editor Section */}
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
            Editor
          </Text>
          <View className="bg-muted border border-border rounded-2xl overflow-hidden">
            <Pressable
              className="flex flex-row items-center justify-between p-4"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(app)/settings/toolbar-order");
              }}
            >
              <View className="flex flex-row items-center gap-2">
                <Settings2
                  color={colors.foreground}
                  size={20}
                />
                <Text
                  style={{
                    fontSize: 16,
                    color: colors.foreground,
                    fontWeight: "500",
                  }}
                >
                  Toolbar Order
                </Text>
              </View>
              <ChevronRight
                color={colors.mutedForeground}
                size={20}
                style={{ marginRight: -4 }}
              />
            </Pressable>
          </View>
        </View>

        {/* Sharing Section */}
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
            Sharing
          </Text>
          <View className="bg-muted border border-border rounded-2xl overflow-hidden">
            <Pressable
              className="flex flex-row items-center justify-between p-4"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(app)/settings/shared-notes");
              }}
            >
              <View className="flex flex-row items-center gap-2">
                <FileText
                  color={colors.foreground}
                  size={20}
                />
                <Text
                  style={{
                    fontSize: 16,
                    color: colors.foreground,
                    fontWeight: "500",
                  }}
                >
                  Manage Shared Notes
                </Text>
              </View>
              <ChevronRight
                color={colors.mutedForeground}
                size={20}
                style={{ marginRight: -4 }}
              />
            </Pressable>
          </View>
        </View>

        {/* Storage Section */}
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
            Storage
          </Text>
          <View className="bg-muted border border-border rounded-2xl overflow-hidden">
            <Pressable
              className="flex flex-row items-center justify-between p-4"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(app)/settings/archive");
              }}
            >
              <View className="flex flex-row items-center gap-2">
                <Archive
                  color={colors.foreground}
                  size={20}
                />
                <Text
                  style={{
                    fontSize: 16,
                    color: colors.foreground,
                    fontWeight: "500",
                  }}
                >
                  Archive
                </Text>
              </View>
              <ChevronRight
                color={colors.mutedForeground}
                size={20}
                style={{ marginRight: -4 }}
              />
            </Pressable>
            <Pressable
              className="flex flex-row items-center justify-between p-4 border-t border-border"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(app)/settings/attachments");
              }}
            >
              <View className="flex flex-row items-center gap-2">
                <ImageIcon
                  color={colors.foreground}
                  size={20}
                />
                <Text
                  style={{
                    fontSize: 16,
                    color: colors.foreground,
                    fontWeight: "500",
                  }}
                >
                  Attachments
                </Text>
              </View>
              <ChevronRight
                color={colors.mutedForeground}
                size={20}
                style={{ marginRight: -4 }}
              />
            </Pressable>
            <Pressable
              className="flex flex-row items-center gap-12 p-4 border-t border-border"
              onPress={handleClearCachePress}
              disabled={clearingCache}
            >
              <View className="flex flex-row items-center gap-2">
                <Eraser
                  color={colors.foreground}
                  size={20}
                />
                <Text
                  style={{
                    fontSize: 16,
                    color: colors.foreground,
                    fontWeight: "500",
                  }}
                >
                  {clearingCache ? "Clearing…" : "Clear Cache"}
                </Text>
              </View>
            </Pressable>
            <Pressable
              className="flex flex-row items-center gap-12 p-4 border-t border-border"
              onPress={handleClearDataPress}
            >
              <View className="flex flex-row items-center gap-2">
                <Trash2
                  color={"#ef4444"}
                  size={20}
                />
                <Text
                  style={{
                    fontSize: 16,
                    color: "#ef4444",
                    fontWeight: "500",
                  }}
                >
                  Clear All Data
                </Text>
              </View>
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
                />
                <Text
                  style={{
                    fontSize: 16,
                    color: "#ef4444",
                    fontWeight: "500",
                  }}
                >
                  Sign Out
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Footer */}
        <View className="w-full max-w-2xl mx-auto mt-4 mb-12">
          <View
            style={{
              alignItems: "center",
              paddingVertical: 16,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
              <Text
                style={{
                  fontSize: 14,
                  color: colors.mutedForeground,
                }}
              >
                Built with
              </Text>
              <Heart
                color="#ef4444"
                size={14}
                fill="#ef4444"
              />
              <Text
                style={{
                  fontSize: 14,
                  color: colors.mutedForeground,
                }}
              >
                by Gopal Verma aka
              </Text>
              <Pressable
                onPress={() => {
                  Linking.openURL("https://gopx.dev");
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      color: "#3b82f6",
                      textDecorationLine: "underline",
                    }}
                  >
                    Gopx
                  </Text>
                  <WandSparkles
                    color="#3b82f6"
                    size={14}
                  />
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Clear Cache confirmation dialog — same style as archive.tsx */}
      {Platform.OS === "web" ? (
        clearCacheDialogOpen && (
          <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Pressable
              className="absolute inset-0"
              onPress={() => setClearCacheDialogOpen(false)}
            />
            <View className="w-full max-w-[400px] rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">
                Clear Cache
              </Text>
              <Text className="mb-6 text-sm text-muted-foreground">
                This will clear cached files, notes, and calendar data. You will stay signed in. Data will load again when you open each screen.
              </Text>
              <View className="flex-row justify-end gap-3">
                <Pressable
                  className="px-4 py-2"
                  onPress={() => setClearCacheDialogOpen(false)}
                >
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className="rounded-md px-4 py-2"
                  onPress={handleClearCacheConfirm}
                >
                  <Text className="font-semibold text-red-500">Clear Cache</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )
      ) : (
        <Modal
          visible={clearCacheDialogOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setClearCacheDialogOpen(false)}
        >
          <View className="flex-1 items-center justify-center bg-black/50 p-4">
            <Pressable
              className="absolute inset-0"
              onPress={() => setClearCacheDialogOpen(false)}
            />
            <View className="w-full max-w-[400px] rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">
                Clear Cache
              </Text>
              <Text className="mb-6 text-sm text-muted-foreground">
                This will clear cached files, notes, and calendar data. You will stay signed in. Data will load again when you open each screen.
              </Text>
              <View className="flex-row justify-end gap-3">
                <Pressable
                  className="px-4 py-2"
                  onPress={() => setClearCacheDialogOpen(false)}
                >
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className="rounded-md px-4 py-2"
                  onPress={handleClearCacheConfirm}
                >
                  <Text className="font-semibold text-red-500">Clear Cache</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Sign Out confirmation dialog — same style as notes archive dialog for web + native */}
      {Platform.OS === "web" ? (
        logoutDialogOpen && (
          <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Pressable
              className="absolute inset-0"
              onPress={() => setLogoutDialogOpen(false)}
            />
            <View className="w-full max-w-[400px] rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">
                Sign Out
              </Text>
              <Text className="mb-6 text-sm text-muted-foreground">
                Are you sure you want to sign out?
              </Text>
              <View className="flex-row justify-end gap-3">
                <Pressable
                  className="px-4 py-2"
                  onPress={() => setLogoutDialogOpen(false)}
                >
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className="rounded-md px-4 py-2"
                  onPress={handleLogoutConfirm}
                >
                  <Text className="font-semibold text-red-500">Sign Out</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )
      ) : (
        <Modal
          visible={logoutDialogOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setLogoutDialogOpen(false)}
        >
          <View className="flex-1 items-center justify-center bg-black/50 p-4">
            <Pressable
              className="absolute inset-0"
              onPress={() => setLogoutDialogOpen(false)}
            />
            <View className="w-full max-w-[400px] rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">
                Sign Out
              </Text>
              <Text className="mb-6 text-sm text-muted-foreground">
                Are you sure you want to sign out?
              </Text>
              <View className="flex-row justify-end gap-3">
                <Pressable
                  className="px-4 py-2"
                  onPress={() => setLogoutDialogOpen(false)}
                >
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className="rounded-md px-4 py-2"
                  onPress={handleLogoutConfirm}
                >
                  <Text className="font-semibold text-red-500">Sign Out</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
      
      {/* Password Verification Modal for Content Deletion */}
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
                Please enter your password to continue with clearing ALL data.
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
                  Please enter your password to continue with clearing ALL data.
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

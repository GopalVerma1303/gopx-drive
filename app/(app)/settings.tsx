"use client";

import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { clearAppCache } from "@/lib/clear-cache";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { Archive, Eraser, ImageIcon, LogOut } from "lucide-react-native";
import { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const { colors } = useThemeColors();
  const { user, signOut } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [clearCacheDialogOpen, setClearCacheDialogOpen] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  const handleSignOut = async () => {
    try {
      setLogoutDialogOpen(false);
      await signOut();
    } catch (error: any) {
      Alert.alert("Error", error.message);
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
      Alert.alert("Done", "Cache cleared. Your data will refresh when you open each screen.");
    } catch (error: any) {
      Alert.alert("Error", error?.message ?? "Failed to clear cache");
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
                padding: 16,
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
              className="flex flex-row items-center gap-12 p-4"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(app)/archive");
              }}
            >
              <View className="flex flex-row items-center gap-2">
                <Archive
                  color={colors.foreground}
                  size={20}
                  strokeWidth={2}
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
            </Pressable>
            <Pressable
              className="flex flex-row items-center gap-12 p-4 border-t border-border"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(app)/attachments");
              }}
            >
              <View className="flex flex-row items-center gap-2">
                <ImageIcon
                  color={colors.foreground}
                  size={20}
                  strokeWidth={2}
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
                  strokeWidth={2}
                />
                <Text
                  style={{
                    fontSize: 16,
                    color: colors.foreground,
                    fontWeight: "500",
                  }}
                >
                  {clearingCache ? "Clearing…" : "Clear cache"}
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
                  strokeWidth={2}
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
      </ScrollView>

      {/* Clear cache confirmation dialog — same style as archive.tsx */}
      {Platform.OS === "web" ? (
        clearCacheDialogOpen && (
          <View
            style={{
              position: "fixed" as any,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 50,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(8px)",
              justifyContent: "center",
              alignItems: "center",
              padding: 16,
            }}
          >
            <Pressable
              style={{ position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 }}
              onPress={() => setClearCacheDialogOpen(false)}
            />
            <View
              style={{
                backgroundColor: colors.muted,
                borderColor: colors.border,
                borderRadius: 8,
                borderWidth: 1,
                padding: 24,
                width: "100%",
                maxWidth: 400,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 18,
                  fontWeight: "600",
                  marginBottom: 8,
                }}
              >
                Clear cache
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 14,
                  marginBottom: 24,
                }}
              >
                This will clear cached files, notes, and calendar data. You will stay signed in. Data will load again when you open each screen.
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <Pressable
                  style={{ paddingHorizontal: 16, paddingVertical: 8 }}
                  onPress={() => setClearCacheDialogOpen(false)}
                >
                  <Text style={{ color: colors.foreground }}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 6,
                  }}
                  onPress={handleClearCacheConfirm}
                >
                  <Text style={{ color: "#ef4444", fontWeight: "600" }}>Clear cache</Text>
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
          <View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
            <BlurView
              intensity={20}
              tint="dark"
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                padding: 16,
              }}
            >
              <Pressable
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
                onPress={() => setClearCacheDialogOpen(false)}
              />
              <View
                style={{
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                  borderRadius: 8,
                  borderWidth: 1,
                  padding: 24,
                  width: "100%",
                  maxWidth: 400,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 5,
                }}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 18,
                    fontWeight: "600",
                    marginBottom: 8,
                  }}
                >
                  Clear cache
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 14,
                    marginBottom: 24,
                  }}
                >
                  This will clear cached files, notes, and calendar data. You will stay signed in. Data will load again when you open each screen.
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    gap: 12,
                  }}
                >
                  <Pressable
                    style={{ paddingHorizontal: 16, paddingVertical: 8 }}
                    onPress={() => setClearCacheDialogOpen(false)}
                  >
                    <Text style={{ color: colors.foreground }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 6,
                    }}
                    onPress={handleClearCacheConfirm}
                  >
                    <Text style={{ color: "#ef4444", fontWeight: "600" }}>Clear cache</Text>
                  </Pressable>
                </View>
              </View>
            </BlurView>
          </View>
        </Modal>
      )}

      {/* Sign Out confirmation dialog — same style as notes archive dialog for web + native */}
      {Platform.OS === "web" ? (
        logoutDialogOpen && (
          <View
            style={{
              position: "fixed" as any,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 50,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(8px)",
              justifyContent: "center",
              alignItems: "center",
              padding: 16,
            }}
          >
            <Pressable
              style={{ position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 }}
              onPress={() => setLogoutDialogOpen(false)}
            />
            <View
              style={{
                backgroundColor: colors.muted,
                borderColor: colors.border,
                borderRadius: 8,
                borderWidth: 1,
                padding: 24,
                width: "100%",
                maxWidth: 400,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 18,
                  fontWeight: "600",
                  marginBottom: 8,
                }}
              >
                Sign Out
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 14,
                  marginBottom: 24,
                }}
              >
                Are you sure you want to sign out?
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <Pressable
                  style={{ paddingHorizontal: 16, paddingVertical: 8 }}
                  onPress={() => setLogoutDialogOpen(false)}
                >
                  <Text style={{ color: colors.foreground }}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 6,
                  }}
                  onPress={handleLogoutConfirm}
                >
                  <Text style={{ color: "#ef4444", fontWeight: "600" }}>Sign Out</Text>
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
          <View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
            <BlurView
              intensity={20}
              tint="dark"
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                padding: 16,
              }}
            >
              <Pressable
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
                onPress={() => setLogoutDialogOpen(false)}
              />
              <View
                style={{
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                  borderRadius: 8,
                  borderWidth: 1,
                  padding: 24,
                  width: "100%",
                  maxWidth: 400,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 5,
                }}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 18,
                    fontWeight: "600",
                    marginBottom: 8,
                  }}
                >
                  Sign Out
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 14,
                    marginBottom: 24,
                  }}
                >
                  Are you sure you want to sign out?
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    gap: 12,
                  }}
                >
                  <Pressable
                    style={{ paddingHorizontal: 16, paddingVertical: 8 }}
                    onPress={() => setLogoutDialogOpen(false)}
                  >
                    <Text style={{ color: colors.foreground }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 6,
                    }}
                    onPress={handleLogoutConfirm}
                  >
                    <Text style={{ color: "#ef4444", fontWeight: "600" }}>Sign Out</Text>
                  </Pressable>
                </View>
              </View>
            </BlurView>
          </View>
        </Modal>
      )}
    </View>
  );
}

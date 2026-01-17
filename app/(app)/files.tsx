"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { deleteFile, getFileDownloadUrl, listFiles, uploadFile } from "@/lib/files";
import type { File as FileRecord } from "@/lib/supabase";
import { THEME } from "@/lib/theme";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { Stack } from "expo-router";
import { Download, Plus, Search, Trash2 } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function FilesScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [uploading, setUploading] = useState(false);

  const {
    data: files = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["files", user?.id],
    queryFn: () => listFiles(user?.id),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [fileToAction, setFileToAction] = useState<FileRecord | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFile(id),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      await refetch();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setActionDialogOpen(false);
      setFileToAction(null);
    },
  });

  const handleUploadFile = async () => {
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !user) {
        return;
      }

      setUploading(true);

      const file = result.assets[0];
      
      // Get file URI - handle different platforms
      // On web, expo-document-picker may return a File object directly
      let fileUri: string | globalThis.File = file.uri;
      if (Platform.OS === "web" && (file as any).file) {
        // On web, if file is a File object, use it directly
        fileUri = (file as any).file;
      }

      // Use file size from picker
      const fileSize = file.size || 0;

      await uploadFile({
        user_id: user.id,
        file: {
          uri: fileUri as any, // Type assertion needed due to DOM File vs our File interface
          name: file.name,
          type: file.mimeType || "application/octet-stream",
          size: fileSize,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["files"] });
      await refetch();
      
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Success", "File uploaded successfully");
    } catch (error: any) {
      console.error("Upload error:", error);
      Alert.alert("Error", error.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleRightClickAction = (file: FileRecord) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setFileToAction(file);
    setActionDialogOpen(true);
  };

  const handleDownload = async () => {
    if (!fileToAction) return;

    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      const downloadUrl = await getFileDownloadUrl(fileToAction.file_path);

      if (Platform.OS === "web") {
        // For web, open in new tab
        if (typeof window !== "undefined") {
          window.open(downloadUrl, "_blank");
        }
      } else {
        // For native, use Linking to open the URL
        const canOpen = await Linking.canOpenURL(downloadUrl);
        if (canOpen) {
          await Linking.openURL(downloadUrl);
        } else {
          Alert.alert("Error", "Cannot open file URL");
        }
      }

      setActionDialogOpen(false);
      setFileToAction(null);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to download file");
    }
  };

  const handleDeleteConfirm = () => {
    if (fileToAction) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      deleteMutation.mutate(fileToAction.id);
    }
  };

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onRefresh = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await refetch();
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <View
      className="flex-1 w-full mx-auto"
      style={{ backgroundColor: colors.background }}
    >
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
              Files
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Pressable
              onPress={handleUploadFile}
              disabled={uploading}
              style={{ padding: 8 }}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={colors.foreground} />
              ) : (
                <Plus color={colors.foreground} size={22} strokeWidth={2.5} />
              )}
            </Pressable>
          </View>
        </View>
      </View>
      <View className="w-full h-full">
        {/* Search Container */}
        <View className="w-full max-w-3xl mx-auto">
          <View className="flex-row items-center mx-4 my-3 px-4 rounded-2xl h-14 border border-border bg-muted">
            <Search
              className="text-muted border-border mr-2"
              color={THEME.light.mutedForeground}
              size={20}
            />
            <Input
              className="flex-1 h-full border-0 bg-transparent px-2 shadow-none"
              placeholder="Search files..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="muted-foreground"
            />
          </View>
        </View>

        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="foreground" />
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerClassName="p-4 pb-32"
            refreshControl={
              <RefreshControl
                progressBackgroundColor={colors.background}
                refreshing={isFetching}
                onRefresh={onRefresh}
                tintColor={colors.foreground}
                colors={[colors.foreground]}
              />
            }
          >
            {filteredFiles.length === 0 ? (
              <View className="w-full max-w-2xl mx-auto flex-1 justify-center items-center pt-24">
                <Text className="text-xl font-semibold text-muted-foreground mb-2">
                  {searchQuery ? "No files found" : "No files yet"}
                </Text>
                <Text className="text-sm text-muted-foreground text-center">
                  {searchQuery
                    ? "Try a different search"
                    : "Tap the + button to upload your first file"}
                </Text>
              </View>
            ) : (
              filteredFiles.map((file: FileRecord) => (
                <View key={file.id} className="w-full max-w-2xl mx-auto">
                  <FileCard
                    file={file}
                    onDelete={() => handleRightClickAction(file)}
                    onRightClickAction={
                      Platform.OS === "web"
                        ? () => handleRightClickAction(file)
                        : undefined
                    }
                    formatFileSize={formatFileSize}
                  />
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>

      {/* Action Dialog (Download/Delete) */}
      {Platform.OS === "web" ? (
        actionDialogOpen && (
          <View
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            style={{
              position: "fixed" as any,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 50,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
            }}
          >
            <Pressable
              className="absolute inset-0"
              style={{ position: "absolute" as any }}
              onPress={() => setActionDialogOpen(false)}
            />
            <View
              className="bg-background border-border w-full max-w-md rounded-lg border p-6 shadow-lg"
              style={{
                backgroundColor: colors.background,
                borderColor: colors.border,
                borderRadius: 8,
                padding: 24,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
              }}
            >
              <Text
                className="text-lg font-semibold mb-4"
                style={{
                  color: colors.foreground,
                  fontSize: 18,
                  fontWeight: "600",
                  marginBottom: 16,
                }}
              >
                {fileToAction?.name}
              </Text>
              <View
                className="flex-row justify-end gap-3"
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <Pressable
                  className="px-4 py-2 rounded-md"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 6,
                    backgroundColor: "#22c55e",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                  onPress={handleDownload}
                >
                  <Download color="#ffffff" size={18} />
                  <Text style={{ color: "#ffffff", fontWeight: "600" }}>
                    Download
                  </Text>
                </Pressable>
                <Pressable
                  className="px-4 py-2 rounded-md"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 6,
                    backgroundColor: "#ef4444",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                  onPress={handleDeleteConfirm}
                >
                  <Trash2 color="#ffffff" size={18} />
                  <Text style={{ color: "#ffffff", fontWeight: "600" }}>
                    Delete
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )
      ) : (
        <Modal
          visible={actionDialogOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setActionDialogOpen(false)}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
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
              onPress={() => setActionDialogOpen(false)}
            />
            <View
              style={{
                backgroundColor: colors.background,
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
                  marginBottom: 16,
                }}
              >
                {fileToAction?.name}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <Pressable
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 6,
                    backgroundColor: "#22c55e",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                  onPress={handleDownload}
                >
                  <Download color="#ffffff" size={18} />
                  <Text style={{ color: "#ffffff", fontWeight: "600" }}>
                    Download
                  </Text>
                </Pressable>
                <Pressable
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 6,
                    backgroundColor: "#ef4444",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                  onPress={handleDeleteConfirm}
                >
                  <Trash2 color="#ffffff" size={18} />
                  <Text style={{ color: "#ffffff", fontWeight: "600" }}>
                    Delete
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

interface FileCardProps {
  file: FileRecord;
  onDelete: () => void;
  onRightClickAction?: () => void;
  formatFileSize: (bytes: number) => string;
}

function FileCard({
  file,
  onDelete,
  onRightClickAction,
  formatFileSize,
}: FileCardProps) {
  const scale = new Animated.Value(1);

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 3,
    }).start();
  };

  const handleContextMenu = (e: any) => {
    if (Platform.OS === "web" && onRightClickAction) {
      e.preventDefault();
      onRightClickAction();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLongPress={onDelete}
      {...(Platform.OS === "web" && {
        onContextMenu: handleContextMenu,
      })}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Card className="p-4 mb-3 rounded-2xl bg-muted border border-border">
          <Text
            className="text-xl font-semibold text-foreground mb-2"
            numberOfLines={1}
          >
            {file.name}
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 8 }}>
            <Text className="text-sm text-muted-foreground">
              {file.extension.toUpperCase()}
            </Text>
            <Text className="text-sm text-muted-foreground">•</Text>
            <Text className="text-sm text-muted-foreground">
              {formatFileSize(file.file_size)}
            </Text>
          </View>
          <Text className="text-xs text-muted-foreground/70">
            {formatDate(file.updated_at)}
          </Text>
        </Card>
      </Animated.View>
    </Pressable>
  );
}

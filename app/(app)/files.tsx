"use client";

import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { archiveFile, getFileDownloadUrl, listFiles, uploadFile } from "@/lib/files";
import { invalidateFilesQueries } from "@/lib/query-utils";
import type { File as FileRecord } from "@/lib/supabase";
import { THEME } from "@/lib/theme";
import { useThemeColors } from "@/lib/use-theme-colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { Stack } from "expo-router";
import { ExternalLink, LayoutGrid, Plus, Rows2, Search, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// WebView is native-only; avoid importing on web to prevent native-module errors
const WebView =
  Platform.OS === "web"
    ? null
    : require("react-native-webview").WebView;

const FILES_VIEW_MODE_STORAGE_KEY = "@files_view_mode";

export default function FilesScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [isViewModeLoaded, setIsViewModeLoaded] = useState(false);
  const [screenWidth, setScreenWidth] = useState(() => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        return window.innerWidth;
      }
    }
    return Dimensions.get("window").width;
  });

  // Load saved view mode preference on mount
  useEffect(() => {
    const loadViewMode = async () => {
      try {
        const savedViewMode = await AsyncStorage.getItem(FILES_VIEW_MODE_STORAGE_KEY);
        if (savedViewMode && (savedViewMode === "grid" || savedViewMode === "list")) {
          setViewMode(savedViewMode);
        }
      } catch (error) {
        console.error("Failed to load view mode:", error);
      } finally {
        setIsViewModeLoaded(true);
      }
    };
    loadViewMode();
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      const handleResize = () => {
        if (typeof window !== "undefined") {
          setScreenWidth(window.innerWidth);
        }
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    } else {
      const subscription = Dimensions.addEventListener("change", ({ window }) => {
        setScreenWidth(window.width);
      });
      return () => subscription?.remove();
    }
  }, []);

  // Save view mode preference whenever it changes
  useEffect(() => {
    if (isViewModeLoaded) {
      const saveViewMode = async () => {
        try {
          await AsyncStorage.setItem(FILES_VIEW_MODE_STORAGE_KEY, viewMode);
        } catch (error) {
          console.error("Failed to save view mode:", error);
        }
      };
      saveViewMode();
    }
  }, [viewMode, isViewModeLoaded]);

  const columns = 2;

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
    staleTime: 5 * 60 * 1000, // 5 minutes - cache for 5 minutes
    retry: false, // When offline, fail once and show cached file list from listFiles() fallback
    // Use cached data immediately, don't show loading if we have cache
    placeholderData: (previousData) => previousData,
    retryOnMount: false,
  });

  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [fileToAction, setFileToAction] = useState<FileRecord | null>(null);
  /** In-app preview URL (native only). When set, a modal WebView is shown instead of opening the browser. */
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  /** Original Supabase bucket URL; used for "open in browser" redirect (not Google viewer). */
  const [previewRawUrl, setPreviewRawUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string | null>(null);

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveFile(id),
    onSuccess: () => {
      invalidateFilesQueries(queryClient, user?.id);
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

      invalidateFilesQueries(queryClient, user.id);

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

  /** On mobile WebView, use a viewer URL for PDFs (and similar) so content displays inline instead of downloading.
   *  Use embedded=false so the full Google Docs viewer UI is shown (Add to Drive, Print, Share, menu). */
  const getPreviewUrlForWebView = (rawUrl: string, fileName: string): string => {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    const viewableDocs = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"];
    if (viewableDocs.includes(ext)) {
      return `https://docs.google.com/gview?url=${encodeURIComponent(rawUrl)}&embedded=false`;
    }
    return rawUrl;
  };

  const handleFilePress = async (file: FileRecord) => {
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      const downloadUrl = await getFileDownloadUrl(file.file_path);

      if (Platform.OS === "web") {
        // For web, open in new tab (browser)
        if (typeof window !== "undefined") {
          window.open(downloadUrl, "_blank");
        }
      } else {
        // For native (iOS/Android), open in-app WebView with a viewer URL when needed so content previews instead of downloading
        setPreviewFileName(file.name);
        setPreviewRawUrl(downloadUrl);
        setPreviewUrl(getPreviewUrlForWebView(downloadUrl, file.name));
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to open file");
    }
  };

  const closePreview = () => {
    setPreviewUrl(null);
    setPreviewRawUrl(null);
    setPreviewFileName(null);
  };

  const handleArchiveConfirm = () => {
    if (fileToAction) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      archiveMutation.mutate(fileToAction.id);
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
              Files
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
              paddingRight: 8,
            }}
          >
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
                const newViewMode = viewMode === "grid" ? "list" : "grid";
                setViewMode(newViewMode);
              }}
              style={{ paddingVertical: 8 }}
            >
              {viewMode === "grid" ? (
                <Rows2 color={colors.foreground} size={22} strokeWidth={2.5} />
              ) : (
                <LayoutGrid color={colors.foreground} size={22} strokeWidth={2.5} />
              )}
            </Pressable>
            <Pressable
              onPress={handleUploadFile}
              disabled={uploading}
              style={{ paddingVertical: 8 }}
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
            {searchQuery ? (
              <Pressable
                onPress={() => {
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSearchQuery("");
                }}
                className="p-1.5 rounded-full"
                hitSlop={8}
              >
                <X color={THEME.light.mutedForeground} size={18} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color={colors.foreground} />
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
            ) : viewMode === "grid" ? (
              <View className="w-full max-w-2xl mx-auto">
                {(() => {
                  // Calculate card width to fill available space evenly
                  // max-w-2xl is 672px
                  const maxWidth = 672; // max-w-2xl
                  const containerPadding = 16; // p-4 = 16px
                  const gap = 8; // half of 16 so column gap (8+gap+8) matches edge feel
                  const availableWidth = Math.min(screenWidth, maxWidth) - containerPadding * 2;
                  // Calculate width to fill evenly: (availableWidth - gaps) / columns
                  const cardWidth = (availableWidth - gap * (columns - 1)) / columns;

                  // Calculate total width needed for grid
                  const totalWidth = cardWidth * columns + gap * (columns - 1);

                  return (
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        justifyContent: "flex-start",
                        width: totalWidth,
                        alignSelf: "center",
                      }}
                    >
                      {filteredFiles.map((file: FileRecord, index: number) => {
                        // Calculate margins for grid spacing
                        const marginRight = index % columns < columns - 1 ? gap : 0;
                        const marginBottom = 16;

                        return (
                          <View
                            key={file.id}
                            style={{
                              width: cardWidth,
                              marginRight,
                              marginBottom,
                            }}
                          >
                            <FileCard
                              file={file}
                              onPress={() => handleFilePress(file)}
                              onDelete={() => handleRightClickAction(file)}
                              onRightClickAction={
                                Platform.OS === "web"
                                  ? () => handleRightClickAction(file)
                                  : undefined
                              }
                              formatFileSize={formatFileSize}
                              cardWidth={cardWidth}
                            />
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}
              </View>
            ) : (
              <View className="w-full max-w-2xl mx-auto">
                {(() => {
                  // List view: full width row cards
                  const maxWidth = 672; // max-w-2xl
                  const containerPadding = 16; // p-4 = 16px
                  const gap = 12; // gap between cards
                  const availableWidth = Math.min(screenWidth, maxWidth) - containerPadding * 2;
                  const cardWidth = availableWidth;

                  return (
                    <View style={{ width: cardWidth, alignSelf: "center" }}>
                      {filteredFiles.map((file: FileRecord, index: number) => (
                        <View
                          key={file.id}
                          style={{
                            marginBottom: index < filteredFiles.length - 1 ? gap : 0,
                          }}
                        >
                          <FileListCard
                            file={file}
                            onPress={() => handleFilePress(file)}
                            onDelete={() => handleRightClickAction(file)}
                            onRightClickAction={
                              Platform.OS === "web"
                                ? () => handleRightClickAction(file)
                                : undefined
                            }
                            formatFileSize={formatFileSize}
                            cardWidth={cardWidth}
                          />
                        </View>
                      ))}
                    </View>
                  );
                })()}
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Action Dialog (Download/Delete) */}
      {Platform.OS === "web" ? (
        actionDialogOpen && (
          <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Pressable
              className="absolute inset-0"
              onPress={() => setActionDialogOpen(false)}
            />
            <View className="w-full max-w-md rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">
                Archive File
              </Text>
              <Text className="mb-6 text-sm text-muted-foreground">
                Are you sure you want to archive "{fileToAction?.name}"? You can restore it from the archive later.
              </Text>
              <View className="flex-row justify-end gap-3">
                <Pressable
                  className="px-4 py-2"
                  onPress={() => {
                    setActionDialogOpen(false);
                    setFileToAction(null);
                  }}
                >
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className="rounded-md px-4 py-2"
                  onPress={handleArchiveConfirm}
                >
                  <Text className="font-semibold text-red-500">
                    Archive
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
          <View className="flex-1 items-center justify-center bg-black/50 p-4">
            <Pressable
              className="absolute inset-0"
              onPress={() => setActionDialogOpen(false)}
            />
            <View className="w-full max-w-[400px] rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">
                Archive File
              </Text>
              <Text className="mb-6 text-sm text-muted-foreground">
                Are you sure you want to archive "{fileToAction?.name}"? You can restore it from the archive later.
              </Text>
              <View className="flex-row justify-end gap-3">
                <Pressable
                  className="px-4 py-2"
                  onPress={() => {
                    setActionDialogOpen(false);
                    setFileToAction(null);
                  }}
                >
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className="rounded-md px-4 py-2"
                  onPress={handleArchiveConfirm}
                >
                  <Text className="font-semibold text-red-500">
                    Archive
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* In-app WebView preview (native only; web keeps opening in browser tab) */}
      {Platform.OS !== "web" && previewUrl !== null && (
        <Modal
          visible={true}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={closePreview}
        >
          <View className="flex-1 bg-background">
            {/* Header — same paddings and layout as share/[token].tsx */}
            <View
              style={{
                width: "100%",
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
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    flex: 1,
                    minWidth: 0,
                    paddingLeft: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 18,
                      color: colors.foreground,
                      flex: 1,
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {previewFileName ?? "Preview"}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 16,
                    marginLeft: 16,
                    paddingRight: 8,
                  }}
                >
                  <Pressable
                    onPress={() => {
                      const url = previewRawUrl ?? previewUrl;
                      if (url) Linking.openURL(url);
                    }}
                    style={{ paddingVertical: 8 }}
                  >
                    <ExternalLink color={colors.foreground} size={22} strokeWidth={2.5} />
                  </Pressable>
                  <Pressable onPress={closePreview} style={{ paddingVertical: 8 }}>
                    <X color={colors.foreground} size={24} strokeWidth={2} />
                  </Pressable>
                </View>
              </View>
            </View>
            {WebView ? (
              <WebView
                source={{ uri: previewUrl }}
                style={{ flex: 1 }}
                onError={() => {
                  Alert.alert("Error", "Failed to load preview");
                  closePreview();
                }}
              />
            ) : null}
          </View>
        </Modal>
      )}
    </View>
  );
}

interface FileCardProps {
  file: FileRecord;
  onPress: () => void;
  onDelete: () => void;
  onRightClickAction?: () => void;
  formatFileSize: (bytes: number) => string;
  cardWidth: number;
}

function FileCard({
  file,
  onPress,
  onDelete,
  onRightClickAction,
  formatFileSize,
  cardWidth,
}: FileCardProps) {
  const { colors } = useThemeColors();
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
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  // File icon dimensions - scale to fill card width
  const padding = 8; // Padding around the file icon
  const fileWidth = cardWidth - padding * 2; // Use full available width minus padding
  const fileHeight = (fileWidth / 130) * 150; // Maintain aspect ratio (120:150)
  const foldSize = Math.max(20, fileWidth * 0.2); // Size of the folded corner

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      onLongPress={onDelete}
      {...(Platform.OS === "web" && {
        onContextMenu: handleContextMenu,
      })}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View className="mb-3 items-center">
          {/* File Icon Shape */}
          <View
            className="bg-muted rounded overflow-hidden relative"
            style={{ width: fileWidth, height: fileHeight }}
          >
            {/* Folded Corner Inner Triangle (darker shade for depth) */}
            <View
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 0,
                height: 0,
                borderTopWidth: foldSize,
                borderRightWidth: foldSize,
                borderTopColor: colors.background,
                borderRightColor: "transparent",
                borderBottomWidth: 0,
                borderLeftWidth: 0,
                opacity: 1,
                transform: [{ rotate: "90deg" }],
              }}
            />

            {/* Content inside file icon */}
            <View
              className="flex-1 p-3 pt-4 justify-between"
              style={{ paddingRight: foldSize + 4 }}
            >
              <View className="flex-1">
                <Text
                  className="text-sm font-semibold text-foreground mb-1"
                  numberOfLines={2}
                >
                  {file.name.length > 15
                    ? file.name.substring(0, 15) + "..."
                    : file.name}
                </Text>
                <Text className="text-[10px] text-muted-foreground mt-1">
                  {file.extension.toUpperCase()}
                </Text>
              </View>
              <View className="mt-auto">
                <Text className="text-[9px] text-muted-foreground opacity-70">
                  {formatFileSize(file.file_size)}
                </Text>
              </View>
            </View>
          </View>

          {/* File info below icon */}
          <View
            className="mt-2 items-center"
            style={{ width: cardWidth }}
          >
            <Text
              className="text-xs font-medium text-foreground text-center"
              numberOfLines={1}
            >
              {file.name}
            </Text>
            <Text className="text-[10px] text-muted-foreground mt-0.5">
              {formatDate(file.updated_at)}
            </Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

interface FileListCardProps {
  file: FileRecord;
  onPress: () => void;
  onDelete: () => void;
  onRightClickAction?: () => void;
  formatFileSize: (bytes: number) => string;
  cardWidth: number;
}

function FileListCard({
  file,
  onPress,
  onDelete,
  onRightClickAction,
  formatFileSize,
  cardWidth,
}: FileListCardProps) {
  const { colors } = useThemeColors();
  const scale = new Animated.Value(1);

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.98,
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
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  // List card dimensions - horizontal rectangle
  const cardHeight = 80; // Fixed height for list items
  const iconSize = 56; // Icon size for list view
  const padding = 12;
  const foldSize = Math.max(12, iconSize * 0.2);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      onLongPress={onDelete}
      {...(Platform.OS === "web" && {
        onContextMenu: handleContextMenu,
      })}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View
          className="flex-row items-center p-3 gap-3 bg-muted border border-border rounded-xl"
          style={{ width: cardWidth, height: cardHeight }}
        >
          {/* File Icon - Smaller version for list */}
          <View
            className="bg-background border border-muted rounded overflow-hidden relative"
            style={{ width: iconSize, height: iconSize }}
          >
            {/* Folded Corner */}
            <View
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 0,
                height: 0,
                borderTopWidth: foldSize,
                borderRightWidth: foldSize,
                borderTopColor: colors.muted,
                borderRightColor: "transparent",
                borderBottomWidth: 0,
                borderLeftWidth: 0,
                opacity: 1,
                transform: [{ rotate: "90deg" }],
              }}
            />

            {/* Content inside file icon */}
            <View
              className="flex-1 pt-2 justify-between"
              style={{ padding: 6, paddingRight: foldSize + 2 }}
            >
              <Text
                className="text-[8px] font-semibold text-foreground"
                numberOfLines={1}
              >
                {file.extension.toUpperCase().slice(0, 3)}
              </Text>
              <View className="mt-auto">
                <Text className="text-[6px] text-muted-foreground opacity-70">
                  {formatFileSize(file.file_size)}
                </Text>
              </View>
            </View>
          </View>

          {/* File Info */}
          <View className="flex-1 justify-center gap-1">
            <Text
              className="text-sm font-semibold text-foreground"
              numberOfLines={1}
            >
              {file.name}
            </Text>
            <View className="flex-row items-center gap-2">
              <Text className="text-[11px] text-muted-foreground uppercase">
                {file.extension}
              </Text>
              <Text className="text-[11px] text-muted-foreground">•</Text>
              <Text className="text-[11px] text-muted-foreground">
                {formatFileSize(file.file_size)}
              </Text>
              <Text className="text-[11px] text-muted-foreground">•</Text>
              <Text className="text-[11px] text-muted-foreground">
                {formatDate(file.updated_at)}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

"use client";

import { FileCard, FileListCard } from "@/components/file-card";
import { FileUploadModal } from "@/components/file-upload-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { archiveFile, getFileDownloadUrl, listFiles, updateFile, uploadFile } from "@/lib/files";
import { listFolders } from "@/lib/folders";
import { invalidateFilesQueries, invalidateFoldersQueries } from "@/lib/query-utils";
import type { File as FileRecord } from "@/lib/supabase";
import { THEME } from "@/lib/theme";
import { useThemeColors } from "@/lib/use-theme-colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack } from "expo-router";
import { ChevronDown, ExternalLink, LayoutGrid, Plus, Rows2, Search, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
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
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
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

  const { data: folders = [] } = useQuery({
    queryKey: ["folders", user?.id],
    queryFn: () => listFolders(user?.id),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  });

  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [fileToAction, setFileToAction] = useState<FileRecord | null>(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [dropdownTriggerWidth, setDropdownTriggerWidth] = useState(0);
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
      setOptionsModalOpen(false);
      setSelectedFile(null);
    },
  });

  const moveFileMutation = useMutation({
    mutationFn: ({ fileId, folderId }: { fileId: string; folderId: string | null }) =>
      updateFile(fileId, { folder_id: folderId }),
    onSuccess: (_data, { fileId }) => {
      invalidateFilesQueries(queryClient, user?.id);
      invalidateFoldersQueries(queryClient, user?.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMoveModalOpen(false);
      setSelectedFile(null);
      setSelectedFolderId(null);
      setDropdownTriggerWidth(0);
    },
  });

  const handleOpenUploadModal = () => {
    setUploadModalOpen(true);
  };

  const handleUploadFromModal = async (params: {
    file: { uri: string | globalThis.File; name: string; type: string; size: number };
  }) => {
    if (!user) return;
    await uploadFile({
      user_id: user.id,
      file: params.file,
    });
    invalidateFilesQueries(queryClient, user.id);
    Alert.alert("Success", "File uploaded successfully");
  };

  const handleLongPressFile = (file: FileRecord) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSelectedFile(file);
    setOptionsModalOpen(true);
  };

  const openArchiveConfirm = () => {
    setOptionsModalOpen(false);
    if (selectedFile) {
      setFileToAction(selectedFile);
      setActionDialogOpen(true);
      setSelectedFile(null);
    }
  };

  const openMoveModal = () => {
    setOptionsModalOpen(false);
    setSelectedFolderId(selectedFile?.folder_id ?? null);
    setMoveModalOpen(true);
  };

  const handleMoveConfirm = () => {
    if (!selectedFile) return;
    moveFileMutation.mutate({
      fileId: selectedFile.id,
      folderId: selectedFolderId,
    });
  };

  const closeMoveModal = () => {
    setMoveModalOpen(false);
    setSelectedFile(null);
    setSelectedFolderId(null);
    setDropdownTriggerWidth(0);
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
                <Rows2 color={colors.foreground} size={22} />
              ) : (
                <LayoutGrid color={colors.foreground} size={22} />
              )}
            </Pressable>
            <Pressable
              onPress={handleOpenUploadModal}
              style={{ paddingVertical: 8 }}
            >
              <Plus color={colors.foreground} size={22} />
            </Pressable>
          </View>
        </View>
      </View>

      <FileUploadModal
        visible={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUpload={handleUploadFromModal}
        title="Upload file"
      />

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
                  const columnGap = 6; // horizontal gap between columns
                  const rowGap = 12; // vertical gap between cards
                  const availableWidth = Math.min(screenWidth, maxWidth) - containerPadding * 2;
                  // Calculate width to fill evenly: (availableWidth - gaps) / columns
                  const cardWidth = (availableWidth - columnGap * (columns - 1)) / columns;

                  // Calculate total width needed for grid
                  const totalWidth = cardWidth * columns + columnGap * (columns - 1);

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
                        const marginRight = index % columns < columns - 1 ? columnGap : 0;
                        const marginBottom = rowGap;

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
                              onDelete={() => handleLongPressFile(file)}
                              onRightClickAction={
                                Platform.OS === "web"
                                  ? () => handleLongPressFile(file)
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
                            onDelete={() => handleLongPressFile(file)}
                            onRightClickAction={
                              Platform.OS === "web"
                                ? () => handleLongPressFile(file)
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

      {/* Long-press options modal: iOS-style action sheet */}
      {Platform.OS === "web" ? (
        optionsModalOpen && selectedFile && (
          <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Pressable
              className="absolute inset-0"
              onPress={() => { setOptionsModalOpen(false); setSelectedFile(null); }}
            />
            <View className="w-full max-w-[280px] items-center">
              <View className="mb-3 w-full rounded-xl border border-border bg-muted px-4 py-3 shadow-sm">
                <Text className="text-center text-sm font-medium text-muted-foreground" numberOfLines={1}>
                  {selectedFile.name}
                </Text>
              </View>
              <View className="w-full overflow-hidden rounded-xl border border-border bg-muted shadow-sm">
                <Pressable
                  className="items-center justify-center border-b border-border py-3.5 active:bg-accent"
                  onPress={openMoveModal}
                >
                  <Text className="text-base font-medium text-blue-500">Move to</Text>
                </Pressable>
                <Pressable
                  className="items-center justify-center py-3.5 active:bg-accent"
                  onPress={openArchiveConfirm}
                >
                  <Text className="text-base font-semibold text-red-500">Archive</Text>
                </Pressable>
              </View>
              <Pressable
                className="mt-2 w-full items-center justify-center rounded-xl border border-border bg-muted py-3.5 shadow-sm active:bg-accent"
                onPress={() => { setOptionsModalOpen(false); setSelectedFile(null); }}
              >
                <Text className="text-base font-semibold text-foreground">Cancel</Text>
              </Pressable>
            </View>
          </View>
        )
      ) : (
        <Modal
          visible={optionsModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => { setOptionsModalOpen(false); setSelectedFile(null); }}
        >
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", padding: 24 }}>
            <Pressable
              style={StyleSheet.absoluteFillObject}
              onPress={() => { setOptionsModalOpen(false); setSelectedFile(null); }}
            />
            <View style={{ width: "100%", maxWidth: 280, alignItems: "center" }}>
              <View
                style={{
                  width: "100%",
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.muted,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  marginBottom: 12,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                }}
              >
                <Text
                  style={{ textAlign: "center", fontSize: 14, fontWeight: "500", color: colors.mutedForeground }}
                  numberOfLines={1}
                >
                  {selectedFile?.name ?? "File"}
                </Text>
              </View>
              <View
                style={{
                  width: "100%",
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.muted,
                  overflow: "hidden",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                }}
              >
                <Pressable
                  style={{
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                  onPress={openMoveModal}
                >
                  <Text style={{ fontSize: 16, fontWeight: "500", color: "#3b82f6" }}>Move to</Text>
                </Pressable>
                <Pressable
                  style={{ width: "100%", alignItems: "center", justifyContent: "center", paddingVertical: 14 }}
                  onPress={openArchiveConfirm}
                >
                  <Text style={{ fontSize: 16, fontWeight: "600", color: colors.destructive }}>Archive</Text>
                </Pressable>
              </View>
              <Pressable
                style={{
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 8,
                  paddingVertical: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.muted,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                }}
                onPress={() => { setOptionsModalOpen(false); setSelectedFile(null); }}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {/* Move to folder modal */}
      {Platform.OS === "web" ? (
        moveModalOpen && selectedFile && (
          <View className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <Pressable className="absolute inset-0" onPress={closeMoveModal} />
            <View className="w-full max-w-md rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">
                Move to
              </Text>
              <Text className="mb-4 text-sm text-muted-foreground">
                Choose a folder for "{selectedFile.name}"
              </Text>
              <View
                className="mb-6 w-full"
                onLayout={(e) => setDropdownTriggerWidth(e.nativeEvent.layout.width)}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Pressable className="w-full flex-row items-center justify-between rounded-md border border-border bg-background px-3 py-2.5">
                      <Text className="text-sm text-foreground">
                        {selectedFolderId == null
                          ? "No folder"
                          : folders.find((f) => f.id === selectedFolderId)?.name ?? "Select folder"}
                      </Text>
                      <ChevronDown color={colors.mutedForeground} size={16} />
                    </Pressable>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    style={dropdownTriggerWidth > 0 ? { width: dropdownTriggerWidth } : undefined}
                  >
                    <DropdownMenuItem onPress={() => setSelectedFolderId(null)}>
                      <Text className="text-foreground">No folder</Text>
                    </DropdownMenuItem>
                    {folders.map((folder) => (
                      <DropdownMenuItem
                        key={folder.id}
                        onPress={() => setSelectedFolderId(folder.id)}
                      >
                        <Text className="text-foreground">{folder.name}</Text>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </View>
              <View className="flex-row justify-end gap-3">
                <Pressable className="px-4 py-2" onPress={closeMoveModal}>
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className="rounded-md px-4 py-2"
                  onPress={handleMoveConfirm}
                  disabled={moveFileMutation.isPending}
                >
                  <Text className="font-semibold text-blue-500">
                    {moveFileMutation.isPending ? "Moving…" : "Move"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )
      ) : (
        <Modal
          visible={moveModalOpen}
          transparent
          animationType="fade"
          onRequestClose={closeMoveModal}
        >
          <View className="flex-1 items-center justify-center bg-black/50 p-4">
            <Pressable className="absolute inset-0" onPress={closeMoveModal} />
            <View className="w-full max-w-[400px] rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">
                Move to
              </Text>
              <Text className="mb-4 text-sm text-muted-foreground">
                Choose a folder for "{selectedFile?.name}"
              </Text>
              <View
                style={{ marginBottom: 24, width: "100%" }}
                onLayout={(e) => setDropdownTriggerWidth(e.nativeEvent.layout.width)}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Pressable
                      style={{
                        width: "100%",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                      }}
                    >
                      <Text style={{ fontSize: 14, color: colors.foreground }}>
                        {selectedFolderId == null
                          ? "No folder"
                          : folders.find((f) => f.id === selectedFolderId)?.name ?? "Select folder"}
                      </Text>
                      <ChevronDown color={colors.mutedForeground} size={16} />
                    </Pressable>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    style={dropdownTriggerWidth > 0 ? { width: dropdownTriggerWidth } : undefined}
                  >
                    <DropdownMenuItem onPress={() => setSelectedFolderId(null)}>
                      <Text style={{ color: colors.foreground }}>No folder</Text>
                    </DropdownMenuItem>
                    {folders.map((folder) => (
                      <DropdownMenuItem
                        key={folder.id}
                        onPress={() => setSelectedFolderId(folder.id)}
                      >
                        <Text style={{ color: colors.foreground }}>{folder.name}</Text>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </View>
              <View className="flex-row justify-end gap-3">
                <Pressable className="px-4 py-2" onPress={closeMoveModal}>
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className="rounded-md px-4 py-2"
                  onPress={handleMoveConfirm}
                  disabled={moveFileMutation.isPending}
                >
                  <Text style={{ fontWeight: "600", color: "#3b82f6" }}>
                    {moveFileMutation.isPending ? "Moving…" : "Move"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Archive confirmation dialog */}
      {Platform.OS === "web" ? (
        actionDialogOpen && (
          <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Pressable
              className="absolute inset-0"
              onPress={() => { setActionDialogOpen(false); setFileToAction(null); }}
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
                    <ExternalLink color={colors.foreground} size={22} />
                  </Pressable>
                  <Pressable onPress={closePreview} style={{ paddingVertical: 8 }}>
                    <X color={colors.foreground} size={24} />
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


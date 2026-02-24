"use client";

import { FileCard, FileListCard } from "@/components/file-card";
import { FileUploadModal } from "@/components/file-upload-modal";
import { LongPressOptionsModal } from "@/components/long-press-options-modal";
import { MoveToFolderModal } from "@/components/move-to-folder-modal";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { archiveFile, listFiles, updateFile, uploadFile } from "@/lib/files";
import { listFolders } from "@/lib/folders";
import { invalidateFilesQueries, invalidateFoldersQueries } from "@/lib/query-utils";
import type { File as FileRecord } from "@/lib/supabase";
import { THEME } from "@/lib/theme";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useFilePreview } from "@/lib/use-file-preview";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack } from "expo-router";
import { LayoutGrid, Plus, Rows2, Search, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const { handleFilePress, PreviewModal } = useFilePreview();

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

      <LongPressOptionsModal
        visible={optionsModalOpen}
        onClose={() => { setOptionsModalOpen(false); setSelectedFile(null); }}
        title={selectedFile?.name ?? "File"}
        onMove={openMoveModal}
        onArchive={openArchiveConfirm}
      />

      <MoveToFolderModal
        visible={moveModalOpen}
        onClose={closeMoveModal}
        itemName={selectedFile?.name ?? "File"}
        selectedFolderId={selectedFolderId}
        onSelectFolder={setSelectedFolderId}
        folders={folders}
        onMoveConfirm={handleMoveConfirm}
        isPending={moveFileMutation.isPending}
      />

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

      {PreviewModal}
    </View>
  );
}


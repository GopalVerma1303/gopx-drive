"use client";

import { FileCard, FileListCard, formatFileSize } from "@/components/file-card";
import { FileUploadModal } from "@/components/file-upload-modal";
import { NoteCard } from "@/components/note-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { archiveFile, getFileDownloadUrl, listFilesByFolder, updateFile, uploadFile } from "@/lib/files";
import { getFolderById, listFolders } from "@/lib/folders";
import { archiveNote, getUnsyncedNoteIds, listNotesByFolder, updateNote } from "@/lib/notes";
import { invalidateFilesQueries, invalidateFoldersQueries, invalidateNotesListQueries } from "@/lib/query-utils";
import type { File as FileRecord, Note } from "@/lib/supabase";
import { THEME } from "@/lib/theme";
import { useThemeColors } from "@/lib/use-theme-colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ChevronDown, FileText, Files, Folder, LayoutGrid, Plus, Rows2, Search, X } from "lucide-react-native";
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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const gap = 12;
const maxWidth = 672;
const containerPadding = 16;
const FOLDER_NOTES_VIEW_MODE_STORAGE_KEY = "@folder_notes_view_mode";
const FOLDER_FILES_VIEW_MODE_STORAGE_KEY = "@folder_files_view_mode";

export default function FolderDetailScreen() {
  const { id, name: nameParam } = useLocalSearchParams<{ id: string; name?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"notes" | "files">("notes");
  const [searchQuery, setSearchQuery] = useState("");
  const [screenWidth, setScreenWidth] = useState(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      return window.innerWidth;
    }
    return Dimensions.get("window").width;
  });

  useEffect(() => {
    if (Platform.OS === "web") {
      const handleResize = () => setScreenWidth(window.innerWidth);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
    const sub = Dimensions.addEventListener("change", ({ window }) => setScreenWidth(window.width));
    return () => sub?.remove();
  }, []);

  const { data: folder, isLoading: folderLoading } = useQuery({
    queryKey: ["folder", id],
    queryFn: () => getFolderById(id ?? ""),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });

  const folderName = folder?.name ?? nameParam ?? "Folder";

  const { data: notesInFolder = [], isLoading: notesLoading, refetch: refetchNotes, isFetching: notesFetching } = useQuery({
    queryKey: ["folderNotes", id, user?.id],
    queryFn: () => listNotesByFolder(user?.id, id),
    enabled: !!user?.id && !!id,
    staleTime: 2 * 60 * 1000,
  });

  const { data: unsyncedNoteIds = [] } = useQuery({
    queryKey: ["notes-unsynced-ids", user?.id],
    queryFn: () => getUnsyncedNoteIds(user?.id),
    enabled: !!user?.id,
  });

  const { data: filesInFolder = [], isLoading: filesLoading, refetch: refetchFiles, isFetching: filesFetching } = useQuery({
    queryKey: ["folderFiles", id, user?.id],
    queryFn: () => listFilesByFolder(user?.id, id),
    enabled: !!user?.id && !!id,
    staleTime: 2 * 60 * 1000,
  });

  const { data: folders = [] } = useQuery({
    queryKey: ["folders", user?.id],
    queryFn: () => listFolders(user?.id),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  });

  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<
    | { type: "note"; item: Note }
    | { type: "file"; item: FileRecord }
    | null
  >(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [dropdownTriggerWidth, setDropdownTriggerWidth] = useState(0);
  const [notesViewMode, setNotesViewMode] = useState<"grid" | "list">("list");
  const [filesViewMode, setFilesViewMode] = useState<"grid" | "list">("list");
  const [areViewModesLoaded, setAreViewModesLoaded] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const archiveNoteMutation = useMutation({
    mutationFn: (noteId: string) => archiveNote(noteId),
    onSuccess: () => {
      invalidateFoldersQueries(queryClient, user?.id);
      invalidateNotesListQueries(queryClient, user?.id);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const archiveFileMutation = useMutation({
    mutationFn: (fileId: string) => archiveFile(fileId),
    onSuccess: () => {
      invalidateFoldersQueries(queryClient, user?.id);
      invalidateFilesQueries(queryClient, user?.id);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const moveNoteMutation = useMutation({
    mutationFn: ({ noteId, folderId }: { noteId: string; folderId: string | null }) =>
      updateNote(noteId, { folder_id: folderId }),
    onSuccess: (_data, { noteId }) => {
      invalidateNotesListQueries(queryClient, user?.id);
      invalidateFoldersQueries(queryClient, user?.id);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setMoveModalOpen(false);
      setSelectedItem(null);
      setSelectedFolderId(null);
      setDropdownTriggerWidth(0);
    },
  });

  const moveFileMutation = useMutation({
    mutationFn: ({ fileId, folderId }: { fileId: string; folderId: string | null }) =>
      updateFile(fileId, { folder_id: folderId }),
    onSuccess: (_data, { fileId }) => {
      invalidateFilesQueries(queryClient, user?.id);
      invalidateFoldersQueries(queryClient, user?.id);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setMoveModalOpen(false);
      setSelectedItem(null);
      setSelectedFolderId(null);
      setDropdownTriggerWidth(0);
    },
  });

  const filteredNotes = notesInFolder.filter((note) =>
    !searchQuery.trim() || note.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredFiles = filesInFolder.filter((file) =>
    !searchQuery.trim() || file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const cardWidth = Math.min(screenWidth, maxWidth) - containerPadding * 2;

  const currentViewMode = activeTab === "notes" ? notesViewMode : filesViewMode;

  // Load saved view modes for notes and files tabs
  useEffect(() => {
    const loadViewModes = async () => {
      try {
        const [savedNotesMode, savedFilesMode] = await Promise.all([
          AsyncStorage.getItem(FOLDER_NOTES_VIEW_MODE_STORAGE_KEY),
          AsyncStorage.getItem(FOLDER_FILES_VIEW_MODE_STORAGE_KEY),
        ]);

        if (savedNotesMode === "grid" || savedNotesMode === "list") {
          setNotesViewMode(savedNotesMode);
        }
        if (savedFilesMode === "grid" || savedFilesMode === "list") {
          setFilesViewMode(savedFilesMode);
        }
      } catch (error) {
        console.error("Failed to load folder view modes:", error);
      } finally {
        setAreViewModesLoaded(true);
      }
    };

    loadViewModes();
  }, []);

  // Persist view modes when they change
  useEffect(() => {
    if (!areViewModesLoaded) return;
    const saveViewModes = async () => {
      try {
        await Promise.all([
          AsyncStorage.setItem(FOLDER_NOTES_VIEW_MODE_STORAGE_KEY, notesViewMode),
          AsyncStorage.setItem(FOLDER_FILES_VIEW_MODE_STORAGE_KEY, filesViewMode),
        ]);
      } catch (error) {
        console.error("Failed to save folder view modes:", error);
      }
    };
    saveViewModes();
  }, [notesViewMode, filesViewMode, areViewModesLoaded]);

  const toggleViewMode = () => {
    if (activeTab === "notes") {
      setNotesViewMode((prev) => (prev === "grid" ? "list" : "grid"));
    } else {
      setFilesViewMode((prev) => (prev === "grid" ? "list" : "grid"));
    }
  };

  const handlePlusPress = () => {
    if (!user?.id || !id) return;
    if (activeTab === "notes") {
      router.push(`/(app)/note/new?folderId=${id}`);
    } else {
      setUploadModalOpen(true);
    }
  };

  const handleUploadToFolder = async (params: {
    file: { uri: string | globalThis.File; name: string; type: string; size: number };
  }) => {
    if (!user?.id || !id) return;
    const createdFile = await uploadFile({ user_id: user.id, file: params.file });
    await updateFile(createdFile.id, { folder_id: id });
    invalidateFilesQueries(queryClient, user.id);
    invalidateFoldersQueries(queryClient, user.id);
    Alert.alert("Success", "File uploaded to this folder");
  };

  const handleNoteLongPress = (note: Note) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSelectedItem({ type: "note", item: note });
    setOptionsModalOpen(true);
  };

  const handleFilePress = async (file: FileRecord) => {
    try {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const downloadUrl = await getFileDownloadUrl(file.file_path);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.open(downloadUrl, "_blank");
      } else {
        await Linking.openURL(downloadUrl);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to open file");
    }
  };

  const handleFileLongPress = (file: FileRecord) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSelectedItem({ type: "file", item: file });
    setOptionsModalOpen(true);
  };

  const closeOptionsModal = () => {
    setOptionsModalOpen(false);
    setSelectedItem(null);
  };

  const handleArchiveFromOptions = () => {
    if (!selectedItem) return;
    if (selectedItem.type === "note") {
      archiveNoteMutation.mutate(selectedItem.item.id);
    } else {
      archiveFileMutation.mutate(selectedItem.item.id);
    }
    setOptionsModalOpen(false);
    setSelectedItem(null);
  };

  const openMoveModal = () => {
    if (!selectedItem) return;
    const currentFolderId =
      selectedItem.type === "note" ? selectedItem.item.folder_id ?? null : selectedItem.item.folder_id ?? null;
    setSelectedFolderId(currentFolderId);
    setOptionsModalOpen(false);
    setMoveModalOpen(true);
  };

  const handleMoveConfirm = () => {
    if (!selectedItem) return;
    if (selectedItem.type === "note") {
      moveNoteMutation.mutate({ noteId: selectedItem.item.id, folderId: selectedFolderId });
    } else {
      moveFileMutation.mutate({ fileId: selectedItem.item.id, folderId: selectedFolderId });
    }
  };

  const closeMoveModal = () => {
    setMoveModalOpen(false);
    setSelectedItem(null);
    setSelectedFolderId(null);
    setDropdownTriggerWidth(0);
  };

  const onRefresh = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([refetchNotes(), refetchFiles()]);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View className="flex-1 w-full mx-auto" style={{ backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
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
            paddingHorizontal: 6,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 }}>
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.replace("/folders");
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
                flex: 1,
              }}
              numberOfLines={1}
            >
              {folderName}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
              paddingRight: 6,
            }}
          >
            <Pressable
              onPress={toggleViewMode}
              style={{ paddingVertical: 8 }}
            >
              {currentViewMode === "grid" ? (
                <Rows2 color={colors.foreground} size={22} />
              ) : (
                <LayoutGrid color={colors.foreground} size={22} />
              )}
            </Pressable>
            <Pressable
              onPress={handlePlusPress}
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
        onUpload={handleUploadToFolder}
        title="Upload to folder"
      />

      <View className="w-full h-full">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "notes" | "files")} className="flex-1">
          <View className="w-full max-w-3xl mx-auto">
            <View className="flex-row items-center mx-4 my-3 gap-2">
              <View className="flex-row items-center flex-1 min-w-0 px-4 rounded-2xl h-14 border border-border bg-muted">
                <Search className="text-muted border-border mr-2" color={THEME.light.mutedForeground} size={20} />
                <Input
                  className="flex-1 h-full border-0 bg-transparent px-2 shadow-none"
                  placeholder={`Search ${activeTab}...`}
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
              <Pressable
                onPress={() => {
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab(activeTab === "notes" ? "files" : "notes");
                }}
                className="p-2 rounded-2xl bg-muted items-center justify-center border border-border h-14 w-14"
              >
                {activeTab === "notes" ? (
                  <Files color={colors.mutedForeground} size={20} />
                ) : (
                  <FileText color={colors.mutedForeground} size={20} />
                )}
              </Pressable>
            </View>
          </View>

          <TabsContent value="notes" className="flex-1 -mt-2" style={{ flex: 1 }}>
            {notesLoading ? (
              <View className="flex-1 justify-center items-center" style={{ flex: 1 }}>
                <ActivityIndicator size="large" color={colors.foreground} />
              </View>
            ) : (
              <ScrollView
                className="flex-1"
                style={{ flex: 1 }}
                contentContainerClassName="p-4 pb-32"
                contentContainerStyle={{ flexGrow: 0 }}
                refreshControl={
                  <RefreshControl
                    progressBackgroundColor={colors.background}
                    refreshing={notesFetching}
                    onRefresh={onRefresh}
                    tintColor={colors.foreground}
                    colors={[colors.foreground]}
                  />
                }
              >
                {filteredNotes.length === 0 ? (
                  <View className="w-full max-w-2xl mx-auto flex-1 justify-center items-center pt-24">
                    <Folder color={colors.mutedForeground} size={48} style={{ marginBottom: 16 }} />
                    <Text className="text-xl font-semibold text-muted-foreground mb-2">
                      {searchQuery.trim() ? "No matching notes" : "No notes in this folder"}
                    </Text>
                    <Text className="text-sm text-muted-foreground text-center">
                      {searchQuery.trim() ? "Try a different search term" : "Notes you add to this folder will appear here"}
                    </Text>
                  </View>
                ) : notesViewMode === "grid" ? (
                  <View className="w-full max-w-2xl mx-auto">
                    {(() => {
                      const columnGap = 12;
                      const rowGap = 12;
                      const availableWidth = Math.min(screenWidth, maxWidth) - containerPadding * 2;
                      const columns = 2;
                      const noteCardWidth = (availableWidth - columnGap * (columns - 1)) / columns;
                      const totalWidth = noteCardWidth * columns + columnGap * (columns - 1);

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
                          {filteredNotes.map((note, index) => {
                            const marginRight = index % columns < columns - 1 ? columnGap : 0;
                            const marginBottom = rowGap;
                            return (
                              <View
                                key={note.id}
                                style={{
                                  width: noteCardWidth,
                                  marginRight,
                                  marginBottom,
                                }}
                              >
                                <NoteCard
                                  note={note}
                                  cardWidth={noteCardWidth}
                                  isSynced={!unsyncedNoteIds.includes(note.id)}
                                  onPress={() => {
                                    if (Platform.OS !== "web")
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    router.push(`/(app)/note/${note.id}`);
                                  }}
                                  onDelete={() => handleNoteLongPress(note)}
                                  onRightClickDelete={
                                    Platform.OS === "web" ? () => handleNoteLongPress(note) : undefined
                                  }
                                />
                              </View>
                            );
                          })}
                        </View>
                      );
                    })()}
                  </View>
                ) : (
                  <View style={{ width: cardWidth, alignSelf: "center" }}>
                    {filteredNotes.map((note, index) => (
                      <View
                        key={note.id}
                        style={{
                          marginBottom: index < filteredNotes.length - 1 ? gap : 0,
                        }}
                      >
                        <NoteCard
                          note={note}
                          cardWidth={cardWidth}
                          isSynced={!unsyncedNoteIds.includes(note.id)}
                          onPress={() => {
                            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            router.push(`/(app)/note/${note.id}`);
                          }}
                          onDelete={() => handleNoteLongPress(note)}
                          onRightClickDelete={
                            Platform.OS === "web" ? () => handleNoteLongPress(note) : undefined
                          }
                        />
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}
          </TabsContent>

          <TabsContent value="files" className="flex-1 -mt-2" style={{ flex: 1 }}>
            {filesLoading ? (
              <View className="flex-1 justify-center items-center" style={{ flex: 1 }}>
                <ActivityIndicator size="large" color={colors.foreground} />
              </View>
            ) : (
              <ScrollView
                className="flex-1"
                style={{ flex: 1 }}
                contentContainerClassName="p-4 pb-32"
                contentContainerStyle={{ flexGrow: 0 }}
                refreshControl={
                  <RefreshControl
                    progressBackgroundColor={colors.background}
                    refreshing={filesFetching}
                    onRefresh={onRefresh}
                    tintColor={colors.foreground}
                    colors={[colors.foreground]}
                  />
                }
              >
                {filteredFiles.length === 0 ? (
                  <View className="w-full max-w-2xl mx-auto flex-1 justify-center items-center pt-24">
                    <Folder color={colors.mutedForeground} size={48} style={{ marginBottom: 16 }} />
                    <Text className="text-xl font-semibold text-muted-foreground mb-2">
                      {searchQuery.trim() ? "No matching files" : "No files in this folder"}
                    </Text>
                    <Text className="text-sm text-muted-foreground text-center">
                      {searchQuery.trim() ? "Try a different search term" : "Files you add to this folder will appear here"}
                    </Text>
                  </View>
                ) : filesViewMode === "grid" ? (
                  <View className="w-full max-w-2xl mx-auto">
                    {(() => {
                      const columns = 2;
                      const columnGap = 6;
                      const rowGap = 12;
                      const availableWidth = Math.min(screenWidth, maxWidth) - containerPadding * 2;
                      const fileCardWidth = (availableWidth - columnGap * (columns - 1)) / columns;
                      const totalWidth = fileCardWidth * columns + columnGap * (columns - 1);

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
                          {filteredFiles.map((file, index) => {
                            const marginRight = index % columns < columns - 1 ? columnGap : 0;
                            const marginBottom = rowGap;
                            return (
                              <View
                                key={file.id}
                                style={{
                                  width: fileCardWidth,
                                  marginRight,
                                  marginBottom,
                                }}
                              >
                                <FileCard
                                  file={file}
                                  cardWidth={fileCardWidth}
                                  formatFileSize={formatFileSize}
                                  onPress={() => handleFilePress(file)}
                                  onDelete={() => handleFileLongPress(file)}
                                  onRightClickAction={
                                    Platform.OS === "web" ? () => handleFileLongPress(file) : undefined
                                  }
                                />
                              </View>
                            );
                          })}
                        </View>
                      );
                    })()}
                  </View>
                ) : (
                  <View style={{ width: cardWidth, alignSelf: "center" }}>
                    {filteredFiles.map((file, index) => (
                      <View
                        key={file.id}
                        style={{
                          marginBottom: index < filteredFiles.length - 1 ? gap : 0,
                        }}
                      >
                        <FileListCard
                          file={file}
                          cardWidth={cardWidth}
                          formatFileSize={formatFileSize}
                          onPress={() => handleFilePress(file)}
                          onDelete={() => handleFileLongPress(file)}
                          onRightClickAction={
                            Platform.OS === "web" ? () => handleFileLongPress(file) : undefined
                          }
                        />
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}
          </TabsContent>
        </Tabs>
      </View>

      {/* Long-press options modal for notes/files (iOS-style) */}
      {Platform.OS === "web" ? (
        optionsModalOpen && selectedItem && (
          <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Pressable
              className="absolute inset-0"
              onPress={closeOptionsModal}
            />
            <View className="w-full max-w-[280px] items-center">
              <View className="mb-3 w-full rounded-xl border border-border bg-muted px-4 py-3 shadow-sm">
                <Text className="text-center text-sm font-medium text-muted-foreground" numberOfLines={1}>
                  {selectedItem.type === "note"
                    ? selectedItem.item.title || "Untitled"
                    : selectedItem.item.name}
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
                  onPress={handleArchiveFromOptions}
                >
                  <Text className="text-base font-semibold text-red-500">Archive</Text>
                </Pressable>
              </View>
              <Pressable
                className="mt-2 w-full items-center justify-center rounded-xl border border-border bg-muted py-3.5 shadow-sm active:bg-accent"
                onPress={closeOptionsModal}
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
          onRequestClose={closeOptionsModal}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.4)",
              padding: 24,
            }}
          >
            <Pressable
              style={StyleSheet.absoluteFillObject}
              onPress={closeOptionsModal}
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
                  style={{
                    textAlign: "center",
                    fontSize: 14,
                    fontWeight: "500",
                    color: colors.mutedForeground,
                  }}
                  numberOfLines={1}
                >
                  {selectedItem?.type === "note"
                    ? selectedItem.item.title || "Untitled"
                    : selectedItem?.item.name}
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
                  style={{
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 14,
                  }}
                  onPress={handleArchiveFromOptions}
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
                onPress={closeOptionsModal}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {/* Move to folder modal for notes/files */}
      {Platform.OS === "web" ? (
        moveModalOpen && selectedItem && (
          <View className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <Pressable className="absolute inset-0" onPress={closeMoveModal} />
            <View className="w-full max-w-md rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">
                Move to
              </Text>
              <Text className="mb-4 text-sm text-muted-foreground">
                Choose a folder for "
                {selectedItem.type === "note"
                  ? selectedItem.item.title || "Untitled"
                  : selectedItem.item.name}
                "
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
                  disabled={moveNoteMutation.isPending || moveFileMutation.isPending}
                >
                  <Text className="font-semibold text-blue-500">
                    {moveNoteMutation.isPending || moveFileMutation.isPending ? "Moving…" : "Move"}
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
                Choose a folder for "
                {selectedItem?.type === "note"
                  ? selectedItem.item.title || "Untitled"
                  : selectedItem?.item.name}
                "
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
                  disabled={moveNoteMutation.isPending || moveFileMutation.isPending}
                >
                  <Text style={{ fontWeight: "600", color: "#3b82f6" }}>
                    {moveNoteMutation.isPending || moveFileMutation.isPending ? "Moving…" : "Move"}
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

"use client";

import { FileCard, FileListCard, formatFileSize } from "@/components/file-card";
import { FileUploadModal } from "@/components/file-upload-modal";
import { LongPressOptionsModal } from "@/components/long-press-options-modal";
import { MoveToFolderModal } from "@/components/move-to-folder-modal";
import { NoteCard } from "@/components/note-card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import { useAlert } from "@/contexts/alert-context";
import { useAuth } from "@/contexts/auth-context";
import { archiveFile, listFilesByFolder, updateFile, uploadFile } from "@/lib/files";
import { getFolderById, listFolders } from "@/lib/folders";
import { archiveNote, getUnsyncedNoteIds, listNotesByFolder, updateNote } from "@/lib/notes";
import { invalidateFilesQueries, invalidateFoldersQueries, invalidateNotesListQueries } from "@/lib/query-utils";
import type { File as FileRecord, Note } from "@/lib/supabase";
import { THEME } from "@/lib/theme";
import { useFilePreview } from "@/lib/use-file-preview";
import { useThemeColors } from "@/lib/use-theme-colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, FileText, Files, Folder, LayoutGrid, Plus, Rows2, Search, X } from "lucide-react-native";
import { NAV_BAR_HEIGHT } from "@/lib/layout";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
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
  const { alert } = useAlert();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { handleFilePress, PreviewModal } = useFilePreview();
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
    queryFn: () => listNotesByFolder(user?.id, id ?? ""),
    enabled: !!user?.id && !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes - match archive
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
    retry: false,
    retryOnMount: false,
  });

  const { data: unsyncedNoteIds = [] } = useQuery({
    queryKey: ["notes-unsynced-ids", user?.id],
    queryFn: () => getUnsyncedNoteIds(user?.id),
    enabled: !!user?.id,
  });

  const { data: filesInFolder = [], isLoading: filesLoading, refetch: refetchFiles, isFetching: filesFetching } = useQuery({
    queryKey: ["folderFiles", id, user?.id],
    queryFn: () => listFilesByFolder(user?.id, id ?? ""),
    enabled: !!user?.id && !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes - match archive
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
    retry: false,
    retryOnMount: false,
  });

  const { data: folders = [] } = useQuery({
    queryKey: ["folders", user?.id],
    queryFn: () => listFolders(user?.id),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  });

  // No refetch on mount/focus — useQuery fetches when cache is empty; create/update uses setQueryData; move refetches only affected folders.

  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<
    | { type: "note"; item: Note }
    | { type: "file"; item: FileRecord }
    | null
  >(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [notesViewMode, setNotesViewMode] = useState<"grid" | "list">("list");
  const [filesViewMode, setFilesViewMode] = useState<"grid" | "list">("list");
  const [areViewModesLoaded, setAreViewModesLoaded] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [, setDropdownTriggerWidth] = useState(0);

  const archiveNoteMutation = useMutation({
    mutationFn: (noteId: string) => archiveNote(noteId),
    onSuccess: (_data, noteId) => {
      // Optimistically remove the archived note from this folder's list
      if (id && user?.id) {
        queryClient.setQueryData<Note[]>(
          ["folderNotes", id, user.id],
          (old) => (old ? old.filter((n) => n.id !== noteId) : old)
        );
      }
      invalidateFoldersQueries(queryClient, user?.id);
      invalidateNotesListQueries(queryClient, user?.id);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const archiveFileMutation = useMutation({
    mutationFn: (fileId: string) => archiveFile(fileId),
    onSuccess: (_data, fileId) => {
      // Optimistically remove the archived file from this folder's list so the UI
      // doesn't show an empty list if refetch fails or returns stale data
      if (id && user?.id) {
        queryClient.setQueryData<FileRecord[]>(
          ["folderFiles", id, user.id],
          (old) => (old ? old.filter((f) => f.id !== fileId) : old)
        );
      }
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
    alert("Success", "File uploaded to this folder");
  };

  const handleNoteLongPress = (note: Note) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSelectedItem({ type: "note", item: note });
    setOptionsModalOpen(true);
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
            paddingHorizontal: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
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
              paddingRight: 8,
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
                contentContainerStyle={{
                  padding: 16,
                  paddingBottom: insets.bottom + NAV_BAR_HEIGHT + 32,
                  flexGrow: 0,
                }}
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
                contentContainerStyle={{
                  padding: 16,
                  paddingBottom: insets.bottom + NAV_BAR_HEIGHT + 24,
                  flexGrow: 0,
                }}
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

      <LongPressOptionsModal
        visible={optionsModalOpen}
        onClose={closeOptionsModal}
        title={
          selectedItem?.type === "note"
            ? selectedItem.item.title || "Untitled"
            : selectedItem?.item.name ?? "Item"
        }
        onMove={openMoveModal}
        onArchive={handleArchiveFromOptions}
      />

      <MoveToFolderModal
        visible={moveModalOpen}
        onClose={closeMoveModal}
        itemName={
          selectedItem?.type === "note"
            ? selectedItem.item.title || "Untitled"
            : selectedItem?.item.name ?? "Item"
        }
        selectedFolderId={selectedFolderId}
        onSelectFolder={setSelectedFolderId}
        folders={folders}
        onMoveConfirm={handleMoveConfirm}
        isPending={moveNoteMutation.isPending || moveFileMutation.isPending}
      />

      {PreviewModal}
    </View>
  );
}

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
import {
  archiveFile,
  getFileDownloadUrl,
  listFiles,
  updateFile,
  uploadFile,
} from "@/lib/files";
import { listFolders } from "@/lib/folders";
import {
  archiveNote,
  getUnsyncedNoteIds,
  listNotes,
  updateNote,
} from "@/lib/notes";
import {
  invalidateFilesQueries,
  invalidateFoldersQueries,
  invalidateNotesListQueries,
} from "@/lib/query-utils";
import type { File as FileRecord, Note } from "@/lib/supabase";
import { CARD_LIST_MAX_WIDTH } from "@/lib/layout";
import { THEME } from "@/lib/theme";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChevronDown, FileText, Files, LayoutGrid, Plus, Rows2, Search, X } from "lucide-react-native";
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

const WebView =
  Platform.OS === "web"
    ? null
    : require("react-native-webview").WebView;

const gap = 12;
const maxWidth = 672;
const containerPadding = 16;
const HOME_NOTES_VIEW_MODE_STORAGE_KEY = "@home_notes_view_mode";
const HOME_FILES_VIEW_MODE_STORAGE_KEY = "@home_files_view_mode";

export default function HomeScreen() {
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
    const sub = Dimensions.addEventListener("change", ({ window: w }) => setScreenWidth(w.width));
    return () => sub?.remove();
  }, []);

  const {
    data: notes = [],
    isLoading: notesLoading,
    refetch: refetchNotes,
    isFetching: notesFetching,
  } = useQuery({
    queryKey: ["notes", user?.id],
    queryFn: () => listNotes(user?.id),
    enabled: !!user?.id,
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000,
    placeholderData: (p) => p,
    retry: false,
  });

  const {
    data: files = [],
    isLoading: filesLoading,
    refetch: refetchFiles,
    isFetching: filesFetching,
  } = useQuery({
    queryKey: ["files", user?.id],
    queryFn: () => listFiles(user?.id),
    enabled: !!user?.id,
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000,
    placeholderData: (p) => p,
    retry: false,
  });

  const rootNotes = notes.filter((n) => n.folder_id == null || n.folder_id === "");
  const rootFiles = files.filter((f) => f.folder_id == null || f.folder_id === "");

  const { data: unsyncedNoteIds = [] } = useQuery({
    queryKey: ["notes-unsynced-ids", user?.id],
    queryFn: () => getUnsyncedNoteIds(user?.id),
    refetchInterval: 15000,
    enabled: !!user?.id && activeTab === "notes",
  });

  const { data: folders = [] } = useQuery({
    queryKey: ["folders", user?.id],
    queryFn: () => listFolders(user?.id),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  });

  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<{ id: string; title: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<"note" | "file" | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [dropdownTriggerWidth, setDropdownTriggerWidth] = useState(0);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewRawUrl, setPreviewRawUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string | null>(null);
  const [notesViewMode, setNotesViewMode] = useState<"grid" | "list">("list");
  const [filesViewMode, setFilesViewMode] = useState<"grid" | "list">("list");
  const [areViewModesLoaded, setAreViewModesLoaded] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const cardWidth = Math.min(screenWidth, maxWidth) - containerPadding * 2;
  const currentViewMode = activeTab === "notes" ? notesViewMode : filesViewMode;

  // Load saved view modes for notes and files tabs
  useEffect(() => {
    const loadViewModes = async () => {
      try {
        const [savedNotesMode, savedFilesMode] = await Promise.all([
          AsyncStorage.getItem(HOME_NOTES_VIEW_MODE_STORAGE_KEY),
          AsyncStorage.getItem(HOME_FILES_VIEW_MODE_STORAGE_KEY),
        ]);
        if (savedNotesMode === "grid" || savedNotesMode === "list") setNotesViewMode(savedNotesMode);
        if (savedFilesMode === "grid" || savedFilesMode === "list") setFilesViewMode(savedFilesMode);
      } catch (error) {
        console.error("Failed to load home view modes:", error);
      } finally {
        setAreViewModesLoaded(true);
      }
    };
    loadViewModes();
  }, []);

  useEffect(() => {
    if (!areViewModesLoaded) return;
    const saveViewModes = async () => {
      try {
        await Promise.all([
          AsyncStorage.setItem(HOME_NOTES_VIEW_MODE_STORAGE_KEY, notesViewMode),
          AsyncStorage.setItem(HOME_FILES_VIEW_MODE_STORAGE_KEY, filesViewMode),
        ]);
      } catch (error) {
        console.error("Failed to save home view modes:", error);
      }
    };
    saveViewModes();
  }, [notesViewMode, filesViewMode, areViewModesLoaded]);

  const toggleViewMode = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (activeTab === "notes") {
      setNotesViewMode((prev) => (prev === "grid" ? "list" : "grid"));
    } else {
      setFilesViewMode((prev) => (prev === "grid" ? "list" : "grid"));
    }
  };

  const handlePlusPress = () => {
    if (!user?.id) return;
    if (activeTab === "notes") {
      router.push("/(app)/note/new");
    } else {
      setUploadModalOpen(true);
    }
  };

  const handleUploadFromModal = async (params: {
    file: { uri: string | globalThis.File; name: string; type: string; size: number };
  }) => {
    if (!user?.id) return;
    await uploadFile({ user_id: user.id, file: params.file });
    invalidateFilesQueries(queryClient, user.id);
    setUploadModalOpen(false);
    Alert.alert("Success", "File uploaded to Home");
  };

  const archiveNoteMutation = useMutation({
    mutationFn: (id: string) => archiveNote(id),
    onSuccess: (_data, archivedNoteId) => {
      invalidateNotesListQueries(queryClient, user?.id);
      queryClient.invalidateQueries({ queryKey: ["note", archivedNoteId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setArchiveDialogOpen(false);
      setOptionsModalOpen(false);
      setSelectedNote(null);
    },
  });

  const archiveFileMutation = useMutation({
    mutationFn: (id: string) => archiveFile(id),
    onSuccess: () => {
      invalidateFilesQueries(queryClient, user?.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setOptionsModalOpen(false);
      setSelectedFile(null);
    },
  });

  const moveNoteMutation = useMutation({
    mutationFn: ({ noteId, folderId }: { noteId: string; folderId: string | null }) =>
      updateNote(noteId, { folder_id: folderId }),
    onSuccess: (_data, { noteId }) => {
      invalidateNotesListQueries(queryClient, user?.id);
      invalidateFoldersQueries(queryClient, user?.id);
      queryClient.invalidateQueries({ queryKey: ["note", noteId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMoveModalOpen(false);
      setMoveTarget(null);
      setSelectedNote(null);
      setSelectedFolderId(null);
    },
  });

  const moveFileMutation = useMutation({
    mutationFn: ({ fileId, folderId }: { fileId: string; folderId: string | null }) =>
      updateFile(fileId, { folder_id: folderId }),
    onSuccess: (_data, { fileId }) => {
      invalidateFilesQueries(queryClient, user?.id);
      invalidateFoldersQueries(queryClient, user?.id);
      setMoveModalOpen(false);
      setMoveTarget(null);
      setSelectedFile(null);
      setSelectedFolderId(null);
    },
  });

  const filteredRootNotes = rootNotes.filter((note) => {
    if (!searchQuery.trim()) return true;
    return note.title?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredRootFiles = rootFiles.filter((file) => {
    if (!searchQuery.trim()) return true;
    return file.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const onRefresh = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([refetchNotes(), refetchFiles()]);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

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
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const downloadUrl = await getFileDownloadUrl(file.file_path);
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.open(downloadUrl, "_blank");
      } else {
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

  const handleLongPressNote = (id: string, title: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedFile(null);
    setSelectedNote({ id, title });
    setOptionsModalOpen(true);
  };

  const handleLongPressFile = (file: FileRecord) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedNote(null);
    setSelectedFile(file);
    setOptionsModalOpen(true);
  };

  const openNoteArchiveConfirm = () => {
    setOptionsModalOpen(false);
    if (selectedNote) setArchiveDialogOpen(true);
  };

  const openNoteMoveModal = () => {
    setOptionsModalOpen(false);
    const note = selectedNote ? notes.find((n) => n.id === selectedNote.id) : null;
    setSelectedFolderId(note?.folder_id ?? null);
    setMoveTarget("note");
    setMoveModalOpen(true);
  };

  const openFileMoveModal = () => {
    setOptionsModalOpen(false);
    setSelectedFolderId(selectedFile?.folder_id ?? null);
    setMoveTarget("file");
    setMoveModalOpen(true);
  };

  const handleNoteArchiveConfirm = () => {
    if (selectedNote) {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      archiveNoteMutation.mutate(selectedNote.id);
    }
  };

  const handleMoveConfirm = () => {
    if (moveTarget === "note" && selectedNote) {
      moveNoteMutation.mutate({ noteId: selectedNote.id, folderId: selectedFolderId });
    } else if (moveTarget === "file" && selectedFile) {
      moveFileMutation.mutate({ fileId: selectedFile.id, folderId: selectedFolderId });
    }
  };

  const closeMoveModal = () => {
    setMoveModalOpen(false);
    setMoveTarget(null);
    setSelectedNote(null);
    setSelectedFile(null);
    setSelectedFolderId(null);
    setDropdownTriggerWidth(0);
  };

  const formatFileSizeFn = (bytes: number) => formatFileSize(bytes);

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
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingLeft: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground }}>
              Home
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingRight: 6 }}>
            <Pressable onPress={toggleViewMode} style={{ paddingVertical: 8 }}>
              {currentViewMode === "grid" ? (
                <Rows2 color={colors.foreground} size={22} />
              ) : (
                <LayoutGrid color={colors.foreground} size={22} />
              )}
            </Pressable>
            <Pressable onPress={handlePlusPress} style={{ paddingVertical: 8 }}>
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
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "notes" | "files")}
          className="flex-1"
        >
          <View className="w-full max-w-3xl mx-auto">
            <View className="flex-row items-center mx-4 my-3 gap-2">
              <View className="flex-row items-center flex-1 min-w-0 px-4 rounded-2xl h-14 border border-border bg-muted">
                <Search
                  className="text-muted border-border mr-2"
                  color={THEME.light.mutedForeground}
                  size={20}
                />
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
                    refreshing={notesFetching || filesFetching}
                    onRefresh={onRefresh}
                    tintColor={colors.foreground}
                    colors={[colors.foreground]}
                  />
                }
              >
                {filteredRootNotes.length === 0 ? (
                  <View
                    className="w-full max-w-2xl mx-auto flex-1 justify-center items-center pt-24"
                    style={{ maxWidth: CARD_LIST_MAX_WIDTH }}
                  >
                    <Text className="text-xl font-semibold text-muted-foreground mb-2">
                      {searchQuery.trim() ? "No matching notes" : "No notes in Home"}
                    </Text>
                    <Text className="text-sm text-muted-foreground text-center">
                      {searchQuery.trim()
                        ? "Try a different search"
                        : "Notes not in any folder appear here for quick access"}
                    </Text>
                  </View>
                ) : notesViewMode === "grid" ? (
                  <View className="w-full max-w-2xl mx-auto" style={{ maxWidth: CARD_LIST_MAX_WIDTH }}>
                    {(() => {
                      const columns = 2;
                      const columnGap = 12;
                      const rowGap = 12;
                      const availableWidth = Math.min(screenWidth, maxWidth) - containerPadding * 2;
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
                          {filteredRootNotes.map((note, index) => {
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
                                  onPress={() => router.push(`/(app)/note/${note.id}`)}
                                  onDelete={() => handleLongPressNote(note.id, note.title ?? "Untitled")}
                                  onRightClickDelete={
                                    Platform.OS === "web"
                                      ? () => handleLongPressNote(note.id, note.title ?? "Untitled")
                                      : undefined
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
                  <View className="w-full max-w-2xl mx-auto" style={{ maxWidth: CARD_LIST_MAX_WIDTH }}>
                    <View style={{ width: cardWidth, alignSelf: "center" }}>
                      {filteredRootNotes.map((note, i) => (
                        <View
                          key={note.id}
                          style={{ marginBottom: i < filteredRootNotes.length - 1 ? gap : 0 }}
                        >
                          <NoteCard
                            note={note}
                            cardWidth={cardWidth}
                            isSynced={!unsyncedNoteIds.includes(note.id)}
                            onPress={() => router.push(`/(app)/note/${note.id}`)}
                            onDelete={() => handleLongPressNote(note.id, note.title ?? "Untitled")}
                            onRightClickDelete={
                              Platform.OS === "web"
                                ? () => handleLongPressNote(note.id, note.title ?? "Untitled")
                                : undefined
                            }
                          />
                        </View>
                      ))}
                    </View>
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
                    refreshing={notesFetching || filesFetching}
                    onRefresh={onRefresh}
                    tintColor={colors.foreground}
                    colors={[colors.foreground]}
                  />
                }
              >
                {filteredRootFiles.length === 0 ? (
                  <View
                    className="w-full max-w-2xl mx-auto flex-1 justify-center items-center pt-24"
                    style={{ maxWidth: CARD_LIST_MAX_WIDTH }}
                  >
                    <Text className="text-xl font-semibold text-muted-foreground mb-2">
                      {searchQuery.trim() ? "No matching files" : "No files in Home"}
                    </Text>
                    <Text className="text-sm text-muted-foreground text-center">
                      {searchQuery.trim()
                        ? "Try a different search"
                        : "Files not in any folder appear here for quick access"}
                    </Text>
                  </View>
                ) : filesViewMode === "grid" ? (
                  <View className="w-full max-w-2xl mx-auto" style={{ maxWidth: CARD_LIST_MAX_WIDTH }}>
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
                          {filteredRootFiles.map((file, index) => {
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
                                  formatFileSize={formatFileSizeFn}
                                  onPress={() => handleFilePress(file)}
                                  onDelete={() => handleLongPressFile(file)}
                                  onRightClickAction={
                                    Platform.OS === "web" ? () => handleLongPressFile(file) : undefined
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
                  <View className="w-full max-w-2xl mx-auto" style={{ maxWidth: CARD_LIST_MAX_WIDTH }}>
                    <View style={{ width: cardWidth, alignSelf: "center" }}>
                      {filteredRootFiles.map((file, i) => (
                        <View
                          key={file.id}
                          style={{ marginBottom: i < filteredRootFiles.length - 1 ? gap : 0 }}
                        >
                          <FileListCard
                            file={file}
                            onPress={() => handleFilePress(file)}
                            onDelete={() => handleLongPressFile(file)}
                            onRightClickAction={
                              Platform.OS === "web" ? () => handleLongPressFile(file) : undefined
                            }
                            formatFileSize={formatFileSizeFn}
                            cardWidth={cardWidth}
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>
            )}
          </TabsContent>
        </Tabs>
      </View>

      {/* Note options modal (Move / Archive) */}
      {Platform.OS === "web" ? (
        optionsModalOpen && (selectedNote || selectedFile) && (
          <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Pressable
              className="absolute inset-0"
              onPress={() => {
                setOptionsModalOpen(false);
                setSelectedNote(null);
                setSelectedFile(null);
              }}
            />
            <View className="w-full max-w-[280px] items-center">
              <View className="mb-3 w-full rounded-xl border border-border bg-muted px-4 py-3 shadow-sm">
                <Text className="text-center text-sm font-medium text-muted-foreground" numberOfLines={1}>
                  {selectedNote?.title ?? selectedFile?.name ?? ""}
                </Text>
              </View>
              <View className="w-full overflow-hidden rounded-xl border border-border bg-muted shadow-sm">
                <Pressable
                  className="items-center justify-center border-b border-border py-3.5 active:bg-accent"
                  onPress={selectedNote ? openNoteMoveModal : openFileMoveModal}
                >
                  <Text className="text-base font-medium text-blue-500">Move to</Text>
                </Pressable>
                <Pressable
                  className="items-center justify-center py-3.5 active:bg-accent"
                  onPress={() => {
                    if (selectedNote) openNoteArchiveConfirm();
                    else if (selectedFile) {
                      setOptionsModalOpen(false);
                      archiveFileMutation.mutate(selectedFile.id);
                    }
                  }}
                >
                  <Text className="text-base font-semibold text-red-500">Archive</Text>
                </Pressable>
              </View>
              <Pressable
                className="mt-2 w-full items-center justify-center rounded-xl border border-border bg-muted py-3.5 active:bg-accent"
                onPress={() => {
                  setOptionsModalOpen(false);
                  setSelectedNote(null);
                  setSelectedFile(null);
                }}
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
          onRequestClose={() => {
            setOptionsModalOpen(false);
            setSelectedNote(null);
            setSelectedFile(null);
          }}
        >
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", padding: 24 }}>
            <Pressable
              style={StyleSheet.absoluteFillObject}
              onPress={() => {
                setOptionsModalOpen(false);
                setSelectedNote(null);
                setSelectedFile(null);
              }}
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
                }}
              >
                <Text
                  style={{ textAlign: "center", fontSize: 14, fontWeight: "500", color: colors.mutedForeground }}
                  numberOfLines={1}
                >
                  {selectedNote?.title ?? selectedFile?.name ?? ""}
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
                  onPress={selectedNote ? openNoteMoveModal : openFileMoveModal}
                >
                  <Text style={{ fontSize: 16, fontWeight: "500", color: "#3b82f6" }}>Move to</Text>
                </Pressable>
                <Pressable
                  style={{ width: "100%", alignItems: "center", justifyContent: "center", paddingVertical: 14 }}
                  onPress={() => {
                    if (selectedNote) openNoteArchiveConfirm();
                    else if (selectedFile) {
                      setOptionsModalOpen(false);
                      archiveFileMutation.mutate(selectedFile.id);
                    }
                  }}
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
                }}
                onPress={() => {
                  setOptionsModalOpen(false);
                  setSelectedNote(null);
                  setSelectedFile(null);
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {/* Archive note confirmation (web uses Alert, native can use same or modal) */}
      {archiveDialogOpen && selectedNote && (
        <>
          {Platform.OS === "web" ? (
            <View className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
              <Pressable className="absolute inset-0" onPress={() => setArchiveDialogOpen(false)} />
              <View className="w-full max-w-md rounded-lg border border-border bg-muted p-6 shadow-lg">
                <Text className="mb-2 text-lg font-semibold text-foreground">
                  Archive note
                </Text>
                <Text className="mb-6 text-sm text-muted-foreground">
                  Are you sure you want to archive "{selectedNote.title}"?
                </Text>
                <View className="flex-row justify-end gap-3">
                  <Pressable className="px-4 py-2" onPress={() => setArchiveDialogOpen(false)}>
                    <Text className="text-foreground">Cancel</Text>
                  </Pressable>
                  <Pressable
                    className="rounded-md px-4 py-2"
                    onPress={handleNoteArchiveConfirm}
                    disabled={archiveNoteMutation.isPending}
                  >
                    <Text className="font-semibold text-red-500">
                      {archiveNoteMutation.isPending ? "Archiving…" : "Archive"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <Modal visible={archiveDialogOpen} transparent animationType="fade">
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)" }}>
                <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setArchiveDialogOpen(false)} />
                <View style={{ width: "100%", maxWidth: 340, margin: 24, borderRadius: 12, padding: 24, backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground, marginBottom: 8 }}>
                    Archive note
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 24 }}>
                    Are you sure you want to archive "{selectedNote.title}"?
                  </Text>
                  <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
                    <Pressable onPress={() => setArchiveDialogOpen(false)}>
                      <Text style={{ color: colors.foreground }}>Cancel</Text>
                    </Pressable>
                    <Pressable onPress={handleNoteArchiveConfirm} disabled={archiveNoteMutation.isPending}>
                      <Text style={{ fontWeight: "600", color: colors.destructive }}>
                        {archiveNoteMutation.isPending ? "Archiving…" : "Archive"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Modal>
          )}
        </>
      )}

      {/* Move to folder modal */}
      {Platform.OS === "web" ? (
        moveModalOpen && (
          <View className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <Pressable className="absolute inset-0" onPress={closeMoveModal} />
            <View className="w-full max-w-md rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">Move to</Text>
              <Text className="mb-4 text-sm text-muted-foreground">
                {moveTarget === "note"
                  ? `Choose a folder for "${selectedNote?.title}"`
                  : `Choose a folder for "${selectedFile?.name}"`}
              </Text>
              <View className="mb-6 w-full" onLayout={(e) => setDropdownTriggerWidth(e.nativeEvent.layout.width)}>
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
                  <DropdownMenuContent style={dropdownTriggerWidth > 0 ? { width: dropdownTriggerWidth } : undefined}>
                    <DropdownMenuItem onPress={() => setSelectedFolderId(null)}>
                      <Text className="text-foreground">No folder</Text>
                    </DropdownMenuItem>
                    {folders.map((folder) => (
                      <DropdownMenuItem key={folder.id} onPress={() => setSelectedFolderId(folder.id)}>
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
        <Modal visible={moveModalOpen} transparent animationType="fade" onRequestClose={closeMoveModal}>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", padding: 24 }}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={closeMoveModal} />
            <View style={{ width: "100%", maxWidth: 400, borderRadius: 12, padding: 24, backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground, marginBottom: 8 }}>Move to</Text>
              <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 16 }}>
                {moveTarget === "note"
                  ? `Choose a folder for "${selectedNote?.title}"`
                  : `Choose a folder for "${selectedFile?.name}"`}
              </Text>
              <View style={{ marginBottom: 24, width: "100%" }} onLayout={(e) => setDropdownTriggerWidth(e.nativeEvent.layout.width)}>
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
                  <DropdownMenuContent style={dropdownTriggerWidth > 0 ? { width: dropdownTriggerWidth } : undefined}>
                    <DropdownMenuItem onPress={() => setSelectedFolderId(null)}>
                      <Text style={{ color: colors.foreground }}>No folder</Text>
                    </DropdownMenuItem>
                    {folders.map((folder) => (
                      <DropdownMenuItem key={folder.id} onPress={() => setSelectedFolderId(folder.id)}>
                        <Text style={{ color: colors.foreground }}>{folder.name}</Text>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
                <Pressable onPress={closeMoveModal}>
                  <Text style={{ color: colors.foreground }}>Cancel</Text>
                </Pressable>
                <Pressable
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

      {/* File preview (native WebView) */}
      {Platform.OS !== "web" && WebView && previewUrl && previewFileName && (
        <Modal visible={!!previewUrl} animationType="slide" onRequestClose={closePreview}>
          <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>
                {previewFileName}
              </Text>
              <Pressable onPress={closePreview} style={{ padding: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.primary }}>Done</Text>
              </Pressable>
            </View>
            <WebView
              source={{ uri: previewUrl }}
              style={{ flex: 1 }}
              onShouldStartLoadWithRequest={(req: { url: string }) => {
                if (req.url && req.url.startsWith("https://docs.google.com/gview")) return true;
                if (previewRawUrl && req.url === previewRawUrl) return true;
                Linking.openURL(req.url);
                return false;
              }}
            />
          </View>
        </Modal>
      )}
    </View>
  );
}

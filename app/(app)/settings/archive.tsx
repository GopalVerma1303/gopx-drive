"use client";

import { FolderCard } from "@/components/folder-card";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  deleteFile,
  listArchivedFiles,
  restoreFile,
} from "@/lib/files";
import {
  deleteFolder,
  listArchivedFolders,
  restoreFolder,
} from "@/lib/folders";
import {
  deleteNote,
  getUnsyncedNoteIds,
  listArchivedNotes,
  restoreNote,
  syncNotesFromSupabase,
} from "@/lib/notes";
import {
  invalidateFilesQueries,
  invalidateFoldersQueries,
  invalidateNotesQueries,
} from "@/lib/query-utils";
import type { File as FileRecord, Folder, Note } from "@/lib/supabase";
import { THEME } from "@/lib/theme";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import {
  Archive,
  ArrowLeft,
  Check,
  CheckCheck,
  FileText,
  Files,
  Filter,
  Folder as FolderIcon,
  Search,
  Trash2,
  Undo2,
  X,
} from "lucide-react-native";
import { NAV_BAR_HEIGHT } from "@/lib/layout";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ArchiveScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"notes" | "files" | "folders">("notes");
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [screenWidth, setScreenWidth] = useState(() => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        return window.innerWidth;
      }
    }
    return Dimensions.get("window").width;
  });

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

  const isSmallScreen = screenWidth < 768;

  // Confirmation dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [deleteAction, setDeleteAction] = useState<{
    type: "all" | "selected" | "single";
    id?: string;
    tab?: "notes" | "files" | "folders";
  } | null>(null);
  const [restoreAction, setRestoreAction] = useState<{
    type: "all" | "selected" | "single";
    id?: string;
    tab?: "notes" | "files" | "folders";
  } | null>(null);

  // Sync notes from Supabase in background (non-blocking) when archive screen mounts
  useEffect(() => {
    if (!user?.id) return;
    // Sync in background without blocking UI
    syncNotesFromSupabase(user.id)?.then(() => {
      invalidateNotesQueries(queryClient, user.id);
    }).catch(() => {
      // Sync failed, but UI already shows cached data
    });
  }, [user?.id, queryClient]);

  const {
    data: archivedNotes = [],
    isLoading: notesLoading,
    refetch: refetchNotes,
    isFetching: notesFetching,
  } = useQuery({
    queryKey: ["archivedNotes", user?.id],
    queryFn: () => listArchivedNotes(user?.id),
    enabled: !!user?.id,
    refetchOnMount: false, // Use cache; pull-to-refresh for latest (reduces Supabase hits)
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 5 * 60 * 1000, // 5 minutes - cache for 5 minutes
    // Use cached data immediately, don't show loading if we have cache
    placeholderData: (previousData) => previousData,
    retry: false,
    retryOnMount: false,
  });

  const { data: unsyncedNoteIds = [] } = useQuery({
    queryKey: ["notes-unsynced-ids", user?.id],
    queryFn: () => getUnsyncedNoteIds(user?.id),
    // Optimize polling: reduce frequency when idle
    refetchInterval: 15000, // Reduced from 10s to 15s
    enabled: !!user?.id && activeTab === "notes",
  });

  const {
    data: archivedFiles = [],
    isLoading: filesLoading,
    refetch: refetchFiles,
    isFetching: filesFetching,
  } = useQuery({
    queryKey: ["archivedFiles", user?.id],
    queryFn: () => listArchivedFiles(user?.id),
    enabled: !!user?.id,
    refetchOnMount: false, // Use cache; pull-to-refresh for latest (reduces Supabase hits)
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 5 * 60 * 1000, // 5 minutes - cache for 5 minutes
    retry: false, // When offline, fail once and show cached archived files from listArchivedFiles() fallback
    // Use cached data immediately, don't show loading if we have cache
    placeholderData: (previousData) => previousData,
    retryOnMount: false,
  });

  const {
    data: archivedFolders = [],
    isLoading: foldersLoading,
    refetch: refetchFolders,
    isFetching: foldersFetching,
  } = useQuery({
    queryKey: ["archivedFolders", user?.id],
    queryFn: () => listArchivedFolders(user?.id),
    enabled: !!user?.id,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    retryOnMount: false,
  });

  const restoreNoteMutation = useMutation({
    mutationFn: (id: string) => restoreNote(id),
    onSuccess: () => {
      invalidateNotesQueries(queryClient, user?.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: () => {
      invalidateNotesQueries(queryClient, user?.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const restoreFileMutation = useMutation({
    mutationFn: (id: string) => restoreFile(id),
    onSuccess: () => {
      invalidateFilesQueries(queryClient, user?.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: ({ id, filePath }: { id: string; filePath?: string }) =>
      deleteFile(id, filePath ? { filePath } : undefined),
    onSuccess: () => {
      invalidateFilesQueries(queryClient, user?.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const restoreFolderMutation = useMutation({
    mutationFn: (id: string) => restoreFolder(id, { userId: user?.id }),
    onSuccess: () => {
      invalidateFoldersQueries(queryClient, user?.id);
      invalidateNotesQueries(queryClient, user?.id);
      invalidateFilesQueries(queryClient, user?.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => deleteFolder(id, { userId: user?.id }),
    onSuccess: () => {
      invalidateFoldersQueries(queryClient, user?.id);
      invalidateNotesQueries(queryClient, user?.id);
      invalidateFilesQueries(queryClient, user?.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleRestoreAll = () => {
    setRestoreAction({ type: "all", tab: activeTab });
    setRestoreDialogOpen(true);
  };

  const handleRestoreSelected = () => {
    setRestoreAction({ type: "selected", tab: activeTab });
    setRestoreDialogOpen(true);
  };

  const handleDeleteAll = () => {
    setDeleteAction({ type: "all", tab: activeTab });
    setDeleteDialogOpen(true);
  };

  const handleDeleteSelected = () => {
    setDeleteAction({ type: "selected", tab: activeTab });
    setDeleteDialogOpen(true);
  };

  const handleDeleteSingle = (id: string, tab: "notes" | "files" | "folders" = activeTab) => {
    setDeleteAction({ type: "single", id, tab });
    setDeleteDialogOpen(true);
  };

  const handleRestoreSingle = (id: string, tab: "notes" | "files" | "folders" = activeTab) => {
    setRestoreAction({ type: "single", id, tab });
    setRestoreDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteAction) return;
    const tab = deleteAction.tab ?? activeTab;

    if (deleteAction.type === "all") {
      if (tab === "notes") {
        for (const note of filteredNotes) {
          await deleteNoteMutation.mutateAsync(note.id);
        }
        setSelectedNotes(new Set());
      } else if (tab === "files") {
        for (const file of filteredFiles) {
          await deleteFileMutation.mutateAsync({
            id: file.id,
            filePath: file.file_path,
          });
        }
        setSelectedFiles(new Set());
      } else {
        for (const folder of filteredFolders) {
          await deleteFolderMutation.mutateAsync(folder.id);
        }
        setSelectedFolders(new Set());
      }
    } else if (deleteAction.type === "selected") {
      if (tab === "notes") {
        for (const id of selectedNotes) {
          await deleteNoteMutation.mutateAsync(id);
        }
        setSelectedNotes(new Set());
      } else if (tab === "files") {
        for (const id of selectedFiles) {
          const file = filteredFiles.find((f) => f.id === id);
          await deleteFileMutation.mutateAsync({
            id,
            filePath: file?.file_path,
          });
        }
        setSelectedFiles(new Set());
      } else {
        for (const id of selectedFolders) {
          await deleteFolderMutation.mutateAsync(id);
        }
        setSelectedFolders(new Set());
      }
    } else if (deleteAction.type === "single" && deleteAction.id) {
      if (tab === "notes") {
        await deleteNoteMutation.mutateAsync(deleteAction.id);
      } else if (tab === "files") {
        const file = filteredFiles.find((f) => f.id === deleteAction.id);
        await deleteFileMutation.mutateAsync({
          id: deleteAction.id,
          filePath: file?.file_path,
        });
      } else {
        await deleteFolderMutation.mutateAsync(deleteAction.id);
      }
    }

    setDeleteDialogOpen(false);
    setDeleteAction(null);
  };

  const confirmRestore = async () => {
    if (!restoreAction) return;
    const tab = restoreAction.tab ?? activeTab;

    if (restoreAction.type === "all") {
      if (tab === "notes") {
        for (const note of filteredNotes) {
          await restoreNoteMutation.mutateAsync(note.id);
        }
        setSelectedNotes(new Set());
      } else if (tab === "files") {
        for (const file of filteredFiles) {
          await restoreFileMutation.mutateAsync(file.id);
        }
        setSelectedFiles(new Set());
      } else {
        for (const folder of filteredFolders) {
          await restoreFolderMutation.mutateAsync(folder.id);
        }
        setSelectedFolders(new Set());
      }
    } else if (restoreAction.type === "selected") {
      if (tab === "notes") {
        for (const id of selectedNotes) {
          await restoreNoteMutation.mutateAsync(id);
        }
        setSelectedNotes(new Set());
      } else if (tab === "files") {
        for (const id of selectedFiles) {
          await restoreFileMutation.mutateAsync(id);
        }
        setSelectedFiles(new Set());
      } else {
        for (const id of selectedFolders) {
          await restoreFolderMutation.mutateAsync(id);
        }
        setSelectedFolders(new Set());
      }
    } else if (restoreAction.type === "single" && restoreAction.id) {
      if (tab === "notes") {
        await restoreNoteMutation.mutateAsync(restoreAction.id);
      } else if (tab === "files") {
        await restoreFileMutation.mutateAsync(restoreAction.id);
      } else {
        await restoreFolderMutation.mutateAsync(restoreAction.id);
      }
    }

    setRestoreDialogOpen(false);
    setRestoreAction(null);
  };

  const toggleNoteSelection = (id: string) => {
    const newSelected = new Set(selectedNotes);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedNotes(newSelected);
  };

  const toggleFileSelection = (id: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedFiles(newSelected);
  };

  const toggleFolderSelection = (id: string) => {
    const newSelected = new Set(selectedFolders);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedFolders(newSelected);
  };

  const onRefresh = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await Promise.all([refetchNotes(), refetchFiles(), refetchFolders()]);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const hasSelection =
    activeTab === "notes"
      ? selectedNotes.size > 0
      : activeTab === "files"
        ? selectedFiles.size > 0
        : selectedFolders.size > 0;
  const itemCount =
    activeTab === "notes"
      ? archivedNotes.length
      : activeTab === "files"
        ? archivedFiles.length
        : archivedFolders.length;

  // Filter notes and files based on search query (notes by title only)
  const filteredNotes = archivedNotes.filter((note) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return note.title?.toLowerCase().includes(query);
  });

  const filteredFiles = archivedFiles.filter((file) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return file.name.toLowerCase().includes(query);
  });

  const filteredFolders = archivedFolders.filter((folder) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return folder.name.toLowerCase().includes(query);
  });

  const deleteTab = deleteAction?.tab ?? activeTab;
  const restoreTab = restoreAction?.tab ?? activeTab;
  const deleteLabel = deleteTab === "notes" ? "Note" : deleteTab === "files" ? "File" : "Folder";
  const deleteLabelPlural = deleteTab === "notes" ? "Notes" : deleteTab === "files" ? "Files" : "Folders";
  const restoreLabel = restoreTab === "notes" ? "Note" : restoreTab === "files" ? "File" : "Folder";
  const restoreLabelPlural = restoreTab === "notes" ? "Notes" : restoreTab === "files" ? "Files" : "Folders";
  const deleteCount =
    deleteTab === "notes"
      ? filteredNotes.length
      : deleteTab === "files"
        ? filteredFiles.length
        : filteredFolders.length;
  const restoreCount =
    restoreTab === "notes"
      ? filteredNotes.length
      : restoreTab === "files"
        ? filteredFiles.length
        : filteredFolders.length;
  const selectedDeleteCount =
    deleteTab === "notes"
      ? selectedNotes.size
      : deleteTab === "files"
        ? selectedFiles.size
        : selectedFolders.size;
  const selectedRestoreCount =
    restoreTab === "notes"
      ? selectedNotes.size
      : restoreTab === "files"
        ? selectedFiles.size
        : selectedFolders.size;

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
            paddingHorizontal: 6,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                router.replace("/(app)/settings");
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
              Archive
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
            {itemCount > 0 && (
              <>
                <Pressable
                  onPress={() => {
                    if (Platform.OS !== "web") {
                      Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Medium
                      );
                    }
                    hasSelection ? handleRestoreSelected() : handleRestoreAll();
                  }}
                  style={{ paddingVertical: 8 }}
                >
                  <Undo2 color={colors.foreground} size={22} />
                </Pressable>
                {hasSelection ? (
                  <Pressable
                    onPress={() => {
                      if (Platform.OS !== "web") {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }
                      handleDeleteSelected();
                    }}
                    style={{ paddingVertical: 8 }}
                  >
                    <Trash2 color="#ef4444" size={22} />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => {
                      if (Platform.OS !== "web") {
                        Haptics.impactAsync(
                          Haptics.ImpactFeedbackStyle.Medium
                        );
                      }
                      handleDeleteAll();
                    }}
                    style={{ paddingVertical: 8 }}
                  >
                    <Trash2 color="#ef4444" size={22} />
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      </View>
      <View className="w-full h-full">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "notes" | "files" | "folders")} className="flex-1">
          {/* Search and Tabs Container */}
          <View className="w-full max-w-3xl mx-auto">
            <View className="flex-row items-center mx-4 my-3 gap-2">
              {/* Search Bar */}
              <View className="flex-row items-center flex-1 min-w-0 px-4 rounded-2xl h-14 border border-border bg-muted">
                <Search
                  className="text-muted border-border mr-2"
                  color={THEME.light.mutedForeground}
                  size={20}
                />
                <Input
                  className="flex-1 h-full border-0 bg-transparent px-2 shadow-none"
                  placeholder={`Search ${activeTab === "folders" ? "folders" : activeTab}...`}
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

              {/* Filter: Notes / Files / Folders */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Pressable
                    onPress={() => {
                      if (Platform.OS !== "web") {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                    className="p-2 rounded-2xl bg-muted items-center justify-center border border-border h-14 w-14"
                  >
                    <Filter color={colors.mutedForeground} size={20} />
                  </Pressable>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="end" sideOffset={8}>
                  <DropdownMenuItem
                    onPress={() => {
                      setActiveTab("notes");
                    }}
                  >
                    <FileText color={colors.foreground} size={18} />
                    <Text className="text-foreground ml-2">Notes</Text>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onPress={() => {
                      setActiveTab("files");
                    }}
                  >
                    <Files color={colors.foreground} size={18} />
                    <Text className="text-foreground ml-2">Files</Text>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onPress={() => {
                      setActiveTab("folders");
                    }}
                  >
                    <FolderIcon color={colors.foreground} size={18} />
                    <Text className="text-foreground ml-2">Folders</Text>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                    refreshing={notesFetching || filesFetching}
                    onRefresh={onRefresh}
                    tintColor={colors.foreground}
                    colors={[colors.foreground]}
                  />
                }
              >
                {filteredNotes.length === 0 ? (
                  <View className="w-full max-w-2xl mx-auto flex-1 justify-center items-center pt-24">
                    <Archive
                      color={colors.mutedForeground}
                      size={48}

                      style={{ marginBottom: 16 }}
                    />
                    <Text className="text-xl font-semibold text-muted-foreground mb-2">
                      {searchQuery.trim() ? "No matching notes" : "No archived notes"}
                    </Text>
                    <Text className="text-sm text-muted-foreground text-center">
                      {searchQuery.trim() ? "Try a different search term" : "Notes you archive will appear here"}
                    </Text>
                  </View>
                ) : (
                  <View className="w-full max-w-2xl mx-auto">
                    {(() => {
                      const maxWidth = 672;
                      const containerPadding = 16;
                      const gap = 12;
                      const availableWidth =
                        Math.min(screenWidth, maxWidth) - containerPadding * 2;
                      const cardWidth = availableWidth;

                      return (
                        <View style={{ width: cardWidth, alignSelf: "center" }}>
                          {filteredNotes.map((note, noteIndex) => (
                            <View
                              key={note.id}
                              style={{
                                marginBottom:
                                  noteIndex < archivedNotes.length - 1 ? gap : 0,
                              }}
                            >
                              <ArchivedNoteCard
                                note={note}
                                cardWidth={cardWidth}
                                isSynced={!unsyncedNoteIds.includes(note.id)}
                                isSelected={selectedNotes.has(note.id)}
                                onToggleSelect={() =>
                                  toggleNoteSelection(note.id)
                                }
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
                  paddingBottom: insets.bottom + NAV_BAR_HEIGHT + 32,
                  flexGrow: 0,
                }}
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
                {filteredFiles.length === 0 ? (
                  <View className="w-full max-w-2xl mx-auto flex-1 justify-center items-center pt-24">
                    <Archive
                      color={colors.mutedForeground}
                      size={48}

                      style={{ marginBottom: 16 }}
                    />
                    <Text className="text-xl font-semibold text-muted-foreground mb-2">
                      {searchQuery.trim() ? "No matching files" : "No archived files"}
                    </Text>
                    <Text className="text-sm text-muted-foreground text-center">
                      {searchQuery.trim() ? "Try a different search term" : "Files you archive will appear here"}
                    </Text>
                  </View>
                ) : (
                  <View className="w-full max-w-2xl mx-auto">
                    {(() => {
                      const maxWidth = 672;
                      const containerPadding = 16;
                      const gap = 12; // match notes card gap
                      const availableWidth =
                        Math.min(screenWidth, maxWidth) - containerPadding * 2;
                      const cardWidth = availableWidth;

                      return (
                        <View style={{ width: cardWidth, alignSelf: "center" }}>
                          {filteredFiles.map((file: FileRecord, index: number) => (
                            <View
                              key={file.id}
                              style={{
                                marginBottom:
                                  index < archivedFiles.length - 1 ? gap : 0,
                              }}
                            >
                              <ArchivedFileListCard
                                file={file}
                                formatFileSize={formatFileSize}
                                cardWidth={cardWidth}
                                isSelected={selectedFiles.has(file.id)}
                                onToggleSelect={() =>
                                  toggleFileSelection(file.id)
                                }
                                onDelete={() =>
                                  handleDeleteSingle(file.id)
                                }
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
          </TabsContent>

          <TabsContent value="folders" className="flex-1 -mt-2" style={{ flex: 1 }}>
            {foldersLoading ? (
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
                    refreshing={notesFetching || filesFetching || foldersFetching}
                    onRefresh={onRefresh}
                    tintColor={colors.foreground}
                    colors={[colors.foreground]}
                  />
                }
              >
                {filteredFolders.length === 0 ? (
                  <View className="w-full max-w-2xl mx-auto flex-1 justify-center items-center pt-24">
                    <Archive
                      color={colors.mutedForeground}
                      size={48}
                      style={{ marginBottom: 16 }}
                    />
                    <Text className="text-xl font-semibold text-muted-foreground mb-2">
                      {searchQuery.trim() ? "No matching folders" : "No archived folders"}
                    </Text>
                    <Text className="text-sm text-muted-foreground text-center">
                      {searchQuery.trim() ? "Try a different search term" : "Folders you archive will appear here"}
                    </Text>
                  </View>
                ) : (
                  <View className="w-full max-w-2xl mx-auto">
                    {(() => {
                      const maxWidth = 672;
                      const containerPadding = 16;
                      const gap = 12;
                      const availableWidth =
                        Math.min(screenWidth, maxWidth) - containerPadding * 2;
                      const cardWidth = availableWidth;

                      return (
                        <View style={{ width: cardWidth, alignSelf: "center" }}>
                          {filteredFolders.map((folder: Folder, index: number) => (
                            <View
                              key={folder.id}
                              style={{
                                marginBottom:
                                  index < filteredFolders.length - 1 ? gap : 0,
                              }}
                            >
                              <FolderCard
                                folder={folder}
                                cardWidth={cardWidth}
                                variant="list"
                                isArchived
                                isSelected={selectedFolders.has(folder.id)}
                                onToggleSelect={() => toggleFolderSelection(folder.id)}
                                onPress={() => {}}
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
          </TabsContent>
        </Tabs>
      </View>

      {/* Delete Confirmation Dialog */}
      {Platform.OS === "web" ? (
        deleteDialogOpen && (
          <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Pressable
              className="absolute inset-0"
              onPress={() => setDeleteDialogOpen(false)}
            />
            <View className="w-full max-w-md rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">
                {deleteAction?.type === "all"
                  ? `Delete All ${deleteLabelPlural}`
                  : deleteAction?.type === "selected"
                    ? `Delete Selected ${deleteLabelPlural}`
                    : `Delete ${deleteLabel}`}
              </Text>
              <Text className="mb-6 text-sm text-muted-foreground">
                {deleteAction?.type === "all"
                  ? `Are you sure you want to permanently delete all ${deleteCount} archived ${deleteTab}? This will also delete all notes and files inside each folder. This action cannot be undone.`
                  : deleteAction?.type === "selected"
                    ? `Are you sure you want to permanently delete ${selectedDeleteCount} selected ${deleteLabel.toLowerCase()}${selectedDeleteCount > 1 ? "s" : ""}?${deleteTab === "folders" ? " This will also delete all notes and files inside each folder." : ""} This action cannot be undone.`
                    : `Are you sure you want to permanently delete this ${deleteLabel.toLowerCase()}?${deleteTab === "folders" ? " This will also delete all notes and files inside it." : ""} This action cannot be undone.`}
              </Text>
              <View className="flex-row justify-end gap-3">
                <Pressable
                  className="px-4 py-2"
                  onPress={() => setDeleteDialogOpen(false)}
                  disabled={deleteNoteMutation.isPending || deleteFileMutation.isPending || deleteFolderMutation.isPending}
                >
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className="rounded-md px-4 py-2"
                  onPress={confirmDelete}
                  disabled={deleteNoteMutation.isPending || deleteFileMutation.isPending || deleteFolderMutation.isPending}
                >
                  <Text className="font-semibold text-red-500">
                    {deleteNoteMutation.isPending || deleteFileMutation.isPending || deleteFolderMutation.isPending ? "Deleting..." : "Delete"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )
      ) : (
        <Modal
          visible={deleteDialogOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setDeleteDialogOpen(false)}
        >
          <View className="flex-1 items-center justify-center bg-black/50 p-4">
            <Pressable
              className="absolute inset-0"
              onPress={() => setDeleteDialogOpen(false)}
            />
            <View className="w-full max-w-[400px] rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">
                {deleteAction?.type === "all"
                  ? `Delete All ${deleteLabelPlural}`
                  : deleteAction?.type === "selected"
                    ? `Delete Selected ${deleteLabelPlural}`
                    : `Delete ${deleteLabel}`}
              </Text>
              <Text className="mb-6 text-sm text-muted-foreground">
                {deleteAction?.type === "all"
                  ? `Are you sure you want to permanently delete all ${deleteCount} archived ${deleteTab}?${deleteTab === "folders" ? " This will also delete all notes and files inside each folder." : ""} This action cannot be undone.`
                  : deleteAction?.type === "selected"
                    ? `Are you sure you want to permanently delete ${selectedDeleteCount} selected ${deleteLabel.toLowerCase()}${selectedDeleteCount > 1 ? "s" : ""}?${deleteTab === "folders" ? " This will also delete all notes and files inside each folder." : ""} This action cannot be undone.`
                    : `Are you sure you want to permanently delete this ${deleteLabel.toLowerCase()}?${deleteTab === "folders" ? " This will also delete all notes and files inside it." : ""} This action cannot be undone.`}
              </Text>
              <View className="flex-row justify-end gap-3">
                <Pressable
                  className="px-4 py-2"
                  onPress={() => setDeleteDialogOpen(false)}
                  disabled={deleteNoteMutation.isPending || deleteFileMutation.isPending || deleteFolderMutation.isPending}
                >
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className="rounded-md px-4 py-2"
                  onPress={confirmDelete}
                  disabled={deleteNoteMutation.isPending || deleteFileMutation.isPending || deleteFolderMutation.isPending}
                >
                  <Text className="font-semibold text-red-500">
                    {deleteNoteMutation.isPending || deleteFileMutation.isPending || deleteFolderMutation.isPending ? "Deleting..." : "Delete"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Restore Confirmation Dialog */}
      {Platform.OS === "web" ? (
        restoreDialogOpen && (
          <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Pressable
              className="absolute inset-0"
              onPress={() => setRestoreDialogOpen(false)}
            />
            <View className="w-full max-w-md rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">
                {restoreAction?.type === "all"
                  ? `Restore All ${restoreLabelPlural}`
                  : restoreAction?.type === "selected"
                    ? `Restore Selected ${restoreLabelPlural}`
                    : `Restore ${restoreLabel}`}
              </Text>
              <Text className="mb-6 text-sm text-muted-foreground">
                {restoreAction?.type === "all"
                  ? `Are you sure you want to restore all ${restoreCount} archived ${restoreTab}?${restoreTab === "folders" ? " This will also restore all notes and files inside each folder." : ""}`
                  : restoreAction?.type === "selected"
                    ? `Are you sure you want to restore ${selectedRestoreCount} selected ${restoreLabel.toLowerCase()}${selectedRestoreCount > 1 ? "s" : ""}?${restoreTab === "folders" ? " This will also restore all notes and files inside each folder." : ""}`
                    : `Are you sure you want to restore this ${restoreLabel.toLowerCase()}?${restoreTab === "folders" ? " This will also restore all notes and files inside it." : ""}`}
              </Text>
              <View className="flex-row justify-end gap-3">
                <Pressable
                  className="px-4 py-2"
                  onPress={() => setRestoreDialogOpen(false)}
                  disabled={restoreNoteMutation.isPending || restoreFileMutation.isPending || restoreFolderMutation.isPending}
                >
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className="rounded-md px-4 py-2"
                  onPress={confirmRestore}
                  disabled={restoreNoteMutation.isPending || restoreFileMutation.isPending || restoreFolderMutation.isPending}
                >
                  <Text className="font-semibold text-blue-500">
                    {restoreNoteMutation.isPending || restoreFileMutation.isPending || restoreFolderMutation.isPending ? "Restoring..." : "Restore"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )
      ) : (
        <Modal
          visible={restoreDialogOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setRestoreDialogOpen(false)}
        >
          <View className="flex-1 items-center justify-center bg-black/50 p-4">
            <Pressable
              className="absolute inset-0"
              onPress={() => setRestoreDialogOpen(false)}
            />
            <View className="w-full max-w-[400px] rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">
                {restoreAction?.type === "all"
                  ? `Restore All ${restoreLabelPlural}`
                  : restoreAction?.type === "selected"
                    ? `Restore Selected ${restoreLabelPlural}`
                    : `Restore ${restoreLabel}`}
              </Text>
              <Text className="mb-6 text-sm text-muted-foreground">
                {restoreAction?.type === "all"
                  ? `Are you sure you want to restore all ${restoreCount} archived ${restoreTab}?${restoreTab === "folders" ? " This will also restore all notes and files inside each folder." : ""}`
                  : restoreAction?.type === "selected"
                    ? `Are you sure you want to restore ${selectedRestoreCount} selected ${restoreLabel.toLowerCase()}${selectedRestoreCount > 1 ? "s" : ""}?${restoreTab === "folders" ? " This will also restore all notes and files inside each folder." : ""}`
                    : `Are you sure you want to restore this ${restoreLabel.toLowerCase()}?${restoreTab === "folders" ? " This will also restore all notes and files inside it." : ""}`}
              </Text>
              <View className="flex-row justify-end gap-3">
                <Pressable
                  className="px-4 py-2"
                  onPress={() => setRestoreDialogOpen(false)}
                  disabled={restoreNoteMutation.isPending || restoreFileMutation.isPending || restoreFolderMutation.isPending}
                >
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className="rounded-md px-4 py-2"
                  onPress={confirmRestore}
                  disabled={restoreNoteMutation.isPending || restoreFileMutation.isPending || restoreFolderMutation.isPending}
                >
                  <Text className="font-semibold text-blue-500">
                    {restoreNoteMutation.isPending || restoreFileMutation.isPending || restoreFolderMutation.isPending ? "Restoring..." : "Restore"}
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

interface ArchivedNoteCardProps {
  note: Note;
  cardWidth: number;
  /** True when note is synced with Supabase (double check); false = single check. */
  isSynced: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}

function ArchivedNoteCard({
  note,
  cardWidth,
  isSynced,
  isSelected,
  onToggleSelect,
}: ArchivedNoteCardProps) {
  const { colors } = useThemeColors();
  const scale = useRef(new Animated.Value(1)).current;

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

  // Calculate variable card height based on content length for masonry effect
  const padding = 16; // p-4 = 16px
  const contentLength = note.content?.length || 0;
  const titleHeight = 24; // Approximate title height
  const dateHeight = 14; // Approximate date height
  const minContentHeight = 40;
  const maxContentHeight = 120;

  // Calculate content height based on text length (rough estimate)
  // Each character is roughly 6px wide, with line breaks every ~50 chars
  const lines = Math.ceil((contentLength || 0) / 50);
  const contentHeight = Math.min(
    Math.max(minContentHeight, lines * 18),
    maxContentHeight
  );

  // A4 paper aspect ratio: height/width = 297/210 ≈ 1.414
  const a4MaxHeight = cardWidth * 1.414;
  const calculatedHeight = titleHeight + contentHeight + dateHeight + padding * 2 + 8; // +8 for spacing
  const cardHeight = Math.min(calculatedHeight, a4MaxHeight);

  return (
    <Pressable
      onPress={onToggleSelect}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Card
          className="rounded-2xl bg-muted border border-border p-4 relative"
          style={{
            width: cardWidth,
            minHeight: cardHeight,
            maxHeight: a4MaxHeight,
          }}
        >
          <View className="absolute top-4 right-4 z-10">
            <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
          </View>
          <Text
            className="text-lg font-semibold text-foreground"
            numberOfLines={1}
          >
            {note.title || "Untitled"}
          </Text>
          <Text
            className="text-sm text-muted-foreground leading-4"
            numberOfLines={contentLength > 200 ? 8 : 6}
          >
            {note.content ? note.content : "No content"}
          </Text>
          <View className="flex-row items-center justify-end mt-2 gap-1">
            <Text className="text-xs text-muted-foreground/70">
              {formatDate(note.updated_at)}
            </Text>
            {isSynced ? (
              <CheckCheck
                size={14}
                color={colors.mutedForeground + "90"}

              />
            ) : (
              <Check
                size={14}
                color={colors.mutedForeground + "90"}

              />
            )}
          </View>
        </Card>
      </Animated.View>
    </Pressable>
  );
}

interface ArchivedFileCardProps {
  file: FileRecord;
  formatFileSize: (bytes: number) => string;
  cardWidth: number;
  isSelected: boolean;
  onToggleSelect: () => void;
}

function ArchivedFileCard({
  file,
  formatFileSize,
  cardWidth,
  isSelected,
  onToggleSelect,
}: ArchivedFileCardProps) {
  const { colors } = useThemeColors();
  const scale = useRef(new Animated.Value(1)).current;

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

  const padding = 8;
  const fileWidth = cardWidth - padding * 2;
  const fileHeight = (fileWidth / 130) * 150;
  const foldSize = Math.max(20, fileWidth * 0.2);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onToggleSelect}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View className="mb-3 items-center">
          <View
            className="bg-muted rounded overflow-hidden relative"
            style={{ width: fileWidth, height: fileHeight }}
          >
            <View className="absolute top-2 left-2 z-10">
              <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
            </View>
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
          <View
            className="mt-2 items-center flex-row justify-between"
            style={{ width: cardWidth }}
          >
            <View className="flex-1">
              <Text
                className="text-xs font-medium text-foreground text-center"
                numberOfLines={1}
              >
                {file.name}
              </Text>
              <Text className="text-[10px] text-muted-foreground mt-0.5 text-center">
                {formatDate(file.updated_at)}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

interface ArchivedFileListCardProps {
  file: FileRecord;
  formatFileSize: (bytes: number) => string;
  cardWidth: number;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
}

function ArchivedFileListCard({
  file,
  formatFileSize,
  cardWidth,
  isSelected,
  onToggleSelect,
  onDelete,
}: ArchivedFileListCardProps) {
  const { colors } = useThemeColors();
  const scale = useRef(new Animated.Value(1)).current;

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

  const cardHeight = 80;
  const iconSize = 56;
  const padding = 12;
  const foldSize = Math.max(12, iconSize * 0.2);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onToggleSelect}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View
          className="flex-row items-center p-3 gap-3 bg-muted border border-border rounded-xl"
          style={{ width: cardWidth, height: cardHeight }}
        >
          <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
          <View
            className="bg-background border border-muted rounded overflow-hidden relative"
            style={{ width: iconSize, height: iconSize }}
          >
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
                  {formatFileSize(file.file_size).split(" ")[0]}
                </Text>
              </View>
            </View>
          </View>
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


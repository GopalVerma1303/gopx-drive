"use client";

import { LongPressOptionsModal } from "@/components/long-press-options-modal";
import { MoveToFolderModal } from "@/components/move-to-folder-modal";
import { NoteCard } from "@/components/note-card";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useAlert } from "@/contexts/alert-context";
import { useAuth } from "@/contexts/auth-context";
import { useViewMode } from "@/contexts/view-mode-context";
import { listFolders } from "@/lib/folders";
import { CARD_LIST_MAX_WIDTH } from "@/lib/layout";
import {
  archiveNote,
  getNotesSyncStatus,
  getUnsyncedNoteIds,
  listNotes,
  updateNote,
} from "@/lib/notes";
import { invalidateFoldersQueries, invalidateNotesListQueries } from "@/lib/query-utils";
import type { Note } from "@/lib/supabase";
import { THEME } from "@/lib/theme";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { LayoutGrid, Plus, Rows2, Search, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function NotesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { alert } = useAlert();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { getViewMode, toggleViewMode } = useViewMode();
  const [searchQuery, setSearchQuery] = useState("");
  const [screenWidth, setScreenWidth] = useState(() => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        return window.innerWidth;
      }
    }
    return Dimensions.get("window").width;
  });

  // Do not sync/invalidate on every mount (e.g. when switching back to Notes tab).
  // That caused unwanted Supabase refetches every time. Rely on:
  // - App foreground sync in (app)/_layout.tsx
  // - Pull-to-refresh on this screen
  // - staleTime so cached data is used when returning to the tab

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

  const viewMode = getViewMode("notes");

  // Always use 2 columns for all devices
  const columns = 2;

  const {
    data: notes = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["notes", user?.id],
    queryFn: () => listNotes(user?.id),
    enabled: !!user?.id,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes - cache for 5 minutes
    // Use cached data immediately, don't show loading if we have cache
    placeholderData: (previousData) => previousData,
    // Don't throw errors on network failures - use cache instead
    retry: false,
    retryOnMount: false,
  });

  const { data: syncStatus } = useQuery({
    queryKey: ["notes-sync-status", user?.id],
    queryFn: () => getNotesSyncStatus(user?.id),
    // Optimize polling: poll more frequently when there are pending changes, less when idle
    refetchInterval: (query) => {
      const pendingCount = query.state.data?.pendingCount ?? 0;
      // Poll every 2s when syncing, 5s when pending changes, 15s when idle
      if (query.state.data?.isSyncing) return 2000;
      if (pendingCount > 0) return 5000;
      return 15000; // Reduced from 10s to 15s when idle
    },
    enabled: !!user?.id,
  });

  const { data: unsyncedNoteIds = [] } = useQuery({
    queryKey: ["notes-unsynced-ids", user?.id],
    queryFn: () => getUnsyncedNoteIds(user?.id),
    // Match sync status polling frequency
    refetchInterval: (query) => {
      const pendingCount = syncStatus?.pendingCount ?? 0;
      if (syncStatus?.isSyncing) return 2000;
      if (pendingCount > 0) return 5000;
      return 15000; // Reduced from 10s to 15s when idle
    },
    enabled: !!user?.id,
  });

  const { data: folders = [] } = useQuery({
    queryKey: ["folders", user?.id],
    queryFn: () => listFolders(user?.id),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  });

  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<{ id: string; title: string } | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const archiveMutation = useMutation({
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

  const moveNoteMutation = useMutation({
    mutationFn: ({ noteId, folderId }: { noteId: string; folderId: string | null }) =>
      updateNote(noteId, { folder_id: folderId }),
    onSuccess: (_data, { noteId }) => {
      invalidateNotesListQueries(queryClient, user?.id);
      invalidateFoldersQueries(queryClient, user?.id);
      queryClient.invalidateQueries({ queryKey: ["note", noteId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMoveModalOpen(false);
      setSelectedNote(null);
      setSelectedFolderId(null);
    },
  });

  const handleArchiveNote = (id: string, title: string) => {
    alert("Archive Note", `Are you sure you want to archive "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Archive",
        style: "default",
        onPress: () => archiveMutation.mutate(id),
      },
    ]);
  };

  const handleLongPressNote = (id: string, title: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSelectedNote({ id, title });
    setOptionsModalOpen(true);
  };

  const openArchiveConfirm = () => {
    setOptionsModalOpen(false);
    if (selectedNote) {
      setArchiveDialogOpen(true);
    }
  };

  const openMoveModal = () => {
    setOptionsModalOpen(false);
    const note = selectedNote ? notes.find((n) => n.id === selectedNote.id) : null;
    setSelectedFolderId(note?.folder_id ?? null);
    setMoveModalOpen(true);
  };

  const handleArchiveConfirm = () => {
    if (selectedNote) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      archiveMutation.mutate(selectedNote.id);
    }
  };

  const handleMoveConfirm = () => {
    if (!selectedNote) return;
    moveNoteMutation.mutate({
      noteId: selectedNote.id,
      folderId: selectedFolderId,
    });
  };

  const closeMoveModal = () => {
    setMoveModalOpen(false);
    setSelectedNote(null);
    setSelectedFolderId(null);
  };

  const filteredNotes = notes.filter((note) =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase())
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
              Notes
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
                toggleViewMode("notes");
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
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/(app)/note/new");
              }}
              style={{ paddingVertical: 8 }}
            >
              <Plus color={colors.foreground} size={22} />
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
              placeholder="Search notes..."
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
            {filteredNotes.length === 0 ? (
              <View
                className="flex-1 justify-center items-center pt-24 mx-auto"
                style={{ width: "100%", maxWidth: CARD_LIST_MAX_WIDTH }}
              >
                <Text className="text-xl font-semibold text-muted-foreground mb-2">
                  {searchQuery ? "No notes found" : "No notes yet"}
                </Text>
                <Text className="text-sm text-muted-foreground text-center">
                  {searchQuery
                    ? "Try a different search"
                    : "Tap the + button to create your first note"}
                </Text>
              </View>
            ) : viewMode === "grid" ? (
              <View className="mx-auto" style={{ width: "100%", maxWidth: CARD_LIST_MAX_WIDTH }}>
                {(() => {
                  // Calculate card width
                  const containerPadding = 16; // p-4 = 16px
                  const columnGap = 12; // horizontal gap between columns
                  const rowGap = 12; // vertical gap between cards
                  const availableWidth = Math.min(screenWidth, CARD_LIST_MAX_WIDTH) - containerPadding * 2;
                  // Calculate card width accounting for gap between columns
                  const cardWidth = (availableWidth - columnGap * (columns - 1)) / columns;

                  // Distribute notes into columns for masonry layout
                  const columnHeights = new Array(columns).fill(0);
                  const columnsData: Note[][] = new Array(columns).fill(null).map(() => []);

                  filteredNotes.forEach((note) => {
                    // Find the shortest column
                    const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
                    columnsData[shortestColumnIndex].push(note);
                    // Estimate height based on content length (matching NoteCard calculation)
                    const contentLength = note.content?.length || 0;
                    const titleHeight = 24;
                    const dateHeight = 14;
                    const padding = 16 * 2; // top and bottom
                    const minContentHeight = 40;
                    const maxContentHeight = 120;
                    const lines = Math.ceil(contentLength / 50);
                    const contentHeight = Math.min(
                      Math.max(minContentHeight, lines * 18),
                      maxContentHeight
                    );
                    // A4 paper aspect ratio: height/width = 297/210 ≈ 1.414
                    const a4MaxHeight = cardWidth * 1.414;
                    const calculatedHeight = titleHeight + contentHeight + dateHeight + padding + 8;
                    const estimatedHeight = Math.min(calculatedHeight, a4MaxHeight) + rowGap;
                    columnHeights[shortestColumnIndex] += estimatedHeight;
                  });

                  // Calculate total width needed for columns
                  const totalWidth = cardWidth * columns + columnGap * (columns - 1);

                  return (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        width: totalWidth,
                        alignSelf: "center",
                      }}
                    >
                      {columnsData.map((columnNotes, columnIndex) => (
                        <View
                          key={columnIndex}
                          style={{
                            width: cardWidth,
                            marginRight: columnIndex < columns - 1 ? columnGap : 0,
                          }}
                        >
                          {columnNotes.map((note, noteIndex) => (
                            <View
                              key={note.id}
                              style={{
                                marginBottom: noteIndex < columnNotes.length - 1 ? rowGap : 0,
                              }}
                            >
                              <NoteCard
                                note={note}
                                cardWidth={cardWidth}
                                isSynced={!unsyncedNoteIds.includes(note.id)}
                                onPress={() => router.push(`/(app)/note/${note.id}`)}
                                onDelete={() => handleLongPressNote(note.id, note.title)}
                                onRightClickDelete={
                                  Platform.OS === "web"
                                    ? () => handleLongPressNote(note.id, note.title)
                                    : undefined
                                }
                              />
                            </View>
                          ))}
                        </View>
                      ))}
                    </View>
                  );
                })()}
              </View>
            ) : (
              <View className="mx-auto" style={{ width: "100%", maxWidth: CARD_LIST_MAX_WIDTH }}>
                {(() => {
                  // List view: full width cards
                  const containerPadding = 16; // p-4 = 16px
                  const gap = 12; // gap between cards
                  const availableWidth = Math.min(screenWidth, CARD_LIST_MAX_WIDTH) - containerPadding * 2;
                  const cardWidth = availableWidth;

                  return (
                    <View style={{ width: cardWidth, alignSelf: "center" }}>
                      {filteredNotes.map((note, noteIndex) => (
                        <View
                          key={note.id}
                          style={{
                            marginBottom: noteIndex < filteredNotes.length - 1 ? gap : 0,
                          }}
                        >
                          <NoteCard
                            note={note}
                            cardWidth={cardWidth}
                            isSynced={!unsyncedNoteIds.includes(note.id)}
                            onPress={() => router.push(`/(app)/note/${note.id}`)}
                            onDelete={() => handleLongPressNote(note.id, note.title)}
                            onRightClickDelete={
                              Platform.OS === "web"
                                ? () => handleLongPressNote(note.id, note.title)
                                : undefined
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
      </View>

      <LongPressOptionsModal
        visible={optionsModalOpen}
        onClose={() => { setOptionsModalOpen(false); setSelectedNote(null); }}
        title={selectedNote?.title ?? "Untitled"}
        onMove={openMoveModal}
        onArchive={openArchiveConfirm}
      />

      <MoveToFolderModal
        visible={moveModalOpen}
        onClose={closeMoveModal}
        itemName={selectedNote?.title ?? "Untitled"}
        selectedFolderId={selectedFolderId}
        onSelectFolder={setSelectedFolderId}
        folders={folders}
        onMoveConfirm={handleMoveConfirm}
        isPending={moveNoteMutation.isPending}
      />

      {/* Archive confirmation dialog */}
      {Platform.OS === "web" ? (
        archiveDialogOpen && (
          <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Pressable
              className="absolute inset-0"
              onPress={() => setArchiveDialogOpen(false)}
            />
            <View className="w-full max-w-md rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">
                Archive Note
              </Text>
              <Text className="mb-6 text-sm text-muted-foreground">
                Are you sure you want to archive "{selectedNote?.title}"? You can restore it from the archive later.
              </Text>
              <View className="flex-row justify-end gap-3">
                <Pressable
                  className="px-4 py-2"
                  onPress={() => setArchiveDialogOpen(false)}
                  disabled={archiveMutation.isPending}
                >
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className="rounded-md px-4 py-2"
                  onPress={handleArchiveConfirm}
                  disabled={archiveMutation.isPending}
                >
                  <Text className="font-semibold text-red-500">
                    {archiveMutation.isPending ? "Archiving..." : "Archive"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )
      ) : (
        <Modal
          visible={archiveDialogOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setArchiveDialogOpen(false)}
        >
          <View className="flex-1 items-center justify-center bg-black/50 p-4">
            <Pressable
              className="absolute inset-0"
              onPress={() => setArchiveDialogOpen(false)}
            />
            <View className="w-full max-w-[400px] rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">
                Archive Note
              </Text>
              <Text className="mb-6 text-sm text-muted-foreground">
                Are you sure you want to archive "{selectedNote?.title}"? You can restore it from the archive later.
              </Text>
              <View className="flex-row justify-end gap-3">
                <Pressable
                  className="px-4 py-2"
                  onPress={() => setArchiveDialogOpen(false)}
                  disabled={archiveMutation.isPending}
                >
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className="rounded-md px-4 py-2"
                  onPress={handleArchiveConfirm}
                  disabled={archiveMutation.isPending}
                >
                  <Text className="font-semibold text-red-500">
                    {archiveMutation.isPending ? "Archiving..." : "Archive"}
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

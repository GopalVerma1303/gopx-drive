"use client";

import { EventCard } from "@/components/event-card";
import { EventModal } from "@/components/event-modal";
import { FileCard, FileListCard, formatFileSize } from "@/components/file-card";
import { FileUploadModal } from "@/components/file-upload-modal";
import { LongPressOptionsModal } from "@/components/long-press-options-modal";
import { MoveToFolderModal } from "@/components/move-to-folder-modal";
import { NoteCard } from "@/components/note-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useAlert } from "@/contexts/alert-context";
import { useAuth } from "@/contexts/auth-context";
import { useViewMode } from "@/contexts/view-mode-context";
import { getTodaysAndTomorrowsEvents } from "@/lib/calendar-utils";
import { createEvent, listEvents } from "@/lib/events";
import { archiveFile, listFiles, updateFile, uploadFile } from "@/lib/files";
import { listFolders } from "@/lib/folders";
import { NAV_BAR_HEIGHT } from "@/lib/layout";
import { archiveNote, getUnsyncedNoteIds, listNotes, updateNote } from "@/lib/notes";
import { invalidateEventsQueries, invalidateFilesQueries, invalidateFoldersQueries, invalidateNotesListQueries } from "@/lib/query-utils";
import type { File as FileRecord, Note } from "@/lib/supabase";
import { useFilePreview } from "@/lib/use-file-preview";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { Calendar, FileText, Files, LayoutGrid, Pin, Plus, Rows2 } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const containerPadding = 16;
const sectionGap = 24;
const cardGap = 12;
const maxWidth = 672;

const transicon = require("@/assets/images/transicon.png");

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { alert } = useAlert();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { getViewMode, toggleViewMode, isLoaded: isViewModeLoaded } = useViewMode();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<
    | { type: "note"; item: Note }
    | { type: "file"; item: FileRecord }
    | null
  >(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [screenWidth, setScreenWidth] = useState(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      return window.innerWidth;
    }
    return Dimensions.get("window").width;
  });
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  const viewMode = getViewMode("home");

  const isNavHorizontal = screenWidth < 768;

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

  const {
    data: events = [],
    isLoading: eventsLoading,
    refetch: refetchEvents,
    isFetching: eventsFetching,
  } = useQuery({
    queryKey: ["events", user?.id],
    queryFn: () => listEvents(user?.id),
    enabled: !!user?.id,
    refetchOnMount: false,
    staleTime: 2 * 60 * 1000,
    placeholderData: (p) => p,
    retry: false,
  });

  const { data: unsyncedNoteIds = [] } = useQuery({
    queryKey: ["notes-unsynced-ids", user?.id],
    queryFn: () => getUnsyncedNoteIds(user?.id),
    refetchInterval: 15000,
    enabled: !!user?.id,
  });

  const { data: folders = [] } = useQuery({
    queryKey: ["folders", user?.id],
    queryFn: () => listFolders(user?.id),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });

  const rootNotes = useMemo(
    () => notes.filter((n) => n.folder_id == null || n.folder_id === ""),
    [notes]
  );
  const rootFiles = useMemo(
    () => files.filter((f) => f.folder_id == null || f.folder_id === ""),
    [files]
  );
  const { today: todaysEvents, tomorrow: tomorrowsEvents } = useMemo(
    () => getTodaysAndTomorrowsEvents(events),
    [events]
  );
  const hasAnyEvents = todaysEvents.length > 0 || tomorrowsEvents.length > 0;

  const contentWidth = Math.min(screenWidth, maxWidth) - containerPadding * 2;
  const columns = 2;
  const columnGap = 12;
  const rowGap = cardGap;
  const gridCardWidth = (contentWidth - columnGap * (columns - 1)) / columns;
  const totalGridWidth = gridCardWidth * columns + columnGap * (columns - 1);

  const onRefresh = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([refetchNotes(), refetchFiles(), refetchEvents()]);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const { handleFilePress, PreviewModal } = useFilePreview();

  const handleUploadFromModal = async (params: {
    file: { uri: string | globalThis.File; name: string; type: string; size: number };
  }) => {
    if (!user) return;
    await uploadFile({
      user_id: user.id,
      file: params.file,
    });
    invalidateFilesQueries(queryClient, user.id);
    alert("Success", "File uploaded successfully");
  };

  const createEventMutation = useMutation({
    mutationFn: (input: {
      user_id: string;
      title: string;
      description: string;
      event_date: string;
      repeat_interval?: "once" | "daily" | "weekly" | "monthly" | "yearly" | null;
    }) => createEvent(input),
    onSuccess: () => {
      if (user?.id) invalidateEventsQueries(queryClient, user.id);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEventModalOpen(false);
    },
    onError: (error: Error) => {
      alert("Error", error.message || "Failed to create event");
    },
  });

  const archiveNoteMutation = useMutation({
    mutationFn: (id: string) => archiveNote(id),
    onSuccess: () => {
      if (user?.id) invalidateNotesListQueries(queryClient, user.id);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setOptionsModalOpen(false);
      setSelectedItem(null);
      setArchiveDialogOpen(false);
    },
  });

  const archiveFileMutation = useMutation({
    mutationFn: (id: string) => archiveFile(id),
    onSuccess: () => {
      if (user?.id) invalidateFilesQueries(queryClient, user.id);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setOptionsModalOpen(false);
      setSelectedItem(null);
      setArchiveDialogOpen(false);
    },
  });

  const moveNoteMutation = useMutation({
    mutationFn: ({ noteId, folderId }: { noteId: string; folderId: string | null }) =>
      updateNote(noteId, { folder_id: folderId }),
    onSuccess: (_data, { noteId }) => {
      if (user?.id) {
        invalidateNotesListQueries(queryClient, user.id);
        invalidateFoldersQueries(queryClient, user.id);
        queryClient.invalidateQueries({ queryKey: ["note", noteId] });
      }
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMoveModalOpen(false);
      setSelectedItem(null);
      setSelectedFolderId(null);
    },
  });

  const moveFileMutation = useMutation({
    mutationFn: ({ fileId, folderId }: { fileId: string; folderId: string | null }) =>
      updateFile(fileId, { folder_id: folderId }),
    onSuccess: (_data, { fileId }) => {
      if (user?.id) {
        invalidateFilesQueries(queryClient, user.id);
        invalidateFoldersQueries(queryClient, user.id);
      }
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMoveModalOpen(false);
      setSelectedItem(null);
      setSelectedFolderId(null);
    },
  });

  const handleNoteLongPress = (note: Note) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedItem({ type: "note", item: note });
    setOptionsModalOpen(true);
  };

  const handleFileLongPress = (file: FileRecord) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedItem({ type: "file", item: file });
    setOptionsModalOpen(true);
  };

  const closeOptionsModal = () => {
    setOptionsModalOpen(false);
    setSelectedItem(null);
  };

  const openArchiveConfirm = () => {
    if (!selectedItem) return;
    setOptionsModalOpen(false);
    setArchiveDialogOpen(true);
  };

  const handleArchiveConfirm = () => {
    if (!selectedItem) return;
    if (selectedItem.type === "note") {
      archiveNoteMutation.mutate(selectedItem.item.id);
    } else {
      archiveFileMutation.mutate(selectedItem.item.id);
    }
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

  const isLoading = notesLoading || filesLoading || eventsLoading;
  const isRefreshing = notesFetching || filesFetching || eventsFetching;

  return (
    <View className="flex-1 w-full" style={{ backgroundColor: colors.background }}>
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
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingLeft: 8, gap: 10 }}>
            {isNavHorizontal ? (
              <>
                {Platform.OS === "web" ? (
                  <Image
                    source={transicon}
                    style={{ width: 28, height: 28 }}
                    resizeMode="contain"
                    className="filter dark:invert"
                  />
                ) : (
                  <Image
                    source={transicon}
                    style={{ width: 28, height: 28, tintColor: colors.foreground }}
                    resizeMode="contain"
                  />
                )}
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    color: colors.foreground,
                  }}
                >
                  Gopx Drive
                </Text>
              </>
            ) : (
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "600",
                  color: colors.foreground,
                }}
              >
                Home
              </Text>
            )}
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingRight: 8,
            }}
          >
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
                toggleViewMode("home");
              }}
              style={{ paddingVertical: 8 }}
            >
              {viewMode === "grid" ? (
                <Rows2 color={colors.foreground} size={22} />
              ) : (
                <LayoutGrid color={colors.foreground} size={22} />
              )}
            </Pressable>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Pressable
                  onPress={() => {
                    if (Platform.OS !== "web") {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }
                  }}
                  style={{ paddingVertical: 8, paddingLeft: 16 }}
                >
                  <Plus color={colors.foreground} size={22} />
                </Pressable>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="end" sideOffset={0} alignOffset={0}>
                <DropdownMenuItem
                  onPress={() => {
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push("/(app)/note/new");
                  }}
                  className="flex flex-row items-center gap-2"
                >
                  <Icon as={FileText} className="size-4 text-foreground" />
                  <Text style={{ color: colors.foreground }}>Note</Text>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onPress={() => {
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setUploadModalOpen(true);
                  }}
                  className="flex flex-row items-center gap-2"
                >
                  <Icon as={Files} className="size-4 text-foreground" />
                  <Text style={{ color: colors.foreground }}>File</Text>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onPress={() => {
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setEventModalOpen(true);
                  }}
                  className="flex flex-row items-center gap-2"
                >
                  <Icon as={Calendar} className="size-4 text-foreground" />
                  <Text style={{ color: colors.foreground }}>Event</Text>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 24 }}>
          <ActivityIndicator size="large" color={colors.foreground} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: 24,
            paddingHorizontal: containerPadding,
            paddingBottom: insets.bottom + NAV_BAR_HEIGHT + 32,
            maxWidth: maxWidth,
            alignSelf: "center",
            width: "100%",
          }}
          refreshControl={
            <RefreshControl
              progressBackgroundColor={colors.background}
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.foreground}
              colors={[colors.foreground]}
            />
          }
        >
          {/* Notes section — always visible */}
          <View style={{ marginBottom: sectionGap }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Pin size={16} color={colors.foreground} fill={colors.foreground} />
                <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground }}>
                  Notes
                </Text>
              </View>
            </View>
            <View style={{ width: contentWidth, alignSelf: "center" }}>
              {rootNotes.length > 0 ? (
                <>
                  {viewMode === "grid" ? (
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        justifyContent: "flex-start",
                        width: totalGridWidth,
                        alignSelf: "center",
                      }}
                    >
                      {rootNotes.slice(0, 6).map((note, index) => {
                        const marginRight = index % columns < columns - 1 ? columnGap : 0;
                        const marginBottom = rowGap;
                        return (
                          <View
                            key={note.id}
                            style={{
                              width: gridCardWidth,
                              marginRight,
                              marginBottom,
                            }}
                          >
                            <NoteCard
                              note={note}
                              cardWidth={gridCardWidth}
                              isSynced={!unsyncedNoteIds.includes(note.id)}
                              onPress={() => router.push(`/(app)/note/${note.id}`)}
                              onDelete={() => handleNoteLongPress(note)}
                              onRightClickDelete={() => handleNoteLongPress(note)}
                            />
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <>
                      {rootNotes.slice(0, 5).map((note, i) => (
                        <View
                          key={note.id}
                          style={{ marginBottom: i < Math.min(5, rootNotes.length) - 1 ? cardGap : 0 }}
                        >
                          <NoteCard
                            note={note}
                            cardWidth={contentWidth}
                            isSynced={!unsyncedNoteIds.includes(note.id)}
                            onPress={() => router.push(`/(app)/note/${note.id}`)}
                            onDelete={() => handleNoteLongPress(note)}
                            onRightClickDelete={() => handleNoteLongPress(note)}
                          />
                        </View>
                      ))}
                    </>
                  )}
                  {rootNotes.length > (viewMode === "grid" ? 6 : 5) && (
                    <Pressable
                      onPress={() => router.push("/(app)/notes")}
                      style={{
                        paddingVertical: 12,
                        alignItems: "center",
                        marginTop: 4,
                      }}
                    >
                      <Text style={{ fontSize: 14, color: colors.primary, fontWeight: "500" }}>
                        View all {rootNotes.length} notes
                      </Text>
                    </Pressable>
                  )}
                </>
              ) : (
                <Pressable
                  onPress={() => router.push("/(app)/note/new")}
                  style={{ paddingVertical: 16, alignItems: "center" }}
                >
                  <Text style={{ fontSize: 14, color: colors.mutedForeground }}>
                    Click + to add new note
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Files section — always visible */}
          <View style={{ marginBottom: sectionGap }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Pin size={16} color={colors.foreground} fill={colors.foreground} />
                <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground }}>
                  Files
                </Text>
              </View>
            </View>
            <View style={{ width: contentWidth, alignSelf: "center" }}>
              {rootFiles.length > 0 ? (
                <>
                  {viewMode === "grid" ? (
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        justifyContent: "flex-start",
                        width: totalGridWidth,
                        alignSelf: "center",
                      }}
                    >
                      {rootFiles.slice(0, 6).map((file, index) => {
                        const marginRight = index % columns < columns - 1 ? columnGap : 0;
                        const marginBottom = rowGap;
                        return (
                          <View
                            key={file.id}
                            style={{
                              width: gridCardWidth,
                              marginRight,
                              marginBottom,
                            }}
                          >
                            <FileCard
                              file={file}
                              onPress={() => handleFilePress(file)}
                              onDelete={() => handleFileLongPress(file)}
                              onRightClickAction={() => handleFileLongPress(file)}
                              formatFileSize={formatFileSize}
                              cardWidth={gridCardWidth}
                            />
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <>
                      {rootFiles.slice(0, 5).map((file, i) => (
                        <View
                          key={file.id}
                          style={{ marginBottom: i < Math.min(5, rootFiles.length) - 1 ? cardGap : 0 }}
                        >
                          <FileListCard
                            file={file}
                            onPress={() => handleFilePress(file)}
                            onDelete={() => handleFileLongPress(file)}
                            onRightClickAction={() => handleFileLongPress(file)}
                            formatFileSize={formatFileSize}
                            cardWidth={contentWidth}
                          />
                        </View>
                      ))}
                    </>
                  )}
                  {rootFiles.length > (viewMode === "grid" ? 6 : 5) && (
                    <Pressable
                      onPress={() => router.push("/(app)/files")}
                      style={{
                        paddingVertical: 12,
                        alignItems: "center",
                        marginTop: 4,
                      }}
                    >
                      <Text style={{ fontSize: 14, color: colors.primary, fontWeight: "500" }}>
                        View all {rootFiles.length} files
                      </Text>
                    </Pressable>
                  )}
                </>
              ) : (
                <Pressable
                  onPress={() => setUploadModalOpen(true)}
                  style={{ paddingVertical: 16, alignItems: "center" }}
                >
                  <Text style={{ fontSize: 14, color: colors.mutedForeground }}>
                    Click + to add new file
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Events section — always visible */}
          <View style={{ marginBottom: sectionGap }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Pin size={16} color={colors.foreground} fill={colors.foreground} />
                <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground }}>
                  Events
                </Text>
              </View>
            </View>
            <View style={{ width: contentWidth, alignSelf: "center" }}>
              {hasAnyEvents ? (
                <>
                  {todaysEvents.length > 0 && (
                    <View>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: colors.mutedForeground,
                          marginBottom: 8,
                          textTransform: "uppercase",
                        }}
                      >
                        Today
                      </Text>
                      {todaysEvents.map((event) => (
                        <EventCard
                          key={`${event.id}-${event.instanceDate ?? ""}-${event.event_date}`}
                          event={event}
                          onSelectDate={() => router.push("/(app)/calendar")}
                          onEdit={() => router.push("/(app)/calendar")}
                        />
                      ))}
                    </View>
                  )}
                  {tomorrowsEvents.length > 0 && (
                    <View>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: colors.mutedForeground,
                          marginBottom: 8,
                          textTransform: "uppercase",
                        }}
                      >
                        Tomorrow
                      </Text>
                      {tomorrowsEvents.map((event) => (
                        <EventCard
                          key={`${event.id}-${event.instanceDate ?? ""}-${event.event_date}`}
                          event={event}
                          onSelectDate={() => router.push("/(app)/calendar")}
                          onEdit={() => router.push("/(app)/calendar")}
                        />
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <Pressable
                  onPress={() => setEventModalOpen(true)}
                  style={{ paddingVertical: 16, alignItems: "center" }}
                >
                  <Text style={{ fontSize: 14, color: colors.mutedForeground }}>
                    Click + to add new event
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </ScrollView>
      )}

      <FileUploadModal
        visible={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUpload={handleUploadFromModal}
        title="Upload file"
      />

      <EventModal
        open={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        event={null}
        onCreate={createEventMutation.mutate}
        onUpdate={() => { }}
        onDelete={() => { }}
        userId={user?.id ?? ""}
      />

      <LongPressOptionsModal
        visible={optionsModalOpen}
        onClose={closeOptionsModal}
        title={
          selectedItem?.type === "note"
            ? selectedItem.item.title || "Untitled"
            : selectedItem?.item.name ?? "Item"
        }
        onMove={openMoveModal}
        onArchive={openArchiveConfirm}
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
                Archive {selectedItem?.type === "note" ? "Note" : "File"}
              </Text>
              <Text className="mb-6 text-sm text-muted-foreground">
                Are you sure you want to archive "{selectedItem?.type === "note" ? selectedItem.item.title || "Untitled" : selectedItem?.item.name ?? "Item"}"? You can restore it from the archive later.
              </Text>
              <View className="flex-row justify-end gap-3">
                <Pressable
                  className="px-4 py-2"
                  onPress={() => setArchiveDialogOpen(false)}
                  disabled={archiveNoteMutation.isPending || archiveFileMutation.isPending}
                >
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className="rounded-md px-4 py-2"
                  onPress={handleArchiveConfirm}
                  disabled={archiveNoteMutation.isPending || archiveFileMutation.isPending}
                >
                  <Text className="font-semibold text-red-500">
                    {archiveNoteMutation.isPending || archiveFileMutation.isPending ? "Archiving..." : "Archive"}
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
                Archive {selectedItem?.type === "note" ? "Note" : "File"}
              </Text>
              <Text className="mb-6 text-sm text-muted-foreground">
                Are you sure you want to archive "{selectedItem?.type === "note" ? selectedItem.item.title || "Untitled" : selectedItem?.item.name ?? "Item"}"? You can restore it from the archive later.
              </Text>
              <View className="flex-row justify-end gap-3">
                <Pressable
                  className="px-4 py-2"
                  onPress={() => setArchiveDialogOpen(false)}
                  disabled={archiveNoteMutation.isPending || archiveFileMutation.isPending}
                >
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className="rounded-md px-4 py-2"
                  onPress={handleArchiveConfirm}
                  disabled={archiveNoteMutation.isPending || archiveFileMutation.isPending}
                >
                  <Text className="font-semibold text-red-500">
                    {archiveNoteMutation.isPending || archiveFileMutation.isPending ? "Archiving..." : "Archive"}
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

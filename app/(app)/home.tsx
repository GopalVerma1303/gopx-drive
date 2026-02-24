"use client";

import { EventCard } from "@/components/event-card";
import { EventModal } from "@/components/event-modal";
import { FileListCard, formatFileSize } from "@/components/file-card";
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
import { useAuth } from "@/contexts/auth-context";
import { getTodaysAndTomorrowsEvents } from "@/lib/calendar-utils";
import { createEvent, listEvents } from "@/lib/events";
import { archiveFile, getFileDownloadUrl, listFiles, updateFile, uploadFile } from "@/lib/files";
import { listFolders } from "@/lib/folders";
import { archiveNote, getUnsyncedNoteIds, listNotes, updateNote } from "@/lib/notes";
import { invalidateEventsQueries, invalidateFilesQueries, invalidateFoldersQueries, invalidateNotesListQueries } from "@/lib/query-utils";
import type { File as FileRecord, Note } from "@/lib/supabase";
import { useThemeColors } from "@/lib/use-theme-colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { Calendar, FileText, Files, Plus } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const WebView =
  Platform.OS === "web"
    ? null
    : require("react-native-webview").WebView;

const containerPadding = 16;
const sectionGap = 24;
const cardGap = 10;
const maxWidth = 672;

const transicon = require("@/assets/images/transicon.png");

const HOME_CLOCK_STORAGE_KEY = "@home_show_clock";

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
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
  const [time, setTime] = useState(() => new Date());
  const [showClockOnHome, setShowClockOnHome] = useState(true);

  const isNavHorizontal = screenWidth < 768;

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      const handleResize = () => setScreenWidth(window.innerWidth);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
    const sub = Dimensions.addEventListener("change", ({ window: w }) => setScreenWidth(w.width));
    return () => sub?.remove();
  }, []);

  useEffect(() => {
    const loadShowClock = async () => {
      try {
        const stored = await AsyncStorage.getItem(HOME_CLOCK_STORAGE_KEY);
        if (stored === "true" || stored === "false") {
          setShowClockOnHome(stored === "true");
        }
      } catch {
        // ignore read errors, default stays true
      }
    };
    loadShowClock();
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

  const cardWidth = Math.min(screenWidth, maxWidth) - containerPadding * 2;

  const onRefresh = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([refetchNotes(), refetchFiles(), refetchEvents()]);
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

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewRawUrl, setPreviewRawUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string | null>(null);

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
    } catch (error: unknown) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to open file");
    }
  };

  const closePreview = () => {
    setPreviewUrl(null);
    setPreviewRawUrl(null);
    setPreviewFileName(null);
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
      Alert.alert("Error", error.message || "Failed to create event");
    },
  });

  const archiveNoteMutation = useMutation({
    mutationFn: (id: string) => archiveNote(id),
    onSuccess: () => {
      if (user?.id) invalidateNotesListQueries(queryClient, user.id);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setOptionsModalOpen(false);
      setSelectedItem(null);
    },
  });

  const archiveFileMutation = useMutation({
    mutationFn: (id: string) => archiveFile(id),
    onSuccess: () => {
      if (user?.id) invalidateFilesQueries(queryClient, user.id);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setOptionsModalOpen(false);
      setSelectedItem(null);
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

  const hours12 = time.getHours() % 12 || 12;
  const minutes = time.getMinutes();
  const clockTimeStr = `${hours12}:${String(minutes).padStart(2, "0")}`;
  const clockAmpm = time.getHours() < 12 ? "AM" : "PM";

  const dateStr = time.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  // Responsive hero typography: scale with width, clamp for readability
  const heroClockSize = Math.min(96, Math.max(56, screenWidth * 0.18));
  const heroAmpmSize = Math.max(14, heroClockSize * 0.32);
  const heroDateSize = Math.min(22, Math.max(16, screenWidth * 0.045));

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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Pressable
                  onPress={() => {
                    if (Platform.OS !== "web") {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }
                  }}
                  style={{ paddingVertical: 8 }}
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
            paddingBottom: insets.bottom + 32,
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
          {showClockOnHome && (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 24,
                marginBottom: sectionGap,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                <Text
                  style={{
                    fontSize: heroClockSize,
                    lineHeight: heroClockSize * 1.1,
                    fontWeight: "200",
                    color: colors.foreground,
                    letterSpacing: 3,
                  }}
                >
                  {clockTimeStr}
                </Text>
                <Text
                  style={{
                    fontSize: heroAmpmSize,
                    fontWeight: "400",
                    color: colors.mutedForeground,
                    marginLeft: 6,
                  }}
                >
                  {clockAmpm}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: heroDateSize,
                  lineHeight: heroDateSize * 1.25,
                  color: colors.mutedForeground,
                  marginTop: 20,
                  fontWeight: "400",
                }}
              >
                {dateStr}
              </Text>
            </View>
          )}

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
              <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground }}>
                Notes
              </Text>
            </View>
            <View style={{ width: cardWidth, alignSelf: "center" }}>
              {rootNotes.length > 0 ? (
                <>
                  {rootNotes.slice(0, 5).map((note, i) => (
                    <View
                      key={note.id}
                      style={{ marginBottom: i < Math.min(5, rootNotes.length) - 1 ? cardGap : 0 }}
                    >
                      <NoteCard
                        note={note}
                        cardWidth={cardWidth}
                        isSynced={!unsyncedNoteIds.includes(note.id)}
                        onPress={() => router.push(`/(app)/note/${note.id}`)}
                        onDelete={() => handleNoteLongPress(note)}
                        onRightClickDelete={() => handleNoteLongPress(note)}
                      />
                    </View>
                  ))}
                  {rootNotes.length > 5 && (
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
              <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground }}>
                Files
              </Text>
            </View>
            <View style={{ width: cardWidth, alignSelf: "center" }}>
              {rootFiles.length > 0 ? (
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
                        cardWidth={cardWidth}
                      />
                    </View>
                  ))}
                  {rootFiles.length > 5 && (
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
              <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground }}>
                Events
              </Text>
            </View>
            <View style={{ width: cardWidth, alignSelf: "center" }}>
              {hasAnyEvents ? (
                [...todaysEvents, ...tomorrowsEvents].map((event) => (
                  <EventCard
                    key={`${event.id}-${event.instanceDate ?? ""}-${event.event_date}`}
                    event={event}
                    onSelectDate={() => router.push("/(app)/calendar")}
                    onEdit={() => router.push("/(app)/calendar")}
                  />
                ))
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

      {/* File preview (native WebView) */}
      {Platform.OS !== "web" && WebView && previewUrl && previewFileName && (
        <Modal visible={!!previewUrl} animationType="slide" onRequestClose={closePreview}>
          <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 8,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text
                style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}
                numberOfLines={1}
              >
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

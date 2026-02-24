"use client";

import { EventCard } from "@/components/event-card";
import { FileListCard, formatFileSize } from "@/components/file-card";
import { NoteCard } from "@/components/note-card";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { getTodaysAndTomorrowsEvents } from "@/lib/calendar-utils";
import { listEvents } from "@/lib/events";
import { getFileDownloadUrl, listFiles } from "@/lib/files";
import { getUnsyncedNoteIds, listNotes } from "@/lib/notes";
import type { File as FileRecord } from "@/lib/supabase";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
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

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [screenWidth, setScreenWidth] = useState(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      return window.innerWidth;
    }
    return Dimensions.get("window").width;
  });
  const [time, setTime] = useState(() => new Date());

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

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingTop: insets.top }}>
          <ActivityIndicator size="large" color={colors.foreground} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: insets.top + 32,
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
          {/* Hero: clock & date */}
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 40,
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

          {/* Notes section — only if there are root notes */}
          {rootNotes.length > 0 && (
            <View style={{ marginBottom: sectionGap }}>
              <Pressable
                onPress={() => router.push("/(app)/notes")}
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
                <ChevronRight color={colors.mutedForeground} size={20} />
              </Pressable>
              <View style={{ width: cardWidth, alignSelf: "center" }}>
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
                      onDelete={() => { }}
                      onRightClickDelete={undefined}
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
              </View>
            </View>
          )}

          {/* Files section — only if there are root files */}
          {rootFiles.length > 0 && (
            <View style={{ marginBottom: sectionGap }}>
              <Pressable
                onPress={() => router.push("/(app)/files")}
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
                <ChevronRight color={colors.mutedForeground} size={20} />
              </Pressable>
              <View style={{ width: cardWidth, alignSelf: "center" }}>
                {rootFiles.slice(0, 5).map((file, i) => (
                  <View
                    key={file.id}
                    style={{ marginBottom: i < Math.min(5, rootFiles.length) - 1 ? cardGap : 0 }}
                  >
                    <FileListCard
                      file={file}
                      onPress={() => handleFilePress(file)}
                      onDelete={() => { }}
                      onRightClickAction={undefined}
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
              </View>
            </View>
          )}

          {/* Events — only if there are any */}
          {hasAnyEvents && (
            <View style={{ marginBottom: sectionGap }}>
              <Pressable
                onPress={() => router.push("/(app)/calendar")}
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
                <ChevronRight color={colors.mutedForeground} size={20} />
              </Pressable>
              <View style={{ width: cardWidth, alignSelf: "center" }}>
                {[...todaysEvents, ...tomorrowsEvents].map((event) => (
                  <EventCard
                    key={`${event.id}-${event.instanceDate ?? ""}-${event.event_date}`}
                    event={event}
                    onSelectDate={() => router.push("/(app)/calendar")}
                    onEdit={() => router.push("/(app)/calendar")}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Empty state when nothing to show */}
          {rootNotes.length === 0 &&
            rootFiles.length === 0 &&
            !hasAnyEvents && (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <Text
                  style={{
                    fontSize: 15,
                    color: colors.mutedForeground,
                    textAlign: "center",
                  }}
                >
                  Notes and files not in any folder will appear here. Today's events show in the calendar.
                </Text>
              </View>
            )}
        </ScrollView>
      )}

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

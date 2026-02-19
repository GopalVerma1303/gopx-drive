"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { getFileDownloadUrl, listFilesByFolder } from "@/lib/files";
import { getFolderById } from "@/lib/folders";
import {
  getUnsyncedNoteIds,
  listNotesByFolder,
  syncNotesFromSupabase,
} from "@/lib/notes";
import { invalidateNotesQueries, invalidateFilesQueries } from "@/lib/query-utils";
import type { File as FileRecord, Note } from "@/lib/supabase";
import { DEFAULT_FOLDER_ID } from "@/lib/supabase";
import { THEME } from "@/lib/theme";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Check, CheckCheck, FileText, Files, Folder, Search } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function FolderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const folderId = id === "default" ? DEFAULT_FOLDER_ID : id;
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

  useEffect(() => {
    if (!user?.id) return;
    syncNotesFromSupabase(user.id)?.then(() => {
      invalidateNotesQueries(queryClient, user.id);
    }).catch(() => {});
  }, [user?.id, queryClient]);

  const { data: folder } = useQuery({
    queryKey: ["folder", id],
    queryFn: () => getFolderById(id!),
    enabled: !!id && id !== "default",
  });

  const folderName = id === "default" ? "Default" : (folder?.name ?? "Folder");

  const {
    data: notes = [],
    isLoading: notesLoading,
    refetch: refetchNotes,
    isFetching: notesFetching,
  } = useQuery({
    queryKey: ["notesByFolder", user?.id, folderId],
    queryFn: () => listNotesByFolder(user?.id, folderId),
    enabled: !!user?.id,
  });

  const { data: unsyncedNoteIds = [] } = useQuery({
    queryKey: ["notes-unsynced-ids", user?.id],
    queryFn: () => getUnsyncedNoteIds(user?.id),
    enabled: !!user?.id && activeTab === "notes",
  });

  const {
    data: files = [],
    isLoading: filesLoading,
    refetch: refetchFiles,
    isFetching: filesFetching,
  } = useQuery({
    queryKey: ["filesByFolder", user?.id, folderId],
    queryFn: () => listFilesByFolder(user?.id, folderId),
    enabled: !!user?.id,
  });

  const filteredNotes = notes.filter((n) =>
    (n.title ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onRefresh = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([refetchNotes(), refetchFiles()]);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const handleFilePress = async (file: FileRecord) => {
    try {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const url = await getFileDownloadUrl(file.file_path);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.open(url, "_blank");
      } else {
        await Linking.openURL(url);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to open file");
    }
  };

  const maxWidth = 672;
  const containerPadding = 16;
  const gap = 16;
  const availableWidth = Math.min(screenWidth, maxWidth) - containerPadding * 2;
  const cardWidth = availableWidth;

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
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
            height: 56,
            paddingHorizontal: 16,
            gap: 8,
          }}
        >
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={{ padding: 8 }}
          >
            <ArrowLeft color={colors.foreground} size={24} />
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <Folder color={colors.mutedForeground} size={20} style={{ marginRight: 8 }} />
            <Text
              style={{ fontSize: 18, fontWeight: "600", color: colors.foreground }}
              numberOfLines={1}
            >
              {folderName}
            </Text>
          </View>
        </View>
      </View>
      <View className="w-full flex-1">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "notes" | "files")}
          className="flex-1"
        >
          <View className="w-full max-w-2xl mx-auto">
            <View className="flex-row items-center mx-4 my-3 gap-2">
              <View className="flex-row items-center flex-1 min-w-0 px-4 rounded-2xl h-14 border border-border bg-muted">
                <Search
                  color={THEME.light.mutedForeground}
                  size={20}
                  style={{ marginRight: 8 }}
                />
                <Input
                  className="flex-1 h-full border-0 bg-transparent px-2 shadow-none"
                  placeholder={`Search ${activeTab}...`}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="muted-foreground"
                />
              </View>
              <Pressable
                onPress={() => {
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab(activeTab === "notes" ? "files" : "notes");
                }}
                className="p-2 rounded-2xl bg-muted items-center justify-center border border-border h-14 w-14"
              >
                {activeTab === "notes" ? (
                  <Files color={colors.mutedForeground} size={20} strokeWidth={2} />
                ) : (
                  <FileText color={colors.mutedForeground} size={20} strokeWidth={2} />
                )}
              </Pressable>
            </View>
          </View>

          <TabsContent value="notes" className="flex-1" style={{ flex: 1 }}>
            {notesLoading ? (
              <View className="flex-1 justify-center items-center" style={{ flex: 1 }}>
                <ActivityIndicator size="large" color={colors.foreground} />
              </View>
            ) : (
              <ScrollView
                className="flex-1"
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
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
                  <View className="w-full max-w-2xl mx-auto items-center pt-24">
                    <FileText
                      color={colors.mutedForeground}
                      size={48}
                      strokeWidth={1.5}
                      style={{ marginBottom: 16 }}
                    />
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "600",
                        color: colors.mutedForeground,
                        marginBottom: 8,
                      }}
                    >
                      {searchQuery.trim() ? "No matching notes" : "No notes in this folder"}
                    </Text>
                    <Text
                      style={{ fontSize: 14, color: colors.mutedForeground, textAlign: "center" }}
                    >
                      {searchQuery.trim()
                        ? "Try a different search"
                        : "Move notes here from Notes or assign a folder when editing."}
                    </Text>
                  </View>
                ) : (
                  <View style={{ width: cardWidth, alignSelf: "center" }}>
                    {filteredNotes.map((note, i) => (
                      <View
                        key={note.id}
                        style={{ marginBottom: i < filteredNotes.length - 1 ? gap : 0 }}
                      >
                        <FolderNoteCard
                          note={note}
                          cardWidth={cardWidth}
                          isSynced={!unsyncedNoteIds.includes(note.id)}
                          onPress={() => router.push(`/(app)/note/${note.id}`)}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}
          </TabsContent>

          <TabsContent value="files" className="flex-1" style={{ flex: 1 }}>
            {filesLoading ? (
              <View className="flex-1 justify-center items-center" style={{ flex: 1 }}>
                <ActivityIndicator size="large" color={colors.foreground} />
              </View>
            ) : (
              <ScrollView
                className="flex-1"
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
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
                  <View className="w-full max-w-2xl mx-auto items-center pt-24">
                    <Files
                      color={colors.mutedForeground}
                      size={48}
                      strokeWidth={1.5}
                      style={{ marginBottom: 16 }}
                    />
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "600",
                        color: colors.mutedForeground,
                        marginBottom: 8,
                      }}
                    >
                      {searchQuery.trim() ? "No matching files" : "No files in this folder"}
                    </Text>
                    <Text
                      style={{ fontSize: 14, color: colors.mutedForeground, textAlign: "center" }}
                    >
                      {searchQuery.trim()
                        ? "Try a different search"
                        : "Upload files and choose this folder, or move files from Files."}
                    </Text>
                  </View>
                ) : (
                  <View style={{ width: cardWidth, alignSelf: "center" }}>
                    {filteredFiles.map((file, i) => (
                      <View
                        key={file.id}
                        style={{ marginBottom: i < filteredFiles.length - 1 ? 12 : 0 }}
                      >
                        <FolderFileCard
                          file={file}
                          cardWidth={cardWidth}
                          formatFileSize={formatFileSize}
                          onPress={() => handleFilePress(file)}
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
    </View>
  );
}

function formatDate(dateString: string) {
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
}

interface FolderNoteCardProps {
  note: Note;
  cardWidth: number;
  isSynced: boolean;
  onPress: () => void;
}

function FolderNoteCard({ note, cardWidth, isSynced, onPress }: FolderNoteCardProps) {
  const { colors } = useThemeColors();
  const scale = new Animated.Value(1);
  const padding = 16;
  const contentLength = note.content?.length || 0;
  const lines = Math.ceil(contentLength / 50);
  const contentHeight = Math.min(Math.max(40, lines * 18), 120);
  const a4MaxHeight = cardWidth * 1.414;
  const cardHeight = Math.min(
    24 + contentHeight + 14 + padding * 2 + 8,
    a4MaxHeight
  );

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() =>
        Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 3 }).start()
      }
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Card
          className="rounded-2xl bg-muted border border-border"
          style={{ width: cardWidth, minHeight: cardHeight, maxHeight: a4MaxHeight, padding }}
        >
          <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
            {note.title || "Untitled"}
          </Text>
          <Text
            className="text-sm text-muted-foreground leading-4"
            numberOfLines={contentLength > 200 ? 8 : 6}
          >
            {note.content || "No content"}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-end",
              marginTop: 8,
              gap: 4,
            }}
          >
            <Text className="text-xs text-muted-foreground/70">
              {formatDate(note.updated_at)}
            </Text>
            {isSynced ? (
              <CheckCheck size={14} color={colors.mutedForeground + "90"} strokeWidth={2.5} />
            ) : (
              <Check size={14} color={colors.mutedForeground + "90"} strokeWidth={2.5} />
            )}
          </View>
        </Card>
      </Animated.View>
    </Pressable>
  );
}

interface FolderFileCardProps {
  file: FileRecord;
  cardWidth: number;
  formatFileSize: (bytes: number) => string;
  onPress: () => void;
}

function FolderFileCard({
  file,
  cardWidth,
  formatFileSize,
  onPress,
}: FolderFileCardProps) {
  const { colors } = useThemeColors();
  const scale = new Animated.Value(1);
  const cardHeight = 80;
  const iconSize = 56;
  const foldSize = Math.max(12, iconSize * 0.2);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() =>
        Animated.spring(scale, { toValue: 0.98, useNativeDriver: true }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 3 }).start()
      }
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View
          className="flex-row items-center p-3 gap-3 bg-muted border border-border rounded-xl"
          style={{ width: cardWidth, height: cardHeight }}
        >
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
                transform: [{ rotate: "90deg" }],
              }}
            />
            <View style={{ padding: 6, paddingRight: foldSize + 2, flex: 1, justifyContent: "space-between" }}>
              <Text className="text-[8px] font-semibold text-foreground" numberOfLines={1}>
                {file.extension.toUpperCase().slice(0, 3)}
              </Text>
              <Text className="text-[6px] text-muted-foreground opacity-70">
                {formatFileSize(file.file_size).split(" ")[0]}
              </Text>
            </View>
          </View>
          <View className="flex-1 justify-center gap-1">
            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
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

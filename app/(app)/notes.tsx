"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import {
  archiveNote,
  getNotesSyncStatus,
  getUnsyncedNoteIds,
  listNotes,
  syncNotesFromSupabase,
  updateNote,
} from "@/lib/notes";
import { listFolders } from "@/lib/folders";
import { DEFAULT_FOLDER_ID } from "@/lib/supabase";
import { invalidateNotesQueries } from "@/lib/query-utils";
import type { Note } from "@/lib/supabase";
import { THEME } from "@/lib/theme";
import { useThemeColors } from "@/lib/use-theme-colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { Check, CheckCheck, Folder, LayoutGrid, Plus, Rows2, Search, Archive } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const NOTES_VIEW_MODE_STORAGE_KEY = "@notes_view_mode";

export default function NotesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
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

  // Sync notes from Supabase in background (non-blocking) when screen mounts
  useEffect(() => {
    if (!user?.id) return;
    // Sync in background without blocking UI
    syncNotesFromSupabase(user.id)?.then(() => {
      invalidateNotesQueries(queryClient, user.id);
    }).catch(() => {
      // Sync failed, but UI already shows cached data
    });
  }, [user?.id, queryClient]);

  // Load saved view mode preference on mount
  useEffect(() => {
    const loadViewMode = async () => {
      try {
        const savedViewMode = await AsyncStorage.getItem(NOTES_VIEW_MODE_STORAGE_KEY);
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
          await AsyncStorage.setItem(NOTES_VIEW_MODE_STORAGE_KEY, viewMode);
        } catch (error) {
          console.error("Failed to save view mode:", error);
        }
      };
      saveViewMode();
    }
  }, [viewMode, isViewModeLoaded]);

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

  const { data: foldersList = [] } = useQuery({
    queryKey: ["folders", user?.id],
    queryFn: () => listFolders(user?.id),
    enabled: !!user?.id,
  });

  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const [noteToAction, setNoteToAction] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveNote(id),
    onSuccess: () => {
      invalidateNotesQueries(queryClient, user?.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDropdownOpen(null);
      setNoteToAction(null);
    },
  });

  const moveNoteMutation = useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId: string | null }) =>
      updateNote(id, { folder_id: folderId }),
    onSuccess: () => {
      invalidateNotesQueries(queryClient, user?.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDropdownOpen(null);
      setNoteToAction(null);
    },
  });

  const handleRightClickAction = (id: string, title: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setNoteToAction({ id, title });
    setDropdownOpen(id);
  };

  const handleMoveToFolder = (folderId: string | null) => {
    if (noteToAction) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      moveNoteMutation.mutate({ id: noteToAction.id, folderId });
    }
  };

  const handleArchive = () => {
    if (noteToAction) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      archiveMutation.mutate(noteToAction.id);
    }
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
            paddingHorizontal: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
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
              gap: 8,
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
              style={{ padding: 8 }}
            >
              {viewMode === "grid" ? (
                <Rows2 color={colors.foreground} size={22} strokeWidth={2.5} />
              ) : (
                <LayoutGrid color={colors.foreground} size={22} strokeWidth={2.5} />
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/(app)/note/new");
              }}
              style={{ padding: 8 }}
            >
              <Plus color={colors.foreground} size={22} strokeWidth={2.5} />
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
              <View className="w-full max-w-2xl mx-auto flex-1 justify-center items-center pt-24">
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
              <View className="w-full max-w-2xl mx-auto">
                {(() => {
                  // Calculate card width
                  const maxWidth = 672; // max-w-2xl
                  const containerPadding = 16; // p-4 = 16px
                  const gap = 16; // gap between cards and columns
                  const availableWidth = Math.min(screenWidth, maxWidth) - containerPadding * 2;
                  // Calculate card width accounting for gap between columns
                  const cardWidth = (availableWidth - gap * (columns - 1)) / columns;

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
                    const estimatedHeight = Math.min(calculatedHeight, a4MaxHeight) + gap;
                    columnHeights[shortestColumnIndex] += estimatedHeight;
                  });

                  // Calculate total width needed for columns
                  const totalWidth = cardWidth * columns + gap * (columns - 1);

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
                            marginRight: columnIndex < columns - 1 ? gap : 0,
                          }}
                        >
                          {columnNotes.map((note, noteIndex) => (
                            <View
                              key={note.id}
                              style={{
                                marginBottom: noteIndex < columnNotes.length - 1 ? gap : 0,
                              }}
                            >
                              <NoteCard
                                note={note}
                                cardWidth={cardWidth}
                                isSynced={!unsyncedNoteIds.includes(note.id)}
                                onPress={() => router.push(`/(app)/note/${note.id}`)}
                                onDelete={() => handleRightClickAction(note.id, note.title)}
                                onRightClickDelete={
                                  Platform.OS === "web"
                                    ? () => handleRightClickAction(note.id, note.title)
                                    : undefined
                                }
                            dropdownOpen={dropdownOpen === note.id}
                            onDropdownOpenChange={(open) => {
                              if (open) {
                                handleRightClickAction(note.id, note.title);
                              } else {
                                setDropdownOpen(null);
                                setNoteToAction(null);
                              }
                            }}
                                foldersList={foldersList}
                                onMoveToFolder={handleMoveToFolder}
                                onArchive={handleArchive}
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
              <View className="w-full max-w-2xl mx-auto">
                {(() => {
                  // List view: full width cards
                  const maxWidth = 672; // max-w-2xl
                  const containerPadding = 16; // p-4 = 16px
                  const gap = 16; // gap between cards
                  const availableWidth = Math.min(screenWidth, maxWidth) - containerPadding * 2;
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
                            onDelete={() => handleRightClickAction(note.id, note.title)}
                            onRightClickDelete={
                              Platform.OS === "web"
                                ? () => handleRightClickAction(note.id, note.title)
                                : undefined
                            }
                            dropdownOpen={dropdownOpen === note.id}
                            onDropdownOpenChange={(open) => {
                              if (open) {
                                handleRightClickAction(note.id, note.title);
                              } else {
                                setDropdownOpen(null);
                                setNoteToAction(null);
                              }
                            }}
                            foldersList={foldersList}
                            onMoveToFolder={handleMoveToFolder}
                            onArchive={handleArchive}
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

    </View>
  );
}

interface NoteCardProps {
  note: Note;
  cardWidth: number;
  /** True when note is synced with Supabase (show double check); false = single check. */
  isSynced: boolean;
  onPress: () => void;
  onDelete: () => void;
  onRightClickDelete?: () => void;
  dropdownOpen: boolean;
  onDropdownOpenChange: (open: boolean) => void;
  foldersList: Array<{ id: string; name: string }>;
  onMoveToFolder: (folderId: string | null) => void;
  onArchive: () => void;
}

function NoteCard({
  note,
  cardWidth,
  isSynced,
  onPress,
  onDelete,
  onRightClickDelete,
  dropdownOpen,
  onDropdownOpenChange,
  foldersList,
  onMoveToFolder,
  onArchive,
}: NoteCardProps) {
  const { colors } = useThemeColors();
  const scale = new Animated.Value(1);

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

  const handleContextMenu = (e: any) => {
    if (Platform.OS === "web" && onRightClickDelete) {
      e.preventDefault();
      onRightClickDelete();
    }
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
    <DropdownMenu {...({ open: dropdownOpen, onOpenChange: onDropdownOpenChange } as any)}>
      <DropdownMenuTrigger asChild>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onLongPress={() => {
            onDelete();
            onDropdownOpenChange(true);
          }}
          {...(Platform.OS === "web" && {
            onContextMenu: (e: any) => {
              handleContextMenu(e);
              if (onRightClickDelete) {
                onDropdownOpenChange(true);
              }
            },
          })}
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <Card
              className="rounded-2xl bg-muted border border-border"
              style={{
                width: cardWidth,
                minHeight: cardHeight,
                maxHeight: a4MaxHeight,
                padding: padding,
              }}
            >
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
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  marginTop: 8,
                  gap: 4,
                }}
              >
                <Text
                  className="text-xs text-muted-foreground/70"
                >
                  {formatDate(note.updated_at)}
                </Text>
                {isSynced ? (
                  <CheckCheck
                    size={14}
                    color={colors.mutedForeground + "90"}
                    strokeWidth={2.5}
                  />
                ) : (
                  <Check
                    size={14}
                    color={colors.mutedForeground + "90"}
                    strokeWidth={2.5}
                  />
                )}
              </View>
            </Card>
          </Animated.View>
        </Pressable>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onPress={() => onMoveToFolder(null)}>
          <Folder size={16} color={colors.foreground} style={{ marginRight: 8 }} />
          <Text style={{ color: colors.foreground }}>Default</Text>
        </DropdownMenuItem>
        {foldersList.map((folder) => (
          <DropdownMenuItem key={folder.id} onPress={() => onMoveToFolder(folder.id)}>
            <Folder size={16} color={colors.foreground} style={{ marginRight: 8 }} />
            <Text style={{ color: colors.foreground }}>{folder.name}</Text>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onPress={onArchive}>
          <Archive size={16} color="#ef4444" style={{ marginRight: 8 }} />
          <Text style={{ color: "#ef4444" }}>Archive</Text>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

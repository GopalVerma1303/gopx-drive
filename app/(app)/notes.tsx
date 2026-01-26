"use client";

import { NoteTagModal } from "@/components/note-tag-modal";
import { TagModal } from "@/components/tag-modal";
import { TagRow } from "@/components/tag-row";
import { Card } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { deleteNote, listNotes } from "@/lib/notes";
import type { Note } from "@/lib/supabase";
import type { Tag } from "@/lib/supabase-tags";
import {
  addTagToNote,
  createTag,
  deleteTag,
  ensureDefaultTag,
  getNoteTags,
  listTags,
  removeTagFromNote,
  updateTag
} from "@/lib/supabase-tags";
import { THEME } from "@/lib/theme";
import { useThemeColors } from "@/lib/use-theme-colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { LayoutGrid, Plus, Rows2, Search, Tag as TagIcon, Trash2 } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  });

  // Tags state and queries
  const {
    data: tags = [],
    isLoading: tagsLoading,
    refetch: refetchTags,
  } = useQuery({
    queryKey: ["tags", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // Ensure default tag exists
      await ensureDefaultTag(user.id);
      return listTags(user.id);
    },
    enabled: !!user?.id,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Fetch note tags mapping
  const { data: noteTagsMap = {} } = useQuery({
    queryKey: ["noteTags", notes.map((n) => n.id).join(",")],
    queryFn: async () => {
      const map: Record<string, Tag[]> = {};
      await Promise.all(
        notes.map(async (note) => {
          try {
            const noteTags = await getNoteTags(note.id);
            map[note.id] = noteTags;
          } catch (error) {
            console.error(`Failed to fetch tags for note ${note.id}:`, error);
            map[note.id] = [];
          }
        })
      );
      return map;
    },
    enabled: notes.length > 0,
  });

  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  // Set default tag as selected when tags are loaded, or if no tag is selected
  useEffect(() => {
    if (tags.length > 0) {
      const defaultTag = tags.find((t) => t.name === "Default");
      if (defaultTag) {
        // Always ensure default tag is selected if no tag is currently selected
        if (selectedTagId === null) {
          setSelectedTagId(defaultTag.id);
        }
      }
    }
  }, [tags, selectedTagId]);

  // Wrapper to prevent deselecting tags - always fallback to default
  const handleTagSelection = (tagId: string | null) => {
    if (tagId === null) {
      // If trying to deselect, select default tag instead
      const defaultTag = tags.find((t) => t.name === "Default");
      if (defaultTag) {
        setSelectedTagId(defaultTag.id);
      }
    } else {
      setSelectedTagId(tagId);
    }
  };
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [noteTagModalOpen, setNoteTagModalOpen] = useState(false);
  const [noteToTag, setNoteToTag] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      await refetch();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDeleteDialogOpen(false);
      setNoteToDelete(null);
    },
  });

  // Tag mutations
  const createTagMutation = useMutation({
    mutationFn: (input: { user_id: string; name: string }) => createTag(input),
    onSuccess: async (newTag) => {
      // Optimistically update the cache with the new tag
      queryClient.setQueryData<Tag[]>(["tags", user?.id], (oldTags = []) => {
        // Check if tag already exists to avoid duplicates
        if (oldTags.some(tag => tag.id === newTag.id)) {
          return oldTags;
        }
        return [...oldTags, newTag].sort((a, b) => a.name.localeCompare(b.name));
      });
      // Then refetch to ensure we have the latest data
      await queryClient.refetchQueries({ queryKey: ["tags", user?.id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTagModalOpen(false);
      setEditingTag(null);
    },
    onError: (error: any) => {
      console.error("Create tag error:", error);
      Alert.alert("Error", error.message || "Failed to create tag");
    },
  });

  const updateTagMutation = useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Pick<Tag, "name">>;
    }) => updateTag(id, updates),
    onSuccess: async (updatedTag) => {
      // Optimistically update the cache with the updated tag
      if (updatedTag) {
        queryClient.setQueryData<Tag[]>(["tags", user?.id], (oldTags = []) => {
          return oldTags.map(tag => tag.id === updatedTag.id ? updatedTag : tag).sort((a, b) => a.name.localeCompare(b.name));
        });
      }
      // Then refetch to ensure we have the latest data
      await queryClient.refetchQueries({ queryKey: ["tags", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["noteTags"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTagModalOpen(false);
      setEditingTag(null);
    },
    onError: (error: any) => {
      console.error("Update tag error:", error);
      Alert.alert("Error", error.message || "Failed to update tag");
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onSuccess: async (_data, deletedTagId) => {
      // Optimistically remove the tag from cache
      queryClient.setQueryData<Tag[]>(["tags", user?.id], (oldTags = []) => {
        return oldTags.filter(tag => tag.id !== deletedTagId);
      });
      // Then refetch to ensure we have the latest data
      await queryClient.refetchQueries({ queryKey: ["tags", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["noteTags"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTagModalOpen(false);
      setEditingTag(null);
      // If deleted tag was selected, switch to default tag
      if (selectedTagId === deletedTagId) {
        const defaultTag = tags.find((t) => t.name === "Default");
        if (defaultTag) {
          setSelectedTagId(defaultTag.id);
        }
        // If no default tag found, useEffect will handle setting it when tags reload
      }
    },
    onError: (error: any) => {
      console.error("Delete tag error:", error);
      Alert.alert("Error", error.message || "Failed to delete tag");
    },
  });

  // Note tag mutations
  const addTagToNoteMutation = useMutation({
    mutationFn: ({ noteId, tagId }: { noteId: string; tagId: string }) =>
      addTagToNote(noteId, tagId),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["noteTags"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      console.error("Add tag to note error:", error);
      Alert.alert("Error", error.message || "Failed to add tag to note");
    },
  });

  const removeTagFromNoteMutation = useMutation({
    mutationFn: ({ noteId, tagId }: { noteId: string; tagId: string }) =>
      removeTagFromNote(noteId, tagId),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["noteTags"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      console.error("Remove tag from note error:", error);
      Alert.alert("Error", error.message || "Failed to remove tag from note");
    },
  });


  const handleDeleteNote = (id: string, title: string) => {
    Alert.alert("Delete Note", `Are you sure you want to delete "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteMutation.mutate(id),
      },
    ]);
  };

  const handleOpenTagModal = (id: string, title: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setNoteToTag({ id, title });
    setNoteTagModalOpen(true);
  };

  const handleOpenDeleteModal = (id: string, title: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setNoteToDelete({ id, title });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (noteToDelete) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      deleteMutation.mutate(noteToDelete.id);
    }
  };

  // Filter notes by search query and selected tag
  const filteredNotes = useMemo(() => {
    let filtered = notes.filter(
      (note) =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Always filter by tag - default to "Default" tag if none selected
    const defaultTag = tags.find((t) => t.name === "Default");
    const defaultTagId = defaultTag?.id;
    const activeTagId = selectedTagId || defaultTagId;

    if (activeTagId) {
      if (activeTagId === defaultTagId) {
        // Show notes with no tags or with default tag only
        filtered = filtered.filter((note) => {
          const noteTags = noteTagsMap[note.id] || [];
          return noteTags.length === 0 || (noteTags.length === 1 && noteTags[0].id === defaultTagId);
        });
      } else {
        // Show notes with the selected tag
        filtered = filtered.filter((note) => {
          const noteTags = noteTagsMap[note.id] || [];
          return noteTags.some((tag) => tag.id === activeTagId);
        });
      }
    }

    return filtered;
  }, [notes, searchQuery, selectedTagId, tags, noteTagsMap]);

  const onRefresh = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await Promise.all([refetch(), refetchTags()]);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  // Tag handlers
  const handleCreateTag = () => {
    setEditingTag(null);
    setTagModalOpen(true);
  };

  const handleTagLongPress = (tag: Tag) => {
    setEditingTag(tag);
    setTagModalOpen(true);
  };

  const handleSaveNoteTags = (selectedTagIds: Set<string>) => {
    if (!noteToTag) return;

    const currentTags = noteTagsMap[noteToTag.id] || [];
    const currentTagIds = new Set(currentTags.map((t) => t.id));

    // Add new tags
    selectedTagIds.forEach((tagId) => {
      if (!currentTagIds.has(tagId)) {
        addTagToNoteMutation.mutate({ noteId: noteToTag.id, tagId });
      }
    });

    // Remove tags that were deselected
    currentTagIds.forEach((tagId) => {
      if (!selectedTagIds.has(tagId)) {
        removeTagFromNoteMutation.mutate({ noteId: noteToTag.id, tagId });
      }
    });
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

        {/* Tags Row */}
        {!tagsLoading && tags.length > 0 && (
          <View className="w-full max-w-2xl mx-auto">
            <TagRow
              tags={tags}
              selectedTagId={selectedTagId}
              onTagPress={handleTagSelection}
              onTagLongPress={handleTagLongPress}
              onCreateTag={handleCreateTag}
            />
          </View>
        )}

        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="foreground" />
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
                                onPress={() => router.push(`/(app)/note/${note.id}`)}
                                onTagPress={() => handleOpenTagModal(note.id, note.title)}
                                onDeletePress={() => handleOpenDeleteModal(note.id, note.title)}
                                noteTags={noteTagsMap[note.id] || []}
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
                            onPress={() => router.push(`/(app)/note/${note.id}`)}
                            onTagPress={() => handleOpenTagModal(note.id, note.title)}
                            onDeletePress={() => handleOpenDeleteModal(note.id, note.title)}
                            noteTags={noteTagsMap[note.id] || []}
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

      {/* Tag Modal */}
      <TagModal
        open={tagModalOpen}
        onClose={() => {
          setTagModalOpen(false);
          setEditingTag(null);
        }}
        tag={editingTag}
        onCreate={createTagMutation.mutate}
        onUpdate={updateTagMutation.mutate}
        onDelete={deleteTagMutation.mutate}
        userId={user?.id || ""}
      />

      {/* Note Tag Modal */}
      {noteToTag && (
        <NoteTagModal
          open={noteTagModalOpen}
          onClose={() => {
            setNoteTagModalOpen(false);
            setNoteToTag(null);
          }}
          noteId={noteToTag.id}
          noteTitle={noteToTag.title}
          tags={tags}
          noteTags={noteTagsMap[noteToTag.id] || []}
          onSave={handleSaveNoteTags}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {Platform.OS === "web" ? (
        deleteDialogOpen && noteToDelete && (
          <View
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            style={{
              position: "fixed" as any,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 50,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(8px)",
            }}
          >
            <Pressable
              className="absolute inset-0"
              style={{ position: "absolute" as any }}
              onPress={() => {
                setDeleteDialogOpen(false);
                setNoteToDelete(null);
              }}
            />
            <View
              className="bg-background border-border w-full max-w-md rounded-lg border p-6 shadow-lg"
              style={{
                backgroundColor: colors.muted,
                borderColor: colors.border,
                borderRadius: 8,
                padding: 24,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
              }}
            >
              <Text
                className="text-lg font-semibold mb-2"
                style={{
                  color: colors.foreground,
                  fontSize: 18,
                  fontWeight: "600",
                  marginBottom: 8,
                }}
              >
                Delete Note
              </Text>
              <Text
                className="text-sm mb-6"
                style={{
                  color: colors.mutedForeground,
                  fontSize: 14,
                  marginBottom: 24,
                }}
              >
                Are you sure you want to delete "{noteToDelete?.title}"? This
                action cannot be undone.
              </Text>
              <View
                className="flex-row justify-end gap-3"
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <Pressable
                  className="px-4 py-2"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                  }}
                  onPress={() => {
                    setDeleteDialogOpen(false);
                    setNoteToDelete(null);
                  }}
                >
                  <Text style={{ color: colors.foreground }}>Cancel</Text>
                </Pressable>
                <Pressable
                  className="px-4 py-2 rounded-md"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 6,
                  }}
                  onPress={handleDeleteConfirm}
                >
                  <Text style={{ color: "#ef4444", fontWeight: "600" }}>
                    Delete
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
          onRequestClose={() => {
            setDeleteDialogOpen(false);
            setNoteToDelete(null);
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
            }}
          >
            <BlurView
              intensity={20}
              tint="dark"
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                padding: 16,
              }}
            >
              <Pressable
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
                onPress={() => {
                  setDeleteDialogOpen(false);
                  setNoteToDelete(null);
                }}
                pointerEvents="box-none"
              />
              <ScrollView
                contentContainerStyle={{
                  flexGrow: 1,
                  justifyContent: "center",
                  alignItems: "center",
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                pointerEvents="box-none"
              >
                <Pressable
                  onPress={(e) => e.stopPropagation()}
                  style={{
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                    borderRadius: 8,
                    borderWidth: 1,
                    padding: 24,
                    width: "100%",
                    maxWidth: 400,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                    elevation: 5,
                  }}
                >
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 18,
                      fontWeight: "600",
                      marginBottom: 8,
                    }}
                  >
                    Delete Note
                  </Text>
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontSize: 14,
                      marginBottom: 24,
                    }}
                  >
                    Are you sure you want to delete "{noteToDelete?.title}"? This
                    action cannot be undone.
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "flex-end",
                      gap: 12,
                    }}
                  >
                    <Pressable
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                      }}
                      onPress={() => {
                        setDeleteDialogOpen(false);
                        setNoteToDelete(null);
                      }}
                    >
                      <Text style={{ color: colors.foreground }}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 6,
                      }}
                      onPress={handleDeleteConfirm}
                    >
                      <Text style={{ color: "#ef4444", fontWeight: "600" }}>
                        Delete
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              </ScrollView>
            </BlurView>
          </View>
        </Modal>
      )}
    </View>
  );
}

interface NoteCardProps {
  note: Note;
  cardWidth: number;
  onPress: () => void;
  onTagPress: () => void;
  onDeletePress: () => void;
  noteTags?: Tag[];
}

function NoteCard({
  note,
  cardWidth,
  onPress,
  onTagPress,
  onDeletePress,
  noteTags = [],
}: NoteCardProps) {
  const { colors } = useThemeColors();
  const scale = new Animated.Value(1);
  const hasLongPressed = useRef(false);

  const handlePressIn = () => {
    hasLongPressed.current = false;
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    // Only trigger onPress if it wasn't a long press
    if (!hasLongPressed.current) {
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 3,
      }).start();
    } else {
      // Reset scale after long press
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 3,
      }).start();
    }
  };

  const handleLongPress = () => {
    hasLongPressed.current = true;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    // Trigger context menu programmatically if possible
    // The ContextMenuTrigger should handle this automatically, but we ensure it works
  };

  const handlePress = () => {
    // Only trigger onPress if it wasn't a long press
    if (!hasLongPressed.current) {
      onPress();
    }
    hasLongPressed.current = false;
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
    return date.toLocaleDateString();
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
    <ContextMenu>
      <ContextMenuTrigger>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onLongPress={handleLongPress}
          delayLongPress={500}
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
              {/* Footer with last edit */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-start",
                  alignItems: "center",
                  marginTop: 8,
                }}
              >
                <Text
                  className="text-xs text-muted-foreground/70"
                >
                  {formatDate(note.updated_at)}
                </Text>
              </View>
            </Card>
          </Animated.View>
        </Pressable>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onPress={onTagPress}>
          <TagIcon size={16} color={colors.foreground} />
          <Text style={{ color: colors.foreground, marginLeft: 8 }}>Tags</Text>
        </ContextMenuItem>
        <ContextMenuItem onPress={onDeletePress} variant="destructive">
          <Trash2 size={16} color="#ef4444" />
          <Text style={{ color: "#ef4444", marginLeft: 8 }}>Delete</Text>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

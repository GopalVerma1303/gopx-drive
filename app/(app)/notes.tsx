"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { stripMarkdown } from "@/lib/markdown-utils";
import { deleteNote, listNotes } from "@/lib/notes";
import type { Note } from "@/lib/supabase";
import { THEME } from "@/lib/theme";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { Plus, Search } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function NotesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");

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

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<{
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

  const handleRightClickDelete = (id: string, title: string) => {
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

  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
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
            ) : (
              filteredNotes.map((note) => (
                <View key={note.id} className="w-full max-w-2xl mx-auto">
                  <NoteCard
                    note={note}
                    onPress={() => router.push(`/(app)/note/${note.id}`)}
                    onDelete={() => handleRightClickDelete(note.id, note.title)}
                    onRightClickDelete={
                      Platform.OS === "web"
                        ? () => handleRightClickDelete(note.id, note.title)
                        : undefined
                    }
                  />
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>

      {/* Simple Delete Confirmation Dialog */}
      {Platform.OS === "web" ? (
        deleteDialogOpen && (
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
              onPress={() => setDeleteDialogOpen(false)}
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
                  onPress={() => setDeleteDialogOpen(false)}
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
          onRequestClose={() => setDeleteDialogOpen(false)}
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
                onPress={() => setDeleteDialogOpen(false)}
              />
            <View
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
                  onPress={() => setDeleteDialogOpen(false)}
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
            </View>
          </BlurView>
          </View>
        </Modal>
      )}
    </View>
  );
}

interface NoteCardProps {
  note: Note;
  onPress: () => void;
  onDelete: () => void;
  onRightClickDelete?: () => void;
}

function NoteCard({
  note,
  onPress,
  onDelete,
  onRightClickDelete,
}: NoteCardProps) {
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
    return date.toLocaleDateString();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLongPress={onDelete}
      {...(Platform.OS === "web" && {
        onContextMenu: handleContextMenu,
      })}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Card className="p-4 mb-3 rounded-2xl bg-muted border border-border">
          <Text
            className="text-xl font-semibold text-foreground"
            numberOfLines={1}
          >
            {note.title || "Untitled"}
          </Text>
          <Text
            className="text-sm text-muted-foreground leading-5"
            numberOfLines={2}
          >
            {note.content ? stripMarkdown(note.content) : "No content"}
          </Text>
          <Text className="text-xs text-muted-foreground/70">
            {formatDate(note.updated_at)}
          </Text>
        </Card>
      </Animated.View>
    </Pressable>
  );
}

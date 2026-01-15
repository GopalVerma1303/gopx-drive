"use client";

import { NotesHeader } from "@/components/headers/notes-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { stripMarkdown } from "@/lib/markdown-utils";
import { deleteNote, listNotes } from "@/lib/notes";
import type { Note } from "@/lib/supabase";
import { useThemeColors } from "@/lib/use-theme-colors";
import { getRadius, getSpacing } from "@/lib/theme/styles";
import { composeStyle } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { Search } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";

export default function NotesScreen() {
  const { signOut, user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useThemeColors();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["notes", user?.id],
    queryFn: () => listNotes(user?.id),
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDeleteDialogOpen(false);
      setNoteToDelete(null);
    },
  });

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

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
    setNoteToDelete({ id, title });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (noteToDelete) {
      deleteMutation.mutate(noteToDelete.id);
    }
  };

  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View
      style={composeStyle(
        { flex: 1, width: "100%", alignSelf: "center" },
        { backgroundColor: colors.background }
      )}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <NotesHeader onSignOut={handleSignOut} />
      <View
        style={{
          width: "100%",
          height: "100%",
          maxWidth: 672, // max-w-2xl
          alignSelf: "center",
        }}
      >
        {/* Search Container */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginHorizontal: getSpacing(4),
            marginVertical: getSpacing(3),
            paddingHorizontal: getSpacing(4),
            borderRadius: getRadius("2xl"),
            height: 56,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.muted,
          }}
        >
          <Search color={colors.mutedForeground} size={20} />
          <Input
            style={{
              flex: 1,
              height: "100%",
              borderWidth: 0,
              backgroundColor: "transparent",
              paddingHorizontal: getSpacing(2),
            }}
            placeholder="Search notes..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        {isLoading ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <ActivityIndicator size="large" color={colors.foreground} />
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: getSpacing(4) }}
          >
            {filteredNotes.length === 0 ? (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                  paddingTop: getSpacing(24),
                }}
              >
                <Text
                  variant="large"
                  style={{
                    color: colors.mutedForeground,
                    marginBottom: getSpacing(2),
                  }}
                >
                  {searchQuery ? "No notes found" : "No notes yet"}
                </Text>
                <Text
                  variant="small"
                  style={{
                    color: colors.mutedForeground,
                    textAlign: "center",
                  }}
                >
                  {searchQuery
                    ? "Try a different search"
                    : "Tap the + button to create your first note"}
                </Text>
              </View>
            ) : (
              filteredNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onPress={() => router.push(`/(app)/note/${note.id}`)}
                  onDelete={() => handleDeleteNote(note.id, note.title)}
                  onRightClickDelete={
                    Platform.OS === "web"
                      ? () => handleRightClickDelete(note.id, note.title)
                      : undefined
                  }
                />
              ))
            )}
          </ScrollView>
        )}
      </View>

      {/* Simple Delete Confirmation Dialog */}
      {Platform.OS === "web" && deleteDialogOpen && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            padding: getSpacing(4),
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
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              width: "100%",
              maxWidth: 448, // max-w-md
              borderRadius: getRadius("lg"),
              padding: getSpacing(6),
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 5,
            }}
          >
            <Text
              variant="large"
              style={{
                color: colors.foreground,
                marginBottom: getSpacing(2),
              }}
            >
              Delete Note
            </Text>
            <Text
              variant="small"
              style={{
                color: colors.mutedForeground,
                marginBottom: getSpacing(6),
              }}
            >
              Are you sure you want to delete "{noteToDelete?.title}"? This
              action cannot be undone.
            </Text>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: getSpacing(3),
              }}
            >
              <Pressable
                style={{
                  paddingHorizontal: getSpacing(4),
                  paddingVertical: getSpacing(2),
                  borderRadius: getRadius("md"),
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                }}
                onPress={() => setDeleteDialogOpen(false)}
              >
                <Text style={{ color: colors.foreground }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={{
                  paddingHorizontal: getSpacing(4),
                  paddingVertical: getSpacing(2),
                  borderRadius: getRadius("md"),
                  backgroundColor: colors.destructive,
                }}
                onPress={handleDeleteConfirm}
              >
                <Text style={{ color: "#ffffff", fontWeight: "600" }}>
                  Delete
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
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
        <Card
          style={{
            padding: getSpacing(4),
            marginBottom: getSpacing(3),
            borderRadius: getRadius("2xl"),
            backgroundColor: colors.muted,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            variant="h4"
            style={{
              color: colors.foreground,
              marginBottom: getSpacing(2),
            }}
            numberOfLines={1}
          >
            {note.title || "Untitled"}
          </Text>
          <Text
            variant="small"
            style={{
              color: colors.mutedForeground,
              lineHeight: 20,
              marginBottom: getSpacing(2),
            }}
            numberOfLines={2}
          >
            {note.content ? stripMarkdown(note.content) : "No content"}
          </Text>
          <Text
            variant="small"
            style={{
              fontSize: 12,
              color: colors.mutedForeground + "B3", // 70% opacity
            }}
          >
            {formatDate(note.updated_at)}
          </Text>
        </Card>
      </Animated.View>
    </Pressable>
  );
}

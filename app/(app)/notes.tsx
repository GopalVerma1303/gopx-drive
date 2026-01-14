"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { stripMarkdown } from "@/lib/markdown-utils";
import { deleteNote, listNotes } from "@/lib/notes";
import type { Note } from "@/lib/supabase";
import { THEME } from "@/lib/theme";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { LogOut, Moon, Plus, Search, Sun } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  View,
} from "react-native";

export default function NotesScreen() {
  const { signOut, user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useThemeColors();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["notes", user?.id],
    queryFn: () => listNotes(user?.id),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View
      className="flex-1 w-full max-w-2xl mx-auto"
      style={{ backgroundColor: colors.background }}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Gopx Drive",
          headerStyle: {
            backgroundColor: colors.background,
            borderBottomWidth: 0,
            borderBottomColor: colors.border,
          } as any,
          headerTintColor: colors.foreground,
          headerTitleStyle: {
            color: colors.foreground,
          },
          headerRight: () => (
            <View className="flex-row items-center gap-2 web:mr-4">
              <Pressable
                className="p-2"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push("/(app)/note/new");
                }}
              >
                <Plus color={colors.foreground} size={22} strokeWidth={2.5} />
              </Pressable>
              <Pressable
                className="p-2"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  toggleTheme();
                }}
              >
                {resolvedTheme === "dark" ? (
                  <Sun color={colors.foreground} size={22} strokeWidth={2.5} />
                ) : (
                  <Moon color={colors.foreground} size={22} strokeWidth={2.5} />
                )}
              </Pressable>
              <Pressable
                className="pl-2"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleSignOut();
                }}
              >
                <LogOut color={colors.foreground} size={22} strokeWidth={2.5} />
              </Pressable>
            </View>
          ),
        }}
      />

      {/* Search Container */}
      <View className="flex-row items-center mx-4 my-3 px-4 rounded-xl h-14 border border-border bg-muted">
        <Search
          className="text-muted-foreground mr-2"
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

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="foreground" />
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="p-4">
          {filteredNotes.length === 0 ? (
            <View className="flex-1 justify-center items-center pt-24">
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
              <NoteCard
                key={note.id}
                note={note}
                onPress={() => router.push(`/(app)/note/${note.id}`)}
                onDelete={() => handleDeleteNote(note.id, note.title)}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

interface NoteCardProps {
  note: Note;
  onPress: () => void;
  onDelete: () => void;
}

function NoteCard({ note, onPress, onDelete }: NoteCardProps) {
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
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Card className="p-4 mb-3 rounded-2xl bg-foreground/5 border-2 border-foreground/10">
          <Text
            className="text-xl font-semibold text-foreground mb-2"
            numberOfLines={1}
          >
            {note.title || "Untitled"}
          </Text>
          <Text
            className="text-sm text-muted-foreground leading-5 mb-2"
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

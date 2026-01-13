"use client";

import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { createNote, getNoteById, updateNote } from "@/lib/notes";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Check } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

export default function NoteEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const isNewNote = id === "new";

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const { data: note, isLoading } = useQuery({
    queryKey: ["note", id],
    queryFn: async () => {
      const existingNote = await getNoteById(id);
      if (!existingNote) {
        throw new Error("Note not found");
      }
      return existingNote;
    },
    enabled: !isNewNote && !!id,
  });

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
    }
  }, [note]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const userId = user?.id ?? "demo-user";

      if (isNewNote) {
        await createNote({
          user_id: userId,
          title: title || "Untitled",
          content,
        });
      } else {
        const updated = await updateNote(id, {
          title: title || "Untitled",
          content,
        });
        if (!updated) {
          throw new Error("Note not found");
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["note", id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message);
    },
  });

  const handleSave = () => {
    if (!title.trim() && !content.trim()) {
      Alert.alert("Empty Note", "Please add a title or content");
      return;
    }
    saveMutation.mutate();
  };

  if (isLoading && !isNewNote) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: colors.background }}
      >
        <ActivityIndicator size="large" color={colors.foreground} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={colors.foreground === "#000000" ? "dark" : "light"} />
      <Stack.Screen
        options={{
          headerShown: true,
          title: isNewNote ? "New Note" : "Edit Note",
          headerStyle: {
            backgroundColor: colors.background,
            borderBottomWidth: 0,
            borderBottomColor: colors.border,
            elevation: 0,
          } as any,
          headerTintColor: colors.foreground,
          headerTitleStyle: {
            color: colors.foreground,
          },
          headerRight: () => (
            <Pressable
              onPress={handleSave}
              disabled={saveMutation.isPending}
              className="p-2"
            >
              <Check color={colors.foreground} size={24} />
            </Pressable>
          ),
        }}
      />
      <SafeAreaView
        edges={Platform.OS === "android" ? ["bottom"] : ["top", "bottom"]}
        className="flex-1"
        style={{ backgroundColor: colors.background }}
      >
        <KeyboardAvoidingView
          className="flex-1"
          style={{ backgroundColor: colors.background }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "android" ? 0 : 0}
        >
          <View className="flex-1 p-5 pb-0 w-full max-w-2xl mx-auto bg-background">
            <Input
              className="mb-4 h-16 border-0 shadow-none bg-transparent text-3xl font-bold text-foreground"
              placeholder="Title"
              placeholderTextColor="muted-foreground"
              value={title}
              onChangeText={setTitle}
              autoFocus={isNewNote}
            />
            {/* <View className="mb-4 h-px bg-border" /> */}
            <Input
              className="flex-1 border-0 shadow-none bg-transparent text-base leading-6 text-foreground"
              placeholder="Start writing..."
              placeholderTextColor="foreground"
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

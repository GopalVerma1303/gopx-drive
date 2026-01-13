"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { createNote, getNoteById, updateNote } from "@/lib/notes";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  View,
} from "react-native";

export default function NoteEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
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
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="foreground" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: isNewNote ? "New Note" : "Edit Note",
          headerStyle: {
            backgroundColor: "foreground",
          },
          headerTintColor: "background",
          headerRight: () => (
            <Button
              variant="default"
              size="icon"
              onPress={handleSave}
              disabled={saveMutation.isPending}
              className="mr-2"
            >
              <Check color="background" size={24} />
            </Button>
          ),
        }}
      />

      <View className="flex-1 p-5">
        <Input
          className="mb-4 border-0 bg-transparent text-3xl font-bold text-foreground"
          placeholder="Title"
          placeholderTextColor="muted-foreground"
          value={title}
          onChangeText={setTitle}
          autoFocus={isNewNote}
        />
        <View className="mb-4 h-px bg-muted" />
        <Input
          className="flex-1 border-0 bg-transparent text-base leading-6 text-foreground"
          placeholder="Start writing..."
          placeholderTextColor="muted-foreground"
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

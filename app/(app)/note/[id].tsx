import { useAuth } from "@/contexts/auth-context";
import { Note, supabase } from "@/lib/supabase";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
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
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Note;
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
      if (!user?.id) throw new Error("Not authenticated");

      if (isNewNote) {
        const { error } = await supabase.from("notes").insert({
          user_id: user.id,
          title: title || "Untitled",
          content,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notes")
          .update({
            title: title || "Untitled",
            content,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
        if (error) throw error;
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: isNewNote ? "New Note" : "Edit Note",
          headerStyle: {
            backgroundColor: "#667eea",
          },
          headerTintColor: "#fff",
          headerRight: () => (
            <Pressable
              onPress={handleSave}
              disabled={saveMutation.isPending}
              style={styles.saveButton}
            >
              {saveMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Check color="#fff" size={24} />
              )}
            </Pressable>
          ),
        }}
      />

      <View style={styles.editorContainer}>
        <TextInput
          style={styles.titleInput}
          placeholder="Title"
          placeholderTextColor="#999"
          value={title}
          onChangeText={setTitle}
          autoFocus={isNewNote}
        />
        <View style={styles.divider} />
        <TextInput
          style={styles.contentInput}
          placeholder="Start writing..."
          placeholderTextColor="#999"
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  saveButton: {
    padding: 8,
    marginRight: 8,
  },
  editorContainer: {
    flex: 1,
    padding: 20,
  },
  titleInput: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: "#000",
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginBottom: 16,
  },
  contentInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    lineHeight: 24,
  },
});

"use client";

import { NoteDetailHeader } from "@/components/headers/note-detail-header";
import { MarkdownEditor, MarkdownEditorRef } from "@/components/markdown-editor";
import { MarkdownToolbar } from "@/components/markdown-toolbar";
import { useAuth } from "@/contexts/auth-context";
import { createNote, getNoteById, updateNote } from "@/lib/notes";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useOfflineQuery } from "@/lib/use-offline-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Alert as RNAlert,
  ScrollView,
  View,
} from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

export default function NoteEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useThemeColors();
  const isNewNote = id === "new";
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [lastSavedTitle, setLastSavedTitle] = useState("");
  const [lastSavedContent, setLastSavedContent] = useState("");
  const [isPreview, setIsPreview] = useState(!isNewNote);
  const editorRef = useRef<MarkdownEditorRef>(null);

  const containerAnimatedStyle = useAnimatedStyle(() => {
    // Only apply keyboard avoidance on native platforms
    if (Platform.OS === "web") {
      return {};
    }

    return {
      marginBottom: -keyboardHeight.value,
    };
  });

  const {
    data: note,
    isLoading,
    isFetching,
    refetch,
  } = useOfflineQuery({
    queryKey: ["note", id],
    queryFn: async () => {
      const existingNote = await getNoteById(id);
      if (!existingNote) {
        throw new Error("Note not found");
      }
      return existingNote;
    },
    resource: "notes",
    enabled: !isNewNote && !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes - shorter for individual notes since they change more frequently
  });

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setLastSavedTitle(note.title);
      setLastSavedContent(note.content);
    }
  }, [note]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      // After a full reload / deep-link, this screen can be the root of the navigator.
      // In that case, GO_BACK has no route to pop to, so we explicitly fall back to /notes.
      if (router.canGoBack?.()) {
        router.back();
      } else {
        router.replace("/notes");
      }
      return true;
    });

    return () => subscription.remove();
  }, [router]);

  const isDirty = title !== lastSavedTitle || content !== lastSavedContent;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const userId = user?.id ?? "demo-user";

      if (isNewNote) {
        const created = await createNote({
          user_id: userId,
          title: title || "Untitled",
          content,
        });
        return created;
      } else {
        const updated = await updateNote(id, {
          title: title || "Untitled",
          content,
        });
        if (!updated) {
          throw new Error("Note not found");
        }
        return updated;
      }
    },
    onSuccess: (savedNote) => {
      const updatedTitle = savedNote.title ?? title;
      const updatedContent = savedNote.content ?? content;

      setTitle(updatedTitle);
      setContent(updatedContent);
      setLastSavedTitle(updatedTitle);
      setLastSavedContent(updatedContent);

      // Optimistically update cache instead of invalidating
      queryClient.setQueryData(["note", id], savedNote);
      queryClient.invalidateQueries({ queryKey: ["notes"] }); // Invalidate list to refresh
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      RNAlert.alert("Error", error.message);
    },
  });

  const handleSave = () => {
    if (!title.trim() && !content.trim()) {
      RNAlert.alert("Empty Note", "Please add a title or content");
      return;
    }
    if (!isDirty) {
      return;
    }
    saveMutation.mutate();
  };

  const handleRefresh = async () => {
    if (isNewNote || !id) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const { data } = await refetch();
      if (data) {
        setTitle(data.title);
        setContent(data.content);
        setLastSavedTitle(data.title);
        setLastSavedContent(data.content);
      }
    } catch (error: any) {
      RNAlert.alert(
        "Sync failed",
        error?.message ?? "Unable to sync the latest version of this note."
      );
    }
  };

  const canSave = isDirty && !saveMutation.isPending;

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
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <NoteDetailHeader
        title={title}
        onTitleChange={setTitle}
        isNewNote={isNewNote}
        isDirty={isDirty}
        canSave={canSave}
        onSave={handleSave}
        isPreview={isPreview}
        onPreviewToggle={() => setIsPreview(!isPreview)}
        isFetching={isFetching}
        onRefresh={!isNewNote ? handleRefresh : undefined}
      />
      {Platform.OS === "web" ? (
        <View className="flex-1 bg-background" style={{ flex: 1, height: "100%" }}>
          <View className="flex-1 w-full max-w-2xl mx-auto bg-muted" style={{ minHeight: "100%" }}>
            {!isPreview && (
              <MarkdownToolbar
                onInsertText={(text, cursorOffset) => {
                  editorRef.current?.insertText(text, cursorOffset);
                }}
                onWrapSelection={(before, after, cursorOffset) => {
                  editorRef.current?.wrapSelection(before, after, cursorOffset);
                }}
                onIndent={() => {
                  editorRef.current?.indent();
                }}
                onOutdent={() => {
                  editorRef.current?.outdent();
                }}
                onUndo={() => {
                  editorRef.current?.undo();
                }}
                onRedo={() => {
                  editorRef.current?.redo();
                }}
                isPreview={isPreview}
              />
            )}
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ flexGrow: 1, minHeight: "100%" }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <MarkdownEditor
                ref={editorRef}
                value={content}
                onChangeText={setContent}
                placeholder="Start writing in markdown..."
                isPreview={isPreview}
              />
            </ScrollView>
          </View>
        </View>
      ) : (
        <Animated.View className="flex-1" style={containerAnimatedStyle}>
          <View className="flex-1 bg-background">
            <View className="flex-1 px-0 w-full max-w-2xl mx-auto bg-muted">
              {!isPreview && (
                <MarkdownToolbar
                  onInsertText={(text, cursorOffset) => {
                    editorRef.current?.insertText(text, cursorOffset);
                  }}
                  onWrapSelection={(before, after, cursorOffset) => {
                    editorRef.current?.wrapSelection(before, after, cursorOffset);
                  }}
                  onIndent={() => {
                    editorRef.current?.indent();
                  }}
                  onOutdent={() => {
                    editorRef.current?.outdent();
                  }}
                  onUndo={() => {
                    editorRef.current?.undo();
                  }}
                  onRedo={() => {
                    editorRef.current?.redo();
                  }}
                  isPreview={isPreview}
                />
              )}
              <ScrollView
                className="flex-1"
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                keyboardDismissMode="interactive"
              >
                <MarkdownEditor
                  ref={editorRef}
                  value={content}
                  onChangeText={setContent}
                  placeholder="Start writing in markdown..."
                  isPreview={isPreview}
                />
              </ScrollView>
            </View>
          </View>
        </Animated.View>
      )}
    </>
  );
}

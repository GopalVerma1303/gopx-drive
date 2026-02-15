"use client";

import { AIPromptModal } from "@/components/ai-prompt-modal";
import { ImageInsertModal } from "@/components/image-insert-modal";
import { NoteDetailHeader } from "@/components/headers/note-detail-header";
import { MarkdownEditor, MarkdownEditorRef } from "@/components/markdown-editor";
import { MarkdownToolbar } from "@/components/markdown-toolbar";
import { useAuth } from "@/contexts/auth-context";
import { generateAIContent } from "@/lib/ai-providers";
import { createNote, getNoteById, updateNote } from "@/lib/notes";
import { invalidateNotesQueries } from "@/lib/query-utils";
import type { Note } from "@/lib/supabase";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const { id, edit: editParam } = useLocalSearchParams<{ id: string; edit?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useThemeColors();
  const isNewNote = id === "new";
  /** Open in edit mode for new notes, or when we just created and replaced (edit=1) */
  const openInEditMode = isNewNote || editParam === "1";
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [lastSavedTitle, setLastSavedTitle] = useState("");
  const [lastSavedContent, setLastSavedContent] = useState("");
  const [isPreview, setIsPreview] = useState(!openInEditMode);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [imageModalOpen, setImageModalOpen] = useState(false);
  /** Last selection from editor (updated on every selection change). Preserved when AI button steals focus. */
  const lastSelectionRef = useRef({ start: 0, end: 0 });
  /** Range to replace with AI output when modal was opened with a selection (so we don't rely on getSelection() after focus is lost). */
  const [aiReplaceRange, setAiReplaceRange] = useState<{ start: number; end: number } | null>(null);
  const editorRef = useRef<MarkdownEditorRef>(null);
  /** Guards against double submission (e.g. double-tap save) before isPending updates. */
  const saveInProgressRef = useRef(false);

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
  } = useQuery({
    queryKey: ["note", id],
    queryFn: async () => {
      const existingNote = await getNoteById(id);
      if (!existingNote) {
        throw new Error("Note not found");
      }
      return existingNote;
    },
    enabled: !isNewNote && !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes - shorter for individual notes since they change more frequently
    // Use cached data immediately, don't show loading if we have cache
    placeholderData: (previousData) => previousData,
    retry: false,
    retryOnMount: false,
  });

  // Check if notes list shows a newer version of this note and refetch if needed
  // This fixes the issue where note list updates but individual note shows stale content
  useEffect(() => {
    if (isNewNote || !id || !note || !user?.id) return;

    type NoteArray = Array<{ id: string; updated_at: string }>;
    const notesListData = queryClient.getQueryData<NoteArray>(["notes", user.id]);
    if (notesListData) {
      const listNote = notesListData.find((n) => n.id === id);
      if (listNote && listNote.updated_at !== note.updated_at) {
        // List shows a different updated_at, refetch the note to get latest content
        refetch().catch(() => {
          // Refetch failed, but we already have cached data
        });
      }
    }
  }, [id, note, user?.id, queryClient, refetch, isNewNote]);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setLastSavedTitle(note.title);
      setLastSavedContent(note.content);
    }
  }, [note]);

  // Reset form when navigating to "new" so previous note content is cleared
  useEffect(() => {
    if (id === "new") {
      setTitle("");
      setContent("");
      setLastSavedTitle("");
      setLastSavedContent("");
      setIsPreview(false); // open new note in edit mode
      setAiReplaceRange(null);
      setSelectedText("");
      setImageModalOpen(false);
    }
  }, [id]);

  // After replace from "new" to /note/[id]?edit=1, keep edit mode (in case component didn't remount)
  useEffect(() => {
    if (editParam === "1") {
      setIsPreview(false);
    }
  }, [id, editParam]);

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
      // For new notes, id is "new" but savedNote.id is the actual ID, so update both
      queryClient.setQueryData(["note", id], savedNote);
      if (isNewNote && savedNote.id !== id) {
        // Also set cache for the actual note ID
        queryClient.setQueryData(["note", savedNote.id], savedNote);
      }

      // Replace route so we're on /note/[id] instead of /note/new. Prevents redundant
      // note creation: next save will call updateNote(id) instead of createNote() again.
      // Pass edit=1 so the screen opens in edit mode (user was still editing).
      if (id === "new" && savedNote?.id) {
        router.replace(`/(app)/note/${savedNote.id}?edit=1`);
      }

      // Optimistically update notes list cache to show new note immediately
      // This fixes the issue where new notes don't appear until refresh
      const notesQueryKey = ["notes", user?.id];
      queryClient.setQueryData<typeof savedNote[]>(notesQueryKey, (oldData) => {
        if (!oldData) return [savedNote];
        // Check if note already exists in the list
        const existingIndex = oldData.findIndex((n) => n.id === savedNote.id);
        if (existingIndex >= 0) {
          // Update existing note
          const updated = [...oldData];
          updated[existingIndex] = savedNote;
          // Sort by updated_at descending
          return updated.sort((a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
        } else {
          // Add new note at the beginning (most recent first)
          // Only add if not archived (notes list only shows non-archived notes)
          if (!savedNote.is_archived) {
            return [savedNote, ...oldData];
          }
          return oldData;
        }
      });

      invalidateNotesQueries(queryClient, user?.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      RNAlert.alert("Error", error.message);
    },
    onSettled: () => {
      saveInProgressRef.current = false;
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
    // Prevent double submission (e.g. double-tap or slow network) before isPending updates
    if (saveInProgressRef.current) return;
    saveInProgressRef.current = true;
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

  const handleOpenAIModal = () => {
    // Use last known selection (from onSelectionChange); getSelection() is already collapsed once the toolbar button takes focus.
    const { start, end } = lastSelectionRef.current;
    if (start !== end) {
      const selected = content.substring(start, end);
      setSelectedText(selected);
      setAiReplaceRange({ start, end });
    } else {
      setSelectedText("");
      setAiReplaceRange(null);
    }
    setAiModalOpen(true);
  };

  const handleAIGenerate = async (prompt: string) => {
    if (!prompt.trim()) return;

    setAiLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Use stored range from when modal was opened (selection is lost after focus moved to toolbar/modal)
      const range = aiReplaceRange;
      const contextText = range ? content.substring(range.start, range.end) : "";

      const generatedText = await generateAIContent({
        prompt,
        selectedText: contextText || undefined,
      });

      if (editorRef.current && generatedText) {
        if (range) {
          editorRef.current.replaceRange(range.start, range.end, generatedText);
          setAiReplaceRange(null);
        } else {
          editorRef.current.insertText(generatedText, generatedText.length);
        }
      }

      setAiModalOpen(false);
      setSelectedText("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      RNAlert.alert(
        "AI Generation Failed",
        error.message || "Failed to generate content. Please check your AI provider configuration and API key."
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleImageInsert = (markdown: string) => {
    if (editorRef.current) {
      editorRef.current.insertText(markdown, markdown.length);
    }
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
                onAIAssistant={handleOpenAIModal}
                onImageInsert={() => setImageModalOpen(true)}
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
                onSelectionChange={(sel) => {
                  lastSelectionRef.current = sel;
                }}
                placeholder="Start writing in markdown..."
                isPreview={isPreview}
                onSave={handleSave}
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
                  onAIAssistant={handleOpenAIModal}
                  onImageInsert={() => setImageModalOpen(true)}
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
                  onSelectionChange={(sel) => {
                    lastSelectionRef.current = sel;
                  }}
                  placeholder="Start writing in markdown..."
                  isPreview={isPreview}
                />
              </ScrollView>
            </View>
          </View>
        </Animated.View>
      )}
      <AIPromptModal
        visible={aiModalOpen}
        onClose={() => {
          setAiModalOpen(false);
          setSelectedText("");
          setAiReplaceRange(null);
        }}
        onGenerate={handleAIGenerate}
        initialPrompt={selectedText ? `Improve or rewrite: "${selectedText}" ` : ""}
        isLoading={aiLoading}
      />
      <ImageInsertModal
        visible={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        onInsert={handleImageInsert}
      />
    </>
  );
}

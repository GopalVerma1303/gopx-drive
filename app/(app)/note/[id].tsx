"use client";

import { AIPromptModal } from "@/components/ai-prompt-modal";
import { NoteDetailHeader } from "@/components/headers/note-detail-header";
import { ImageInsertModal } from "@/components/image-insert-modal";
import { MARKDOWN_CONTENT_PADDING_PX_NATIVE, MARKDOWN_FONT_SIZE, MARKDOWN_TOOLBAR_HEIGHT } from "@/lib/markdown-content-layout";
import { MarkdownEditor, MarkdownEditorRef } from "@/components/markdown-editor";
import { MarkdownPreview } from "@/components/markdown-preview";
import { MarkdownToolbar } from "@/components/markdown-toolbar";
import { ShareNoteModal } from "@/components/share-note-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useAlert } from "@/contexts/alert-context";
import { useAuth } from "@/contexts/auth-context";
import { generateAIContent } from "@/lib/ai-providers";
import { listFolders } from "@/lib/folders";
import { createNote, getNoteById, syncNotesFromSupabase, updateNote } from "@/lib/notes";
import { invalidateFoldersQueries, invalidateNotesListQueries } from "@/lib/query-utils";
import { useThemeColors } from "@/lib/use-theme-colors";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronDown, ChevronUp, Replace, ReplaceAll, Search, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { KeyboardController, useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function NoteEditorScreen() {
  const { id, edit: editParam, folderId } = useLocalSearchParams<{ id: string; edit?: string; folderId?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { alert } = useAlert();
  const { colors } = useThemeColors();
  // Provide enough vertical space in a new note so the editor has a large click/press target
  // roughly matching an average phone screen height.
  const DEFAULT_NEW_NOTE_LINES = 22;
  const DEFAULT_NEW_NOTE_CONTENT = "\n".repeat(DEFAULT_NEW_NOTE_LINES);
  const isNewNote = id === "new";
  const initialFolderId = typeof folderId === "string" && folderId.length > 0 ? folderId : null;
  /** Open in edit mode for new notes, or when we just created and replaced (edit=1) */
  const openInEditMode = isNewNote || editParam === "1";
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState(DEFAULT_NEW_NOTE_CONTENT);
  const [lastSavedTitle, setLastSavedTitle] = useState("");
  const [lastSavedContent, setLastSavedContent] = useState(DEFAULT_NEW_NOTE_CONTENT);
  const [isPreview, setIsPreview] = useState(!openInEditMode);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [dropdownTriggerWidth, setDropdownTriggerWidth] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  /** Measured height (px) of the editor area below the toolbar. Used so CodeMirror gets a definite viewport height and can scroll to the last line. */
  const [editorAreaHeightPx, setEditorAreaHeightPx] = useState(0);
  /** Last selection from editor (updated on every selection change). Preserved when AI button steals focus. */
  const lastSelectionRef = useRef({ start: 0, end: 0 });
  /** Range to replace with AI output when modal was opened with a selection (so we don't rely on getSelection() after focus is lost). */
  const [aiReplaceRange, setAiReplaceRange] = useState<{ start: number; end: number } | null>(null);
  const editorRef = useRef<MarkdownEditorRef>(null);
  const searchInputRef = useRef<any>(null);
  /** Guards against double submission (e.g. double-tap save) before isPending updates. */
  const saveInProgressRef = useRef(false);
  /** Note id we last synced from. Used to avoid overwriting unsaved editor content when note refetches (e.g. on preview toggle or focus). */
  const lastSyncedNoteIdRef = useRef<string | null>(null);

  // Search state
  const [isSearchBarVisible, setIsSearchBarVisible] = useState(false);
  const [isReplaceVisible, setIsReplaceVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);

  const isDirty = title !== lastSavedTitle || content !== lastSavedContent;

  // On native, give the editor ScrollView content a min height so the WebView gets a real height.
  // Otherwise flex:1 inside ScrollView can resolve to 0 and the editor is invisible.
  const windowHeight = Dimensions.get("window").height;
  const nativeEditorContentMinHeight = Platform.OS !== "web" ? windowHeight : undefined;

  const containerAnimatedStyle = useAnimatedStyle(() => {
    // Only apply keyboard avoidance on native platforms
    if (Platform.OS === "web") {
      return {};
    }

    return {
      marginBottom: -keyboardHeight.value,
    };
  });
  
  const toolbarAnimatedStyle = useAnimatedStyle(() => {
    // Dynamically reduce paddingBottom as keyboard moves up.
    // keyboardHeight is positive when keyboard is visible.
    return {
      paddingBottom: Math.max(0, insets.bottom - Math.abs(keyboardHeight.value)),
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

  const { data: folders = [] } = useQuery({
    queryKey: ["folders", user?.id],
    queryFn: () => listFolders(user?.id),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  });

  // Check if notes list shows a newer version of this note and refetch if needed
  // This fixes the issue where note list updates but individual note shows stale content
  useEffect(() => {
    if (isNewNote || !id || !note || !user?.id) return;

    // Use getQueryState to check if query exists and is not currently fetching
    // This prevents triggering unnecessary refetches when accessing query data
    const notesListQueryState = queryClient.getQueryState<Array<{ id: string; updated_at: string }>>([
      "notes",
      user.id,
    ]);

    // Only proceed if query exists, has data, and is not currently fetching
    // This prevents duplicate API calls (QueryState has fetchStatus, not isFetching)
    const isIdleOrPaused =
      notesListQueryState?.fetchStatus === "idle" || notesListQueryState?.fetchStatus === "paused";
    if (notesListQueryState?.data && isIdleOrPaused) {
      const listNote = notesListQueryState.data.find((n) => n.id === id);
      if (listNote && listNote.updated_at !== note.updated_at) {
        // List shows a different updated_at, refetch the note to get latest content
        refetch().catch(() => {
          // Refetch failed, but we already have cached data
        });
      }
    }
  }, [id, note, user?.id, queryClient, refetch, isNewNote]);

  // Sync note from server into form only on initial load (different note id) or when no unsaved changes.
  // This prevents refetches (e.g. on preview toggle or window focus) from overwriting the user's in-memory edits on mobile.
  useEffect(() => {
    if (!note || id === "new") return;
    const noteId = note.id;
    const syncedNoteId = lastSyncedNoteIdRef.current;
    const isNewNoteLoad = syncedNoteId !== noteId;
    if (isNewNoteLoad) {
      lastSyncedNoteIdRef.current = noteId;
      setTitle(note.title);
      setContent(note.content);
      setLastSavedTitle(note.title);
      setLastSavedContent(note.content);
    } else if (!isDirty) {
      setTitle(note.title);
      setContent(note.content);
      setLastSavedTitle(note.title);
      setLastSavedContent(note.content);
    }
  }, [note, isDirty, id]);

  // Reset form when navigating to "new" so previous note content is cleared
  useEffect(() => {
    if (id === "new") {
      lastSyncedNoteIdRef.current = null;
      setTitle("");
      setContent(DEFAULT_NEW_NOTE_CONTENT);
      setLastSavedTitle("");
      setLastSavedContent(DEFAULT_NEW_NOTE_CONTENT);
      setIsPreview(false); // open new note in edit mode
      setAiReplaceRange(null);
      setSelectedText("");
      setImageModalOpen(false);
    }
  }, [id]);

  // After replace from "new" to /note/[id], sync preview/edit with URL: edit=1 → edit mode, no param → preview
  useEffect(() => {
    if (editParam === "1") {
      setIsPreview(false);
    } else if (id !== "new") {
      setIsPreview(true);
    }
  }, [id, editParam]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      // Dismiss keyboard first so it doesn't reopen during transition (editor stays focused otherwise).
      const navigate = () => {
        if (router.canGoBack?.()) {
          router.back();
        } else {
          router.replace("/notes");
        }
      };
      KeyboardController.dismiss().then(navigate);
      return true;
    });

    return () => subscription.remove();
  }, [router]);


  type SaveVariables = { openInEditAfterSave?: boolean };

  const saveMutation = useMutation({
    mutationFn: async (_variables?: SaveVariables) => {
      const userId = user?.id ?? "demo-user";

      if (isNewNote) {
        const created = await createNote({
          user_id: userId,
          title: title || "Untitled",
          content,
          folder_id: initialFolderId,
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
    onSuccess: (savedNote, variables) => {
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
      // If user saved from preview mode, open in preview; if from edit mode, open in edit.
      if (id === "new" && savedNote?.id) {
        lastSyncedNoteIdRef.current = savedNote.id;
        const openInEditAfterSave = variables?.openInEditAfterSave ?? true;
        router.replace(
          `/(app)/note/${savedNote.id}${openInEditAfterSave ? "?edit=1" : ""}`
        );
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

      // Optimistically update folder notes cache when note belongs to a folder
      // So returning to folder/id shows the updated note without manual refresh (same as notes page)
      if (savedNote.folder_id && user?.id) {
        const folderNotesKey = ["folderNotes", savedNote.folder_id, user.id];
        queryClient.setQueryData<typeof savedNote[]>(folderNotesKey, (oldData) => {
          if (!oldData) return [savedNote];
          const existingIndex = oldData.findIndex((n) => n.id === savedNote.id);
          if (existingIndex >= 0) {
            const updated = [...oldData];
            updated[existingIndex] = savedNote;
            return updated.sort((a, b) =>
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            );
          }
          if (!savedNote.is_archived) {
            return [savedNote, ...oldData];
          }
          return oldData;
        });
      }

      invalidateNotesListQueries(queryClient, user?.id);
      invalidateFoldersQueries(queryClient, user?.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      alert("Error", error.message);
    },
    onSettled: () => {
      saveInProgressRef.current = false;
    },
  });

  const moveNoteMutation = useMutation({
    mutationFn: ({
      noteId,
      folderId,
    }: {
      noteId: string;
      folderId: string | null;
      previousFolderId?: string | null;
    }) => updateNote(noteId, { folder_id: folderId }),
    onSuccess: (_data, { noteId, folderId, previousFolderId }) => {
      invalidateNotesListQueries(queryClient, user?.id);
      invalidateFoldersQueries(queryClient, user?.id);
      queryClient.invalidateQueries({ queryKey: ["note", noteId] });
      queryClient.setQueryData(["note", noteId], (prev: typeof note) =>
        prev ? { ...prev, folder_id: folderId } : prev
      );
      // Refetch only the two affected folder note lists (no refetch on every focus)
      if (user?.id) {
        if (previousFolderId) {
          queryClient.refetchQueries({ queryKey: ["folderNotes", previousFolderId, user.id] });
        }
        if (folderId) {
          queryClient.refetchQueries({ queryKey: ["folderNotes", folderId, user.id] });
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMoveModalOpen(false);
      setSelectedFolderId(null);
    },
  });

  const openMoveModal = () => {
    setSelectedFolderId(note?.folder_id ?? null);
    setMoveModalOpen(true);
  };

  const closeMoveModal = () => {
    setMoveModalOpen(false);
    setSelectedFolderId(null);
    setDropdownTriggerWidth(0);
  };

  const handleMoveConfirm = () => {
    if (!id || isNewNote) return;
    moveNoteMutation.mutate({
      noteId: id,
      folderId: selectedFolderId,
      previousFolderId: note?.folder_id ?? null,
    });
  };

  const handleSave = () => {
    if (!title.trim() && !content.trim()) {
      alert("Empty Note", "Please add a title or content");
      return;
    }
    if (!isDirty) {
      return;
    }
    // Prevent double submission (e.g. double-tap or slow network) before isPending updates
    if (saveInProgressRef.current) return;
    saveInProgressRef.current = true;
    // Pass whether to open in edit mode after save: only true when user was editing (not in preview)
    saveMutation.mutate({ openInEditAfterSave: !isPreview });
  };

  const handleRefresh = async () => {
    if (isNewNote || !id || isRefreshing) return;

    setIsRefreshing(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // On native, sync from Supabase first (push local + pull remote into SQLite), then refetch
      if (Platform.OS !== "web" && user?.id) {
        await syncNotesFromSupabase(user.id);
      }
      const { data } = await refetch();
      if (data) {
        setTitle(data.title);
        setContent(data.content);
        setLastSavedTitle(data.title);
        setLastSavedContent(data.content);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error: any) {
      alert(
        "Sync failed",
        error?.message ?? "Unable to sync the latest version of this note."
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const canSave = isDirty && !saveMutation.isPending;

  // Sync search with editor/preview
  useEffect(() => {
    if (isSearchBarVisible && searchQuery) {
      if (isPreview) {
        // Handled by MarkdownPreview component sync
      } else {
        // Editor search: setSearch returns match count and optionally handles scrolling.
        // Consolidation prevents race conditions and redundant bridge calls on mobile.
        const result = editorRef.current?.setSearch?.(searchQuery, currentMatchIndex, true);
        if (result && typeof result === "object" && "then" in (result as any)) {
          (result as Promise<number>).then((count) => {
            if (typeof count === "number" && count >= 0) setTotalMatches(count);
          });
        } else if (typeof result === "number" && result >= 0) {
          setTotalMatches(result);
        }
      }
    } else {
      setTotalMatches(0);
      setCurrentMatchIndex(0);
      if (!isPreview) {
        editorRef.current?.setSearch?.("", 0);
      }
    }
  }, [searchQuery, currentMatchIndex, isPreview, isSearchBarVisible]);

  const handleSearchOpen = (mode: 'search' | 'replace' = 'search') => {
    setIsSearchBarVisible(true);
    setIsReplaceVisible(mode === 'replace');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Auto-focus the search bar
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const handleSearchClose = () => {
    setIsSearchBarVisible(false);
    setIsReplaceVisible(false);
    setSearchQuery("");
    setReplaceQuery("");
    setCurrentMatchIndex(0);
    setTotalMatches(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSearchNext = () => {
    if (totalMatches === 0) return;
    const nextIndex = (currentMatchIndex + 1) % totalMatches;
    setCurrentMatchIndex(nextIndex);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSearchPrev = () => {
    if (totalMatches === 0) return;
    const prevIndex = (currentMatchIndex - 1 + totalMatches) % totalMatches;
    setCurrentMatchIndex(prevIndex);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

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

  const handleAIGenerate = async (prompt: string, mode?: string) => {
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
        mode: mode as any,
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

      // Insert error message into editor instead of showing alert
      const errorMessage = error.message || "Failed to generate content. Please check your AI provider configuration and API key.";

      if (editorRef.current) {
        const range = aiReplaceRange;
        if (range) {
          editorRef.current.replaceRange(range.start, range.end, errorMessage);
          setAiReplaceRange(null);
        } else {
          editorRef.current.insertText(errorMessage, errorMessage.length);
        }
      }

      setAiModalOpen(false);
      setSelectedText("");
    } finally {
      setAiLoading(false);
    }
  };

  const handleImageInsert = (markdown: string) => {
    if (editorRef.current) {
      editorRef.current.insertText(markdown, markdown.length);
    }
  };

  const [previewReady, setPreviewReady] = useState<boolean>(isNewNote);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      {/* Single flex column root so header + content get correct height; content area can scroll to bottom */}
      <View className="flex-1 flex-col min-h-0">
        <NoteDetailHeader
          title={title}
          onTitleChange={setTitle}
          isNewNote={isNewNote}
          isDirty={isDirty}
          canSave={canSave}
          isSaving={saveMutation.isPending}
          onSave={handleSave}
          isPreview={isPreview}
          onPreviewToggle={() => {
            if (!isPreview && Platform.OS !== "web") {
              // Flush WebView content to React state before switching to preview (DOM editor syncs on every change, so content is usually current)
              (editorRef.current?.getContentAsync?.() ?? Promise.resolve(content))
                .then((flushed) => {
                  if (typeof flushed === "string") setContent(flushed);
                  setIsPreview(true);
                })
                .catch(() => setIsPreview(true));
            } else {
              setIsPreview(!isPreview);
            }
          }}
          isFetching={isFetching || isRefreshing}
          onRefresh={!isNewNote ? handleRefresh : undefined}
          onOpenShareModal={!isNewNote ? () => setShareModalOpen(true) : undefined}
          folderName={
            !isNewNote && note
              ? note.folder_id != null
                ? folders.find((f) => f.id === note.folder_id)?.name ?? "Folder"
                : "No folder"
              : undefined
          }
          onOpenMoveModal={!isNewNote && note ? openMoveModal : undefined}
          onSearchOpen={() => handleSearchOpen('search')}
          onReplaceOpen={() => handleSearchOpen('replace')}
        />
        {isSearchBarVisible && (
          <View className="flex-col bg-background border-b border-muted">
            <View className="flex-row items-center px-3 py-2 gap-6">
              <View className="flex-1 flex-row items-center bg-muted rounded-lg px-[10px] h-9">
                <Search size={18} color={colors.mutedForeground} />
                <Input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChangeText={(text: string) => {
                    setSearchQuery(text);
                    setCurrentMatchIndex(0);
                  }}
                  placeholder="Search note..."
                  placeholderTextColor={colors.mutedForeground}
                  className="flex-1 py-0 h-9 text-foreground bg-transparent border-0"
                />
                {totalMatches > 0 && (
                  <Text className="text-[12px] text-muted-foreground mr-2">
                    {currentMatchIndex + 1}/{totalMatches}
                  </Text>
                )}
              </View>
              <View className="flex-row items-center gap-3">
                <Pressable
                  onPress={handleSearchPrev}
                  disabled={totalMatches === 0}
                  className={cn("p-[6px]", totalMatches === 0 ? "opacity-40" : "active:opacity-70")}
                >
                  <ChevronUp size={20} color={colors.foreground} />
                </Pressable>
                <Pressable
                  onPress={handleSearchNext}
                  disabled={totalMatches === 0}
                  className={cn("p-[6px]", totalMatches === 0 ? "opacity-40" : "active:opacity-70")}
                >
                  <ChevronDown size={20} color={colors.foreground} />
                </Pressable>
                <Pressable
                  onPress={handleSearchClose}
                  className="p-[6px] ml-1 active:opacity-70"
                >
                  <X size={20} color={colors.foreground} />
                </Pressable>
              </View>
            </View>

            {isReplaceVisible && (
              <View className="flex-row items-center px-3 pb-2 gap-6">
                <View className="flex-1 flex-row items-center bg-muted rounded-lg px-[10px] h-9">
                  <Replace size={18} color={colors.mutedForeground} />
                  <Input
                    value={replaceQuery}
                    onChangeText={setReplaceQuery}
                    placeholder="Replace with..."
                    placeholderTextColor={colors.mutedForeground}
                    className="flex-1 py-0 h-9 text-foreground bg-transparent border-0"
                  />
                </View>
                <View className="flex-row items-center gap-3">
                  <Pressable
                    onPress={() => editorRef.current?.replace?.(searchQuery, replaceQuery, currentMatchIndex)}
                    disabled={totalMatches === 0 || !searchQuery}
                    className={cn("p-[6px]", (totalMatches === 0 || !searchQuery) ? "opacity-40" : "active:opacity-70")}
                  >
                    <Replace size={20} color={colors.foreground} />
                  </Pressable>
                  <Pressable
                    onPress={() => editorRef.current?.replaceAll?.(searchQuery, replaceQuery)}
                    disabled={totalMatches === 0 || !searchQuery}
                    className={cn("p-[6px]", (totalMatches === 0 || !searchQuery) ? "opacity-40" : "active:opacity-70")}
                  >
                    <ReplaceAll size={20} color={colors.foreground} />
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}
        {Platform.OS === "web" ? (
          <View className="flex-1 min-h-0 bg-background">
            <View className="flex-1 min-h-0 w-full bg-background relative">
              {/* Preview: always mounted, hidden when editing for instant switch */}
              <View
                style={{ 
                  flex: 1, 
                  display: isPreview ? "flex" : "none",
                  zIndex: isPreview ? 1 : 0
                }}
              >
                <ScrollView
                  className="flex-1"
                  contentContainerStyle={{ flexGrow: 1, minHeight: "100%" }}
                  showsVerticalScrollIndicator
                >
                  <View className="flex-grow w-full max-w-[672px] self-center bg-muted">
                    <MarkdownPreview
                      content={content}
                      onToggleCheckbox={(updater) => setContent(updater as any)}
                      placeholder="Start writing in markdown..."
                      onFirstHtmlRendered={() => setPreviewReady(true)}
                      searchQuery={isSearchBarVisible ? searchQuery : ""}
                      currentMatchIndex={currentMatchIndex}
                      onSearchMatchCount={setTotalMatches}
                    />
                  </View>
                </ScrollView>
              </View>
              {/* Editor: always mounted, hidden when previewing for instant switch */}
              <View
                style={{ 
                  flex: 1, 
                  display: isPreview ? "none" : "flex",
                  zIndex: isPreview ? 0 : 1
                }}
                className="flex-col"
              >
                <View
                  className="flex-1 min-h-0"
                  onLayout={(e: any) => {
                    const h = e.nativeEvent.layout.height;
                    if (typeof h === "number" && h > 0) setEditorAreaHeightPx(h);
                  }}
                >
                  {(!isNewNote && isLoading && !note) ? null : (
                    <MarkdownEditor
                      ref={editorRef}
                      id={id}
                      value={content}
                      onChangeText={setContent}
                      onSelectionChange={(sel) => {
                        lastSelectionRef.current = sel;
                      }}
                      placeholder="Start writing in markdown..."
                      isPreview={false}
                      onSave={handleSave}
                      editorAreaHeight={editorAreaHeightPx}
                      searchQuery={isSearchBarVisible ? searchQuery : ""}
                      currentMatchIndex={currentMatchIndex}
                      onSearchMatchCount={setTotalMatches}
                    />
                  )}
                </View>
                <MarkdownToolbar
                  onInsertText={(text, cursorOffset) => {
                    editorRef.current?.insertText(text, cursorOffset);
                  }}
                  onWrapSelection={(before, after, cursorOffset) => {
                    editorRef.current?.wrapSelection(before, after, cursorOffset);
                  }}
                  onIndent={() => editorRef.current?.indent()}
                  onOutdent={() => editorRef.current?.outdent()}
                  onUndo={() => editorRef.current?.undo()}
                  onRedo={() => editorRef.current?.redo()}
                  onAIAssistant={handleOpenAIModal}
                  onImageInsert={() => setImageModalOpen(true)}
                  isPreview={false}
                />
              </View>
            </View>
          </View>
        ) : (
          <Animated.View className="flex-1" style={containerAnimatedStyle}>
            <View className="flex-1 bg-background">
              <View className="flex-1 w-full relative">
                {/* Editor: always mounted, hidden when previewing for instant switch */}
                <View
                  style={{ 
                    flex: 1, 
                    display: isPreview ? "none" : "flex",
                    zIndex: isPreview ? 0 : 1
                  }}
                  className="w-full flex-col"
                >
                  <View
                    className="flex-1 w-full max-w-[672px] self-center bg-muted"
                    style={{
                      minHeight: nativeEditorContentMinHeight,
                    }}
                  >
                    {(!isNewNote && isLoading && !note) ? null : (
                      <MarkdownEditor
                        key={`note-editor-${id}`}
                        id={id}
                        ref={editorRef}
                        value={content}
                        onChangeText={setContent}
                        onContentSync={(updater) => setContent(updater as any)}
                        onSelectionChange={(sel) => {
                          lastSelectionRef.current = sel;
                        }}
                        placeholder="Start writing in markdown..."
                        isPreview={false}
                        searchQuery={isSearchBarVisible ? searchQuery : ""}
                        currentMatchIndex={currentMatchIndex}
                        onSearchMatchCount={setTotalMatches}
                        extraBottomPadding={MARKDOWN_TOOLBAR_HEIGHT + insets.bottom}
                      />
                    )}
                  </View>
                  <Animated.View 
                    className="absolute bottom-0 left-0 right-0 z-10 bg-background"
                    style={toolbarAnimatedStyle}
                  >
                    <MarkdownToolbar
                      onInsertText={(text, cursorOffset) => {
                        editorRef.current?.insertText(text, cursorOffset);
                      }}
                      onWrapSelection={(before, after, cursorOffset) => {
                        editorRef.current?.wrapSelection(before, after, cursorOffset);
                      }}
                      onIndent={() => editorRef.current?.indent()}
                      onOutdent={() => editorRef.current?.outdent()}
                      onUndo={() => editorRef.current?.undo()}
                      onRedo={() => editorRef.current?.redo()}
                      onAIAssistant={handleOpenAIModal}
                      onImageInsert={() => setImageModalOpen(true)}
                      isPreview={false}
                    />
                  </Animated.View>
                </View>

                {/* Preview: always mounted, hidden when editing for instant switch */}
                <View
                  style={{ 
                    flex: 1, 
                    display: isPreview ? "flex" : "none",
                    zIndex: isPreview ? 1 : 0
                  }}
                  className="w-full"
                >
                  <View className="flex-1 w-full max-w-[672px] self-center bg-muted">
                    <MarkdownPreview
                      content={content}
                      onToggleCheckbox={(updater) => setContent(updater as any)}
                      placeholder="Start writing in markdown..."
                      contentContainerStyle={{ 
                        flex: 1, 
                        width: "100%",
                        paddingBottom: insets.bottom + 20
                      }}
                      onFirstHtmlRendered={() => setPreviewReady(true)}
                      searchQuery={isSearchBarVisible ? searchQuery : ""}
                      currentMatchIndex={currentMatchIndex}
                      onSearchMatchCount={setTotalMatches}
                    />
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>
        )}
        {/* Overlay loader while the note is loading or initial preview HTML is being generated,
            so the user does not see a blank note screen. */}
        {!isNewNote && (isLoading || !previewReady) && (
          <View className="absolute inset-0 items-center justify-center bg-background">
            <ActivityIndicator size="large" color={colors.foreground} />
          </View>
        )}
      </View>
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
      {!isNewNote && note && (
        <ShareNoteModal
          visible={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          noteId={note.id}
          shareToken={note.share_token}
          onShareTokenChange={(token) => {
            queryClient.setQueryData(["note", id], (prev: typeof note) =>
              prev ? { ...prev, share_token: token } : prev
            );
          }}
        />
      )}

      {/* Move to folder modal */}
      {!isNewNote && note && (Platform.OS === "web" ? (
        moveModalOpen && (
          <View className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <Pressable className="absolute inset-0" onPress={closeMoveModal} />
            <View className="w-full max-w-md rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">
                Move to
              </Text>
              <Text className="mb-4 text-sm text-muted-foreground">
                Choose a folder for "{note.title || "Untitled"}"
              </Text>
              <View
                className="mb-6 w-full"
                onLayout={(e) => setDropdownTriggerWidth(e.nativeEvent.layout.width)}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Pressable className="w-full flex-row items-center justify-between rounded-md border border-border bg-background px-3 py-2.5">
                      <Text className="text-sm text-foreground">
                        {selectedFolderId == null
                          ? "No folder"
                          : folders.find((f) => f.id === selectedFolderId)?.name ?? "Select folder"}
                      </Text>
                      <ChevronDown color={colors.mutedForeground} size={16} />
                    </Pressable>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    style={dropdownTriggerWidth > 0 ? { width: dropdownTriggerWidth } : undefined}
                  >
                    <DropdownMenuItem onPress={() => setSelectedFolderId(null)}>
                      <Text className="text-foreground">No folder</Text>
                    </DropdownMenuItem>
                    {folders.map((folder) => (
                      <DropdownMenuItem
                        key={folder.id}
                        onPress={() => setSelectedFolderId(folder.id)}
                      >
                        <Text className="text-foreground">{folder.name}</Text>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </View>
              <View className="flex-row justify-end gap-3">
                <Pressable className="px-4 py-2" onPress={closeMoveModal}>
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className="rounded-md px-4 py-2"
                  onPress={handleMoveConfirm}
                  disabled={moveNoteMutation.isPending}
                >
                  <Text className="font-semibold text-blue-500">
                    {moveNoteMutation.isPending ? "Moving…" : "Move"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )
      ) : (
        <Modal
          visible={moveModalOpen}
          transparent
          animationType="fade"
          onRequestClose={closeMoveModal}
        >
          <View className="flex-1 justify-center items-center bg-black/40 p-6">
            <Pressable className="absolute inset-0" onPress={closeMoveModal} />
            <View className="w-full max-w-[400px] rounded-xl border border-border bg-muted p-6">
              <Text className="mb-2 text-[18px] font-semibold text-foreground">
                Move to
              </Text>
              <Text className="mb-4 text-sm text-muted-foreground">
                Choose a folder for "{note.title || "Untitled"}"
              </Text>
              <View
                className="mb-6 w-full"
                onLayout={(e) => setDropdownTriggerWidth(e.nativeEvent.layout.width)}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Pressable
                      className="w-full flex-row items-center justify-between rounded-md border border-border bg-background px-3 py-[10px]"
                    >
                      <Text className="text-sm text-foreground">
                        {selectedFolderId == null
                          ? "No folder"
                          : folders.find((f) => f.id === selectedFolderId)?.name ?? "Select folder"}
                      </Text>
                      <ChevronDown color={colors.mutedForeground} size={16} />
                    </Pressable>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    style={dropdownTriggerWidth > 0 ? { width: dropdownTriggerWidth } : undefined}
                  >
                    <DropdownMenuItem onPress={() => setSelectedFolderId(null)}>
                      <Text style={{ color: colors.foreground }}>No folder</Text>
                    </DropdownMenuItem>
                    {folders.map((folder) => (
                      <DropdownMenuItem
                        key={folder.id}
                        onPress={() => setSelectedFolderId(folder.id)}
                      >
                        <Text style={{ color: colors.foreground }}>{folder.name}</Text>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </View>
              <View className="flex-row justify-end gap-3">
                <Pressable className="px-4 py-2" onPress={closeMoveModal}>
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className="rounded-md px-4 py-2"
                  onPress={handleMoveConfirm}
                  disabled={moveNoteMutation.isPending}
                >
                  <Text className="font-semibold text-blue-500">
                    {moveNoteMutation.isPending ? "Moving…" : "Move"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ))}
    </>
  );
}

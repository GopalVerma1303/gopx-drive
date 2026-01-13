"use client";

import { MarkdownEditor } from "@/components/markdown-editor";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { createNote, getNoteById, updateNote } from "@/lib/notes";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, Check, Edit, Eye } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function NoteEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useThemeColors();
  const isNewNote = id === "new";

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(isNewNote);
  const titleInputRef = useRef<typeof Input>(null);

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

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        // @ts-ignore: Input ref may not type focus, but it exists on the instance
        titleInputRef.current?.focus?.();
      }, 100);
    }
  }, [isEditingTitle]);

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

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
  };

  const displayTitle = title || (isNewNote ? "New Note" : "Untitled");

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
          title: "",
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
          headerLeft: () => (
            <View className="flex-row items-center flex-1 pr-4">
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.back();
                }}
                className="pl-2"
              >
                <ArrowLeft color={colors.foreground} size={24} />
              </Pressable>
              <View className="flex-row items-center flex-1 ml-2">
                {isEditingTitle ? (
                  <Input
                    // @ts-ignore: Input ref may not type focus, but it exists on the instance
                    ref={titleInputRef as any}
                    value={title}
                    onChangeText={setTitle}
                    onBlur={handleTitleBlur}
                    onSubmitEditing={handleTitleBlur}
                    placeholder="Title"
                    placeholderTextColor={colors.mutedForeground}
                    style={{
                      flex: 1,
                      color: colors.foreground,
                      fontSize: 18,
                      fontWeight: "600",
                    }}
                    returnKeyType="done"
                  />
                ) : (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setIsEditingTitle(true);
                    }}
                    style={{ flex: 1 }}
                  >
                    <Text
                      className="text-lg font-semibold"
                      style={{ color: colors.foreground }}
                    >
                      {displayTitle}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          ),
          headerRight: () => (
            <View className="flex-row items-center">
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsPreview(!isPreview);
                }}
                className="p-2 mr-1"
              >
                {isPreview ? (
                  <Edit color={colors.foreground} size={24} />
                ) : (
                  <Eye color={colors.foreground} size={24} />
                )}
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={saveMutation.isPending}
                className="p-2"
              >
                <Check color={colors.foreground} size={24} />
              </Pressable>
            </View>
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
          <View className="flex-1 p-5 pb-0 w-full max-w-2xl mx-auto bg-foreground/5 rounded-2xl">
            <MarkdownEditor
              value={content}
              onChangeText={setContent}
              placeholder="Start writing in markdown...\n\n# Heading\n**Bold** *Italic*\n- List item\n\n```\nCode block\n```"
              isPreview={isPreview}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

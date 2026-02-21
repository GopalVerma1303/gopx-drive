"use client";

import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { listArchivedNotes, listNotes, updateNote } from "@/lib/notes";
import { invalidateNotesQueries } from "@/lib/query-utils";
import type { Note } from "@/lib/supabase";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft, Check, FileText, Link, Unlink } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function getShareBaseUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_APP_URL ?? "https://drive.gopx.dev";
}

export default function SharedNotesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();

  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [noteToDisable, setNoteToDisable] = useState<Note | null>(null);
  const [copiedLinkNoteId, setCopiedLinkNoteId] = useState<string | null>(null);

  const { data: notes = [], isLoading: notesLoading, refetch: refetchNotes, isRefetching: notesRefetching } = useQuery({
    queryKey: ["notes", user?.id],
    queryFn: () => listNotes(user?.id),
    enabled: !!user?.id,
  });

  const { data: archivedNotes = [], refetch: refetchArchived, isRefetching: archivedRefetching } = useQuery({
    queryKey: ["archivedNotes", user?.id],
    queryFn: () => listArchivedNotes(user?.id),
    enabled: !!user?.id,
  });

  const refreshing = notesRefetching || archivedRefetching;
  const onRefresh = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await Promise.all([refetchNotes(), refetchArchived()]);
  };

  const sharedNotes = useMemo(() => {
    const all = [...notes, ...archivedNotes];
    return all.filter((n) => n.share_token);
  }, [notes, archivedNotes]);

  const disableShareMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const updated = await updateNote(noteId, { share_token: null });
      return updated;
    },
    onSuccess: (_, noteId) => {
      if (user?.id) invalidateNotesQueries(queryClient, user.id);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setDisableModalOpen(false);
      setNoteToDisable(null);
    },
    onError: (e: Error) => {
      Alert.alert("Error", e.message ?? "Failed to disable sharing");
    },
  });

  const openDisableModal = (note: Note) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setNoteToDisable(note);
    setDisableModalOpen(true);
  };

  const closeDisableModal = () => {
    setDisableModalOpen(false);
    setNoteToDisable(null);
  };

  const confirmDisable = () => {
    if (!noteToDisable) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    disableShareMutation.mutate(noteToDisable.id);
  };

  const handleCopyLink = async (note: Note) => {
    if (!note.share_token) return;
    const shareUrl = `${getShareBaseUrl()}/share/${note.share_token}`;
    try {
      await Clipboard.setStringAsync(shareUrl);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setCopiedLinkNoteId(note.id);
      setTimeout(() => setCopiedLinkNoteId(null), 1500);
    } catch {
      // clipboard not available
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        className="border-b border-border"
        style={{
          paddingTop: insets.top,
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        }}
      >
        <View className="flex-row items-center justify-between h-14 px-4">
          <View className="flex-row items-center flex-1">
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                router.replace("/(app)/settings");
              }}
              className="p-2 -ml-2 mr-2"
            >
              <ArrowLeft color={colors.foreground} size={24} />
            </Pressable>
            <Text className="text-lg font-semibold text-foreground">
              Manage Shared Notes
            </Text>
          </View>
        </View>
      </View>

      {notesLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.foreground} />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4 pb-8"
          refreshControl={
            <RefreshControl
              progressBackgroundColor={colors.background}
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.foreground}
              colors={[colors.foreground]}
            />
          }
        >
          {sharedNotes.length === 0 ? (
            <View className="flex-1 items-center justify-center pt-24">
              <FileText
                color={colors.mutedForeground}
                size={48}
                strokeWidth={1.5}
              />
              <Text className="mt-4 text-center text-muted-foreground text-base max-w-[280px]">
                You haven&apos;t shared any notes yet. Share a note from its
                detail screen to see it here.
              </Text>
            </View>
          ) : (
            <View className="w-full max-w-2xl mx-auto">
              <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Shared notes ({sharedNotes.length})
              </Text>
              <View className="rounded-2xl border border-border bg-muted overflow-hidden">
                {sharedNotes.map((note, index) => (
                  <View
                    key={note.id}
                    className={
                      index > 0
                        ? "flex-row items-center gap-3 px-4 py-3 border-t border-border"
                        : "flex-row items-center gap-3 px-4 py-3"
                    }
                  >
                    <FileText
                      color={colors.mutedForeground}
                      size={20}
                      strokeWidth={2}
                    />
                    <Text
                      className="flex-1 text-foreground text-base font-medium min-w-0"
                      numberOfLines={1}
                    >
                      {note.title || "Untitled"}
                    </Text>
                    <Pressable
                      onPress={() => handleCopyLink(note)}
                      className="p-2 rounded-lg active:opacity-70"
                      accessibilityLabel="Copy share link"
                    >
                      {copiedLinkNoteId === note.id ? (
                        <Check color="#3b82f6" size={20} strokeWidth={2} />
                      ) : (
                        <Link color="#3b82f6" size={20} strokeWidth={2} />
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => openDisableModal(note)}
                      className="p-2 rounded-lg active:opacity-70"
                      accessibilityLabel="Disable sharing link"
                    >
                      <Unlink
                        color="#ef4444"
                        size={20}
                        strokeWidth={2}
                      />
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Disable sharing link confirmation modal — classNames only */}
      {Platform.OS === "web" ? (
        disableModalOpen && (
          <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Pressable
              className="absolute inset-0"
              onPress={closeDisableModal}
            />
            <View className="w-full max-w-[400px] rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">
                Disable sharing link
              </Text>
              <Text className="mb-6 text-sm text-muted-foreground">
                {noteToDisable
                  ? `Stop sharing "${(noteToDisable.title || "Untitled").slice(0, 50)}${(noteToDisable.title?.length ?? 0) > 50 ? "…" : ""}"? The link will no longer work.`
                  : "Stop sharing this note? The link will no longer work."}
              </Text>
              <View className="flex-row justify-end gap-3">
                <Pressable
                  className="px-4 py-2"
                  onPress={closeDisableModal}
                  disabled={disableShareMutation.isPending}
                >
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className="rounded-md px-4 py-2"
                  onPress={confirmDisable}
                  disabled={disableShareMutation.isPending}
                >
                  <Text className="font-semibold text-red-500">
                    {disableShareMutation.isPending ? "Disabling…" : "Disable link"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )
      ) : (
        <Modal
          visible={disableModalOpen}
          transparent
          animationType="fade"
          onRequestClose={closeDisableModal}
        >
          <View className="flex-1 items-center justify-center bg-black/50 p-4">
            <Pressable
              className="absolute inset-0"
              onPress={closeDisableModal}
            />
            <View className="w-full max-w-[400px] rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">
                Disable sharing link
              </Text>
              <Text className="mb-6 text-sm text-muted-foreground">
                {noteToDisable
                  ? `Stop sharing "${(noteToDisable.title || "Untitled").slice(0, 50)}${(noteToDisable.title?.length ?? 0) > 50 ? "…" : ""}"? The link will no longer work.`
                  : "Stop sharing this note? The link will no longer work."}
              </Text>
              <View className="flex-row justify-end gap-3">
                <Pressable
                  className="px-4 py-2"
                  onPress={closeDisableModal}
                  disabled={disableShareMutation.isPending}
                >
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className="rounded-md px-4 py-2"
                  onPress={confirmDisable}
                  disabled={disableShareMutation.isPending}
                >
                  <Text className="font-semibold text-red-500">
                    {disableShareMutation.isPending ? "Disabling…" : "Disable link"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

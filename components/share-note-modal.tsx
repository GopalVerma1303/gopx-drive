"use client";

import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { updateNote } from "@/lib/notes";
import { useThemeColors } from "@/lib/use-theme-colors";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Check, Link, Share2 } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Modal, Platform, Pressable, View } from "react-native";

function generateShareToken(): string {
  const length = 12;
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => chars[b % chars.length]).join("");
  }
  let s = "";
  for (let i = 0; i < length; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

function getShareBaseUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_APP_URL ?? "https://drive.gopx.dev";
}

export interface ShareNoteModalProps {
  visible: boolean;
  onClose: () => void;
  noteId: string;
  shareToken: string | null | undefined;
  onShareTokenChange: (token: string | null) => void;
}

export function ShareNoteModal({
  visible,
  onClose,
  noteId,
  shareToken,
  onShareTokenChange,
}: ShareNoteModalProps) {
  const { colors } = useThemeColors();
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);

  const isShared = !!shareToken;
  const shareUrl = shareToken
    ? `${getShareBaseUrl()}/share/${shareToken}`
    : "";

  useEffect(() => {
    if (!visible) {
      setCopied(false);
    }
  }, [visible]);

  const handleToggle = useCallback(
    async (enabled: boolean) => {
      setToggling(true);
      try {
        if (enabled) {
          const token = generateShareToken();
          await updateNote(noteId, { share_token: token });
          onShareTokenChange(token);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          await updateNote(noteId, { share_token: null });
          onShareTokenChange(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to update share";
        if (Platform.OS !== "web") {
          const { Alert } = require("react-native");
          Alert.alert("Error", message);
        }
      } finally {
        setToggling(false);
      }
    },
    [noteId, onShareTokenChange]
  );

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await Clipboard.setStringAsync(shareUrl);
      setCopied(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }, [shareUrl]);

  const overlayContent = (
    <>
      <Pressable className="absolute inset-0" onPress={onClose} />
      <View className="w-full max-w-[400px] rounded-lg border border-border bg-muted p-6 shadow-lg shadow-black/5">
        <View className="mb-4 flex-row items-center gap-3">
          <Share2 color={colors.foreground} size={22} strokeWidth={2} />
          <Text className="text-lg font-semibold text-foreground">
            Share note
          </Text>
        </View>

        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-[15px] text-foreground">
            Enable share
          </Text>
          <View className="rounded-full border border-border bg-background">
            <Switch
              checked={isShared}
              onCheckedChange={handleToggle}
              disabled={toggling}
            />
          </View>
        </View>

        {isShared && (
          <>
            <Text className="mb-2 text-sm text-muted-foreground">
              Anyone with this link can view the note.
            </Text>
            <Pressable
              onPress={handleCopy}
              className="mt-2 mb-4 flex-row items-center justify-center gap-2 self-start rounded-md bg-foreground/10 px-3 py-2.5 w-full"
            >
              {copied ? (
                <Check
                  color={colors.foreground}
                  size={18}
                  strokeWidth={2}
                />
              ) : (
                <Link
                  color={colors.foreground}
                  size={18}
                  strokeWidth={2}
                />
              )}
              <Text className="text-sm font-medium text-foreground">
                {copied ? "Copied!" : "Copy link"}
              </Text>
            </Pressable>
          </>
        )}

        <View className="flex-row justify-end">
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              onClose();
            }}
            className="py-2 pl-4 pr-0"
          >
            <Text className="font-medium text-foreground">Done</Text>
          </Pressable>
        </View>
      </View>
    </>
  );

  if (Platform.OS === "web") {
    if (!visible) return null;
    return (
      <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        {overlayContent}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/50 p-4">
        {overlayContent}
      </View>
    </Modal>
  );
}

"use client";

import { MarkdownEditor } from "@/components/markdown-editor";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getNoteByShareToken } from "@/lib/notes";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, Copy } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GopxDriveIcon = require("@/assets/images/favicon.png");

function formatLastUpdated(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    const timeStr = d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
    if (diffDays < 1) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    if (diffDays === 1) return `Yesterday at ${timeStr}`;
    if (diffDays < 7) return `${d.toLocaleDateString(undefined, { weekday: "long" })} at ${timeStr}`;
    if (d.getFullYear() === now.getFullYear()) {
      return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at ${timeStr}`;
    }
    return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} at ${timeStr}`;
  } catch {
    return iso;
  }
}

export default function SharedNoteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();

  const { data: note, isLoading, error } = useQuery({
    queryKey: ["shared-note", token],
    queryFn: () => getNoteByShareToken(token ?? ""),
    enabled: !!token,
  });

  const openGopxDrive = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(`${window.location.origin}/`, "_blank", "noopener,noreferrer");
    } else {
      router.push("/");
    }
  };

  const [copied, setCopied] = useState(false);
  const handleCopyContent = useCallback(async () => {
    if (!note?.content) return;
    try {
      await Clipboard.setStringAsync(note.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }, [note?.content]);

  if (isLoading || !token) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.foreground} />
      </View>
    );
  }

  if (error || !note) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
          padding: 24,
        }}
      >
        <Text style={{ color: colors.foreground, fontSize: 18, textAlign: "center" }}>
          This link is invalid or the note is no longer shared.
        </Text>
      </View>
    );
  }

  // Match note editor page layout: bg-background → inner max-w-2xl bg-muted → ScrollView with same padding as preview
  const contentPaddingTop = 20 + insets.top;
  const contentPaddingBottom = 80 + insets.bottom;

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.background }}
      className="flex-1 bg-background"
    >
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 672,
          alignSelf: "center",
          backgroundColor: colors.muted,
        }}
        className="flex-1 w-full max-w-2xl mx-auto bg-muted"
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 32,
            paddingTop: contentPaddingTop,
            paddingBottom: contentPaddingBottom,
            flexGrow: 1,
            ...(Platform.OS === "web" ? { minHeight: "100%" } : {}),
          }}
          removeClippedSubviews={false}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              paddingBottom: 30,
              marginBottom: 30,
              borderBottomWidth: 0,
              borderBottomColor: colors.ring,
              alignItems: "flex-start",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                width: "100%",
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 18,
                  fontWeight: "600",
                  flex: 1,
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {note.title || "Untitled"}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Pressable
                  onPress={handleCopyContent}
                  disabled={!note.content}
                  style={({ pressed }) => ({
                    opacity: note.content ? (pressed ? 0.7 : 1) : 0.4,
                    padding: 8,
                    borderRadius: 8,
                  })}
                  accessibilityLabel={copied ? "Copied" : "Copy markdown"}
                  accessibilityRole="button"
                >
                  {copied ? (
                    <Check size={20} color={colors.primary} />
                  ) : (
                    <Copy size={20} color={colors.foreground} />
                  )}
                </Pressable>
                <ThemeToggle size={20} />
              </View>
            </View>
            <View
              style={{
                flexDirection: "column",
                gap: 4,
              }}
            >
              <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
                Last updated: {formatLastUpdated(note.updated_at)}
              </Text>
              {note.shared_by_email ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
                  Shared by: {note.shared_by_email}
                </Text>
              ) : null}
            </View>
          </View>
          {note.content ? (
            <MarkdownEditor
              value={note.content}
              isPreview
              previewOnly
              noScrollView
              placeholder=""
            />
          ) : (
            <Text style={{ color: colors.mutedForeground, fontStyle: "italic", fontSize: 16 }}>
              No content
            </Text>
          )}

          <View
            style={{
              marginTop: 40,
              paddingTop: 40,
              borderTopWidth: 0,
              borderTopColor: colors.ring,
              alignItems: "center",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 13,
              }}
            >
              Note taken on
            </Text>
            <Pressable
              onPress={openGopxDrive}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              })}
            >
              <Image
                source={GopxDriveIcon}
                style={{ width: 16, height: 16 }}
                resizeMode="contain"
                className="filter dark:invert rounded-[2px]"
              />
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                Gopx Drive
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

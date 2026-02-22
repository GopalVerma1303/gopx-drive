"use client";

import { MarkdownEditor } from "@/components/markdown-editor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getNoteByShareToken } from "@/lib/notes";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import { Check, Copy, Info } from "lucide-react-native";
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

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function wordCount(text: string): number {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

/** Plain-text snippet for meta description: strip markdown, truncate to ~155 chars. */
function metaDescriptionFromContent(content: string | null | undefined): string {
  if (!content?.trim()) return "A note shared with you on Gopx Drive.";
  const plain = content
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`[^`]+`/g, "")
    .replace(/\n+/g, " ")
    .trim();
  const max = 155;
  if (plain.length <= max) return plain;
  return plain.slice(0, max).trim().replace(/\s+\S*$/, "") + "…";
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

  // Meta / OG for web: brief info for shared note (or generic/error state)
  const metaTitle = note
    ? `${note.title?.trim() || "Untitled"} — Gopx Drive`
    : error || !note
      ? "Invalid link — Gopx Drive"
      : "Shared note — Gopx Drive";
  const metaDesc = note
    ? metaDescriptionFromContent(note.content)
    : error || !note
      ? "This link is invalid or the note is no longer shared."
      : "A note shared with you on Gopx Drive. Open to view.";

  if (isLoading || !token) {
    return (
      <>
        <Head>
          <title>Shared note — Gopx Drive</title>
          <meta name="description" content="A note shared with you on Gopx Drive. Open to view." />
          <meta property="og:type" content="website" />
          <meta property="og:title" content="Shared note — Gopx Drive" />
          <meta property="og:description" content="A note shared with you on Gopx Drive. Open to view." />
          <meta property="og:site_name" content="Gopx Drive" />
          <meta name="twitter:card" content="summary" />
          <meta name="twitter:title" content="Shared note — Gopx Drive" />
          <meta name="twitter:description" content="A note shared with you on Gopx Drive. Open to view." />
        </Head>
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
      </>
    );
  }

  if (error || !note) {
    return (
      <>
        <Head>
          <title>{metaTitle}</title>
          <meta name="description" content={metaDesc} />
          <meta property="og:type" content="website" />
          <meta property="og:title" content={metaTitle} />
          <meta property="og:description" content={metaDesc} />
          <meta property="og:site_name" content="Gopx Drive" />
          <meta name="twitter:card" content="summary" />
          <meta name="twitter:title" content={metaTitle} />
          <meta name="twitter:description" content={metaDesc} />
        </Head>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: colors.background,
            padding: 24,
          }}
        >
          <View style={{ alignItems: "center", gap: 24, maxWidth: 320 }}>
            <View style={{ alignItems: "center", gap: 12 }}>
              <Image
                source={GopxDriveIcon}
                style={{ width: 48, height: 48 }}
                resizeMode="contain"
                className="filter dark:invert rounded-[4px]"
              />
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 18,
                  fontWeight: "600",
                  textAlign: "center",
                }}
              >
                Gopx Drive
              </Text>
            </View>
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 16,
                textAlign: "center",
                lineHeight: 22,
              }}
            >
              This link is invalid or the note is no longer shared.
            </Text>
            <Pressable
              onPress={openGopxDrive}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 8,
                backgroundColor: colors.muted,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Image
                source={GopxDriveIcon}
                style={{ width: 18, height: 18 }}
                resizeMode="contain"
                className="filter dark:invert rounded-[2px]"
              />
              <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "600" }}>
                Open Gopx Drive
              </Text>
            </Pressable>
          </View>
        </View>
      </>
    );
  }

  // Status bar matches note detail header: same height, padding, background, and button style
  const contentPaddingHorizontal = 32;
  const contentPaddingBottom = 80 + insets.bottom;

  return (
    <>
      <Head>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDesc} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:site_name" content="Gopx Drive" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDesc} />
      </Head>
      <View
        style={{ flex: 1, backgroundColor: colors.background }}
        className="flex-1 bg-background"
      >
        {/* Status bar — full screen width, same as note detail header */}
        <View
          style={{
            width: "100%",
            paddingTop: insets.top,
            backgroundColor: colors.background,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              height: 56,
              paddingHorizontal: 6,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flex: 1,
                minWidth: 0,
                paddingLeft: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  color: colors.foreground,
                  flex: 1,
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {note.title || "Untitled"}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginLeft: 16,
                paddingRight: 8,
              }}
            >
              <Pressable
                onPress={handleCopyContent}
                disabled={!note.content}
                style={[{ paddingVertical: 8 }, !note.content && { opacity: 0.4 }]}
                accessibilityLabel={copied ? "Copied" : "Copy markdown"}
                accessibilityRole="button"
              >
                {copied ? (
                  <Check size={22} color={colors.primary} strokeWidth={2.5} />
                ) : (
                  <Copy size={22} color={colors.foreground} strokeWidth={2.5} />
                )}
              </Pressable>
              <ThemeToggle className="p-0 py-2" size={22} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Pressable
                    style={({ pressed }) => [{ paddingVertical: 8 }, pressed && { opacity: 1 }]}
                    className="active:bg-transparent focus:outline-none"
                    accessibilityLabel="Note information"
                  >
                    <Info size={22} color={colors.foreground} strokeWidth={2.5} />
                  </Pressable>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="end" className="min-w-[240px]">
                  <DropdownMenuLabel>Note information</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled className="flex flex-col items-start gap-0.5">
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Title</Text>
                    <Text style={{ color: colors.foreground, fontSize: 14 }} numberOfLines={1}>
                      {note.title || "Untitled"}
                    </Text>
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled className="flex flex-col items-start gap-0.5">
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Last updated</Text>
                    <Text style={{ color: colors.foreground, fontSize: 14 }}>
                      {formatDateTime(note.updated_at)}
                    </Text>
                  </DropdownMenuItem>
                  {note.shared_by_email ? (
                    <DropdownMenuItem disabled className="flex flex-col items-start gap-0.5">
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Shared by</Text>
                      <Text style={{ color: colors.foreground, fontSize: 14 }} numberOfLines={1}>
                        {note.shared_by_email}
                      </Text>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem disabled className="flex flex-col items-start gap-0.5">
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Content</Text>
                    <Text style={{ color: colors.foreground, fontSize: 14 }}>
                      {note.content?.length ?? 0} characters · {wordCount(note.content ?? "")} words
                    </Text>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </View>
          </View>
        </View>

        {Platform.OS === "web" ? (
          <ScrollView
            style={{ flex: 1, width: "100%" }}
            contentContainerStyle={{
              flexGrow: 1,
              minHeight: "100%",
            }}
            removeClippedSubviews={false}
            nestedScrollEnabled
            showsVerticalScrollIndicator={true}
          >
            {/* Centered content column: same max-width as before. */}
            <View
              style={{
                flex: 1,
                minHeight: "100%",
                width: "100%",
                maxWidth: 672,
                alignSelf: "center",
                backgroundColor: colors.muted,
                paddingHorizontal: contentPaddingHorizontal,
                paddingTop: 10,
                paddingBottom: contentPaddingBottom,
              }}
              className="w-full max-w-2xl mx-auto bg-muted"
            >
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
            </View>
          </ScrollView>
        ) : (
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
                paddingHorizontal: contentPaddingHorizontal,
                paddingTop: 10,
                paddingBottom: contentPaddingBottom,
                flexGrow: 1,
              }}
              removeClippedSubviews={false}
              nestedScrollEnabled
              showsVerticalScrollIndicator={true}
            >
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
        )}
      </View>
    </>
  );
}

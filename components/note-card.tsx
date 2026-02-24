"use client";

import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/use-theme-colors";
import type { Note } from "@/lib/supabase";
import { Check, CheckCheck } from "lucide-react-native";
import { Platform, Pressable, Animated, View } from "react-native";

export interface NoteCardProps {
  note: Note;
  cardWidth: number;
  /** True when note is synced with Supabase (show double check); false = single check. */
  isSynced: boolean;
  onPress: () => void;
  onDelete: () => void;
  onRightClickDelete?: () => void;
}

function formatNoteDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function NoteCard({
  note,
  cardWidth,
  isSynced,
  onPress,
  onDelete,
  onRightClickDelete,
}: NoteCardProps) {
  const { colors } = useThemeColors();
  const scale = new Animated.Value(1);

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 3,
    }).start();
  };

  const handleContextMenu = (e: any) => {
    if (Platform.OS === "web" && onRightClickDelete) {
      e.preventDefault();
      onRightClickDelete();
    }
  };

  const padding = 16;
  const contentLength = note.content?.length || 0;
  const titleHeight = 24;
  const dateHeight = 14;
  const minContentHeight = 40;
  const maxContentHeight = 120;
  const lines = Math.ceil((contentLength || 0) / 50);
  const contentHeight = Math.min(
    Math.max(minContentHeight, lines * 18),
    maxContentHeight
  );
  const a4MaxHeight = cardWidth * 1.414;
  const calculatedHeight = titleHeight + contentHeight + dateHeight + padding * 2 + 8;
  const cardHeight = Math.min(calculatedHeight, a4MaxHeight);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLongPress={onDelete}
      {...(Platform.OS === "web" && {
        onContextMenu: handleContextMenu,
      })}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Card
          className="rounded-2xl bg-muted border border-border"
          style={{
            width: cardWidth,
            minHeight: cardHeight,
            maxHeight: a4MaxHeight,
            padding,
          }}
        >
          <Text
            className="text-lg font-semibold text-foreground"
            numberOfLines={1}
          >
            {note.title || "Untitled"}
          </Text>
          <Text
            className="text-sm text-muted-foreground leading-4"
            numberOfLines={contentLength > 200 ? 8 : 6}
          >
            {note.content ? note.content : "No content"}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-end",
              marginTop: 8,
              gap: 4,
            }}
          >
            <Text className="text-xs text-muted-foreground/70">
              {formatNoteDate(note.updated_at)}
            </Text>
            {isSynced ? (
              <CheckCheck size={14} color={colors.mutedForeground + "90"} />
            ) : (
              <Check size={14} color={colors.mutedForeground + "90"} />
            )}
          </View>
        </Card>
      </Animated.View>
    </Pressable>
  );
}

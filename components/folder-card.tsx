"use client";

import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Text } from "@/components/ui/text";
import type { Folder } from "@/lib/supabase";
import { useThemeColors } from "@/lib/use-theme-colors";
import { Folder as FolderIcon } from "lucide-react-native";
import { Animated, Pressable, View } from "react-native";

export interface FolderCardProps {
  folder: Folder;
  cardWidth: number;
  onPress: () => void;
  onLongPress?: () => void;
  variant?: "grid" | "list";
  /** When true (e.g. in archive), show checkbox and use onToggleSelect for press */
  isArchived?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

function formatDate(dateString: string) {
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

export function FolderCard({
  folder,
  cardWidth,
  onPress,
  onLongPress,
  variant = "list",
  isArchived = false,
  isSelected = false,
  onToggleSelect,
}: FolderCardProps) {
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

  const padding = 14;
  const iconSize = 40;

  const gridIconHeight = (cardWidth / 130) * 150;
  const gridIconSize = Math.min(cardWidth, gridIconHeight);
  const gridInfoMarginTop = 4 - Math.round(gridIconSize * 0.12);

  const handlePress = () => {
    if (isArchived && onToggleSelect) {
      onToggleSelect();
    } else {
      onPress();
    }
  };

  const content =
    variant === "grid" ? (
      <View className="items-center">
        <FolderIcon
          color={colors.muted}
          fill={colors.muted}
          size={gridIconSize}
          strokeWidth={1}
        />
        <View className="items-center" style={{ width: cardWidth, marginTop: gridInfoMarginTop }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.foreground,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {folder.name || "Unnamed folder"}
          </Text>
          <Text
            style={{
              fontSize: 11,
              color: colors.mutedForeground,
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            Updated {formatDate(folder.updated_at)}
          </Text>
        </View>
      </View>
    ) : (
      <Card
        className="rounded-2xl border border-border overflow-hidden"
        style={{
          width: cardWidth,
          minHeight: 72,
          padding,
          backgroundColor: colors.muted,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flex: 1,
            gap: 12,
            minHeight: 44,
          }}
        >
          {isArchived && (
            <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
          )}
          <FolderIcon
            color={colors.foreground}
            fill={colors.foreground}
            size={iconSize}
            strokeWidth={0}
          />
          <View
            style={{
              flex: 1,
              minWidth: 0,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: colors.foreground,
                flex: 1,
              }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {folder.name || "Unnamed folder"}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: colors.mutedForeground,
              }}
              numberOfLines={1}
            >
              Updated {formatDate(folder.updated_at)}
            </Text>
          </View>
        </View>
      </Card>
    );

  const inner = (
    <Animated.View style={{ transform: [{ scale }] }}>
      {content}
    </Animated.View>
  );

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={isArchived ? undefined : onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {inner}
    </Pressable>
  );
}

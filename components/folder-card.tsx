"use client";

import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Text } from "@/components/ui/text";
import type { Folder } from "@/lib/supabase";
import { useThemeColors } from "@/lib/use-theme-colors";
import { Folder as FolderIcon } from "lucide-react-native";
import { useRef } from "react";
import { Animated, Pressable, View } from "react-native";

const DOUBLE_TAP_DELAY_MS = 280;

export interface FolderCardProps {
  folder: Folder;
  cardWidth: number;
  onPress: () => void;
  /** Fires on double-tap (replaces long-press). */
  onDoubleTap?: () => void;
  variant?: "grid" | "list";
  /** When true (e.g. in archive), show checkbox and use onToggleSelect for press */
  isArchived?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export function FolderCard({
  folder,
  cardWidth,
  onPress,
  onDoubleTap,
  variant = "list",
  isArchived = false,
  isSelected = false,
  onToggleSelect,
}: FolderCardProps) {
  const { colors } = useThemeColors();
  const scale = new Animated.Value(1);
  const lastTapTime = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      return;
    }
    if (onDoubleTap) {
      const now = Date.now();
      if (now - lastTapTime.current < DOUBLE_TAP_DELAY_MS) {
        if (singleTapTimer.current) {
          clearTimeout(singleTapTimer.current);
          singleTapTimer.current = null;
        }
        lastTapTime.current = 0;
        onDoubleTap();
        return;
      }
      lastTapTime.current = now;
      singleTapTimer.current = setTimeout(() => {
        singleTapTimer.current = null;
        onPress();
      }, DOUBLE_TAP_DELAY_MS);
    } else {
      onPress();
    }
  };

  const content =
    variant === "grid" ? (
      <View className="items-center">
        <FolderIcon
          color={colors.ring}
          fill={colors.muted}
          size={gridIconSize}
          strokeWidth={0.1}
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
          {isArchived && onToggleSelect && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect()}
            />
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
          </View>
        </View>
      </Card>
    );

  const inner = (
    <Animated.View style={{ transform: [{ scale }] }}>
      {content}
    </Animated.View>
  );

  const handleLongPress = () => {
    if (onDoubleTap && !isArchived) {
      if (singleTapTimer.current) {
        clearTimeout(singleTapTimer.current);
        singleTapTimer.current = null;
      }
      lastTapTime.current = 0;
      onDoubleTap();
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLongPress={handleLongPress}
    >
      {inner}
    </Pressable>
  );
}

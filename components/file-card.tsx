"use client";

import { Text } from "@/components/ui/text";
import type { File as FileRecord } from "@/lib/supabase";
import { useThemeColors } from "@/lib/use-theme-colors";
import { Animated, Platform, Pressable, View } from "react-native";

function formatFileDate(dateString: string) {
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

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export interface FileCardProps {
  file: FileRecord;
  onPress: () => void;
  onDelete: () => void;
  onRightClickAction?: () => void;
  formatFileSize: (bytes: number) => string;
  cardWidth: number;
}

export function FileCard({
  file,
  onPress,
  onDelete,
  onRightClickAction,
  formatFileSize: formatFileSizeProp,
  cardWidth,
}: FileCardProps) {
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
    if (Platform.OS === "web" && onRightClickAction) {
      e.preventDefault();
      onRightClickAction();
    }
  };

  const padding = 8;
  const fileWidth = cardWidth - padding * 2;
  const fileHeight = (fileWidth / 130) * 150;
  const foldSize = Math.max(20, fileWidth * 0.2);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      onLongPress={onDelete}
      {...(Platform.OS === "web" && {
        onContextMenu: handleContextMenu,
      })}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View className="mb-3 items-center">
          <View
            className="bg-muted rounded-tl rounded-br rounded-bl overflow-hidden relative"
            style={{ width: fileWidth, height: fileHeight }}
          >
            <View
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 0,
                height: 0,
                borderTopWidth: foldSize,
                borderRightWidth: foldSize,
                borderTopColor: colors.background,
                borderRightColor: "transparent",
                borderBottomWidth: 0,
                borderLeftWidth: 0,
                opacity: 1,
                transform: [{ rotate: "90deg" }],
              }}
            />
            <View
              className="flex-1 p-3 pt-4 justify-between"
              style={{ paddingRight: foldSize + 4 }}
            >
              <View className="flex-1">
                <Text
                  className="text-sm font-semibold text-foreground mb-1"
                  numberOfLines={2}
                >
                  {file.name.length > 15
                    ? file.name.substring(0, 15) + "..."
                    : file.name}
                </Text>
                <Text className="text-[10px] text-muted-foreground mt-1">
                  {file.extension.toUpperCase()}
                </Text>
              </View>
              <View className="mt-auto">
                <Text className="text-[9px] text-muted-foreground opacity-70">
                  {formatFileSizeProp(file.file_size)}
                </Text>
              </View>
            </View>
          </View>
          <View className="mt-2 items-center" style={{ width: cardWidth }}>
            <Text
              className="text-xs font-medium text-foreground text-center"
              numberOfLines={1}
            >
              {file.name}
            </Text>
            <Text className="text-[10px] text-muted-foreground mt-0.5">
              {formatFileDate(file.updated_at)}
            </Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export interface FileListCardProps {
  file: FileRecord;
  onPress: () => void;
  onDelete: () => void;
  onRightClickAction?: () => void;
  formatFileSize: (bytes: number) => string;
  cardWidth: number;
}

export function FileListCard({
  file,
  onPress,
  onDelete,
  onRightClickAction,
  formatFileSize: formatFileSizeProp,
  cardWidth,
}: FileListCardProps) {
  const { colors } = useThemeColors();
  const scale = new Animated.Value(1);
  // Softer icon bg (muted) so contrast isn’t too strong; text stays readable with foreground
  const iconBg = colors.foreground + "90";
  const iconText = colors.background;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.98,
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
    if (Platform.OS === "web" && onRightClickAction) {
      e.preventDefault();
      onRightClickAction();
    }
  };

  const cardHeight = 80;
  const iconSize = 56;
  const padding = 12;
  const foldSize = Math.max(12, iconSize * 0.2);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      onLongPress={onDelete}
      {...(Platform.OS === "web" && {
        onContextMenu: handleContextMenu,
      })}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View
          className="flex-row items-center p-3 gap-3 bg-muted border border-border rounded-xl"
          style={{ width: cardWidth, height: cardHeight }}
        >
          <View
            className="border border-muted rounded-tl rounded-br rounded-bl overflow-hidden relative"
            style={{
              width: iconSize,
              height: iconSize,
              backgroundColor: iconBg,
            }}
          >
            <View
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 0,
                height: 0,
                borderTopWidth: foldSize,
                borderRightWidth: foldSize,
                borderTopColor: colors.muted,
                borderRightColor: "transparent",
                borderBottomWidth: 0,
                borderLeftWidth: 0,
                opacity: 1,
                transform: [{ rotate: "90deg" }],
              }}
            />
            <View
              className="flex-1 pt-2 justify-between"
              style={{ padding: 6, paddingRight: foldSize + 2 }}
            >
              <Text
                className="text-[8px] font-semibold"
                style={{ color: iconText }}
                numberOfLines={1}
              >
                {file.extension.toUpperCase().slice(0, 3)}
              </Text>
              <View className="mt-auto">
                <Text
                  className="text-[6px] opacity-70"
                  style={{ color: iconText }}
                >
                  {formatFileSizeProp(file.file_size)}
                </Text>
              </View>
            </View>
          </View>
          <View className="flex-1 justify-center gap-1">
            <Text
              className="text-sm font-semibold text-foreground"
              numberOfLines={1}
            >
              {file.name}
            </Text>
            <View className="flex-row items-center gap-2">
              <Text className="text-[11px] text-muted-foreground uppercase">
                {file.extension}
              </Text>
              <Text className="text-[11px] text-muted-foreground">•</Text>
              <Text className="text-[11px] text-muted-foreground">
                {formatFileSizeProp(file.file_size)}
              </Text>
              <Text className="text-[11px] text-muted-foreground">•</Text>
              <Text className="text-[11px] text-muted-foreground">
                {formatFileDate(file.updated_at)}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

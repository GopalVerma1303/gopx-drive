"use client";

import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import type { Tag } from "@/lib/supabase-tags";
import { useThemeColors } from "@/lib/use-theme-colors";
import * as Haptics from "expo-haptics";
import { Plus } from "lucide-react-native";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { twMerge } from "tailwind-merge";

interface TagRowProps {
  tags: Tag[];
  selectedTagId: string | null;
  onTagPress: (tagId: string | null) => void;
  onTagLongPress: (tag: Tag) => void;
  onCreateTag: () => void;
}

export function TagRow({
  tags,
  selectedTagId,
  onTagPress,
  onTagLongPress,
  onCreateTag,
}: TagRowProps) {
  const { colors } = useThemeColors();

  const handleTagPress = (tagId: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Always select the tag (no deselect - default tag will always be active)
    onTagPress(tagId);
  };

  const handleTagLongPress = (tag: Tag) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onTagLongPress(tag);
  };

  const handleCreatePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onCreateTag();
  };

  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: 8,
          paddingRight: 16,
          alignItems: "center",
        }}
        scrollEventThrottle={16}
        bounces={false}
        scrollEnabled={true}
        directionalLockEnabled={true}
      >

        {/* All Tags */}
        {tags.map((tag) => {
          const isSelected = selectedTagId === tag.id;
          return (
            <Pressable
              key={tag.id}
              onPress={() => handleTagPress(tag.id)}
              onLongPress={() => handleTagLongPress(tag)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              delayLongPress={500}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ 
                alignSelf: 'center',
                flexShrink: 0,
              }}
            >
              <Badge
                variant={isSelected ? "default" : "outline"}
                className={twMerge("border-1 border-border bg-muted py-2 px-4 rounded-full", isSelected ? "bg-foreground text-muted" : "bg-muted text-foreground")}
              >
                <Text>{tag.name}</Text>
              </Badge>
            </Pressable>
          );
        })}
        {/* Create Tag Button */}
        <Pressable
          onPress={handleCreatePress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ 
            alignSelf: 'center',
            flexShrink: 0,
          }}
        >
          <Badge
            variant="outline"
            className="border-1 border-border bg-muted py-2 px-2 rounded-full"
            style={{
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Plus size={14} color={colors.foreground} strokeWidth={2.5} />
          </Badge>
        </Pressable>
      </ScrollView>
    </View>
  );
}

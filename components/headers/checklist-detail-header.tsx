import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/use-theme-colors";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ChecklistDetailHeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  isNewChecklist: boolean;
  isDirty: boolean;
  canSave: boolean;
  onSave: () => void;
}

export function ChecklistDetailHeader({
  title,
  onTitleChange,
  isNewChecklist,
  isDirty,
  canSave,
  onSave,
}: ChecklistDetailHeaderProps) {
  const router = useRouter();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [isEditingTitle, setIsEditingTitle] = useState(isNewChecklist);
  const titleInputRef = useRef<typeof Input>(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      setTimeout(() => {
        // @ts-ignore: Input ref may not type focus, but it exists on the instance
        titleInputRef.current?.focus?.();
      }, 100);
    }
  }, [isEditingTitle]);

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
  };

  const displayTitle = title || (isNewChecklist ? "New Checklist" : "Untitled");

  return (
    <View
      style={{
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
          paddingHorizontal: 16,
        }}
      >
        {/* Left: Back button and title */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flex: 1,
          }}
        >
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={{ padding: 8 }}
          >
            <ArrowLeft color={colors.foreground} size={24} />
          </Pressable>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flex: 1,
              marginLeft: 8,
            }}
          >
            {isEditingTitle ? (
              <Input
                // @ts-ignore: Input ref may not type focus, but it exists on the instance
                ref={titleInputRef as any}
                value={title}
                onChangeText={onTitleChange}
                onBlur={handleTitleBlur}
                onSubmitEditing={handleTitleBlur}
                placeholder="Title"
                placeholderTextColor={colors.mutedForeground}
                style={{
                  flex: 1,
                  color: colors.foreground,
                  fontSize: 18,
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
                  style={{
                    fontSize: 18,
                    color: colors.foreground,
                  }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {displayTitle}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Right: Save button */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Pressable
            onPress={onSave}
            disabled={!canSave}
            style={[{ padding: 8 }, !canSave && { opacity: 0.4 }]}
          >
            <Check
              color={canSave ? colors.foreground : colors.mutedForeground}
              size={22}
              strokeWidth={2.5}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/use-theme-colors";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ArrowLeft, Check, Edit, Eye, MoreVertical, RefreshCcw, Share2 } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/icon";

interface NoteDetailHeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  isNewNote: boolean;
  isDirty: boolean;
  canSave: boolean;
  onSave: () => void;
  isPreview: boolean;
  onPreviewToggle: () => void;
  isFetching?: boolean;
  onRefresh?: () => void;
  onOpenShareModal?: () => void;
}

export function NoteDetailHeader({
  title,
  onTitleChange,
  isNewNote,
  isDirty,
  canSave,
  onSave,
  isPreview,
  onPreviewToggle,
  isFetching = false,
  onRefresh,
  onOpenShareModal,
}: NoteDetailHeaderProps) {
  const router = useRouter();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [isEditingTitle, setIsEditingTitle] = useState(isNewNote);
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

  const displayTitle = title || (isNewNote ? "New Note" : "Untitled");

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: colors.background,
        borderBottomWidth: 0,
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
              if (router.canGoBack?.()) {
                router.back();
              } else {
                router.replace("/notes");
              }
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

        {/* Right: Action buttons */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onPreviewToggle();
            }}
            style={{ padding: 8 }}
          >
            {isPreview ? (
              <Edit color={colors.foreground} size={22} strokeWidth={2.5} />
            ) : (
              <Eye color={colors.foreground} size={22} strokeWidth={2.5} />
            )}
          </Pressable>
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
          {!isNewNote && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Pressable
                  onPress={() =>
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }
                  style={{ padding: 8 }}
                >
                  <MoreVertical
                    color={colors.foreground}
                    size={22}
                    strokeWidth={2.5}
                  />
                </Pressable>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="end">
                {onRefresh && (
                  <DropdownMenuItem
                    onPress={onRefresh}
                    disabled={isFetching}
                    className="flex flex-row items-center gap-2"
                  >
                    <Icon as={RefreshCcw} className="size-4 text-foreground" />
                    <Text style={{ color: colors.foreground }}>Sync</Text>
                  </DropdownMenuItem>
                )}
                {onOpenShareModal && (
                  <DropdownMenuItem
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onOpenShareModal();
                    }}
                    className="flex flex-row items-center gap-2"
                  >
                    <Icon as={Share2} className="size-4 text-foreground" />
                    <Text style={{ color: colors.foreground }}>Share</Text>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </View>
      </View>
    </View>
  );
}

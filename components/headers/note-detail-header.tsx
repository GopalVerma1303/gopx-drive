import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/use-theme-colors";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ArrowLeft, Check, Edit, Eye, Folder, MoreVertical, RefreshCcw, Share2 } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, View } from "react-native";
import { KeyboardController } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface NoteDetailHeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  isNewNote: boolean;
  isDirty: boolean;
  canSave: boolean;
  /** True while save is in progress (Supabase or local). Show spinner instead of tick. */
  isSaving?: boolean;
  onSave: () => void;
  isPreview: boolean;
  onPreviewToggle: () => void;
  isFetching?: boolean;
  onRefresh?: () => void;
  onOpenShareModal?: () => void;
  /** Current folder name for the note (e.g. "Work" or "No folder"). When set, shows a "Folder" menu item that opens the Move to modal. */
  folderName?: string;
  onOpenMoveModal?: () => void;
}

export function NoteDetailHeader({
  title,
  onTitleChange,
  isNewNote,
  isDirty,
  canSave,
  isSaving = false,
  onSave,
  isPreview,
  onPreviewToggle,
  isFetching = false,
  onRefresh,
  onOpenShareModal,
  folderName,
  onOpenMoveModal,
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
        {/* Left: Back button and title */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flex: 1
          }}
        >
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const navigate = () => {
                if (router.canGoBack?.()) {
                  router.back();
                } else {
                  router.replace("/notes");
                }
              };
              if (Platform.OS === "web") {
                navigate();
              } else {
                KeyboardController.dismiss().then(navigate);
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

        {/* Right: Action buttons — paddingRight matches left back button padding (8) for equal edge spacing */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
            marginLeft: 16,
            paddingRight: 8,
          }}
        >
          <Pressable
            onPress={onSave}
            disabled={!canSave || isSaving}
            style={[
              { paddingVertical: 8, minWidth: 22, alignItems: "center", justifyContent: "center" },
              !canSave && !isSaving && { opacity: 0.4 },
            ]}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <Check
                color={canSave ? colors.foreground : colors.mutedForeground}
                size={22}
              />
            )}
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onPreviewToggle();
            }}
            style={{ paddingVertical: 8 }}
          >
            {isPreview ? (
              <Edit color={colors.foreground} size={22} />
            ) : (
              <Eye color={colors.foreground} size={22} />
            )}
          </Pressable>
          {!isNewNote && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Pressable
                  onPress={() =>
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }
                  style={{ paddingVertical: 8 }}
                  className="bg-transparent data-[state=open]:bg-transparent focus-visible:outline-none focus-visible:ring-0"
                >
                  <MoreVertical
                    color={colors.foreground}
                    size={22}
                  />
                </Pressable>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="end">
                {onRefresh && (
                  <DropdownMenuItem
                    onPress={() => {
                      // Defer so the handler runs after the menu closes (avoids native modal unmount races)
                      setTimeout(() => onRefresh(), 0);
                    }}
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
                {onOpenMoveModal != null && (
                  <DropdownMenuItem
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onOpenMoveModal();
                    }}
                    className="flex flex-row items-center gap-2"
                  >
                    <Icon as={Folder} className="size-4 text-foreground" />
                    <Text style={{ color: colors.foreground }}>
                      {folderName ?? "No folder"}
                    </Text>
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

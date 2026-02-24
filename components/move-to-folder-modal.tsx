"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Text } from "@/components/ui/text";
import type { Folder } from "@/lib/supabase";
import { useThemeColors } from "@/lib/use-theme-colors";
import { ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { Modal, Platform, Pressable, View } from "react-native";

export interface MoveToFolderModalProps {
  visible: boolean;
  onClose: () => void;
  /** Name of the note/file being moved (for subtitle). */
  itemName: string;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  folders: Folder[];
  onMoveConfirm: () => void;
  isPending: boolean;
}

/**
 * Reusable "Move to folder" modal for notes/files.
 * Use on notes/, files/, folder/[id], or anywhere note/file cards are shown.
 * Styling is via className only (except dropdown content width which is dynamic).
 */
export function MoveToFolderModal({
  visible,
  onClose,
  itemName,
  selectedFolderId,
  onSelectFolder,
  folders,
  onMoveConfirm,
  isPending,
}: MoveToFolderModalProps) {
  const { colors } = useThemeColors();
  const [dropdownTriggerWidth, setDropdownTriggerWidth] = useState(0);

  const overlayClassName = "flex-1 items-center justify-center bg-black/50 p-4";
  const backdropClassName = "absolute inset-0";
  const contentClassName =
    "w-full max-w-[400px] rounded-lg border border-border bg-muted p-6 shadow-lg";
  const dropdownWrapperClassName = "mb-6 w-full";
  const triggerClassName =
    "w-full flex-row items-center justify-between rounded-md border border-border bg-background px-3 py-2.5";
  const actionsClassName = "flex-row justify-end gap-3";

  const content = (
    <>
      <Pressable className={backdropClassName} onPress={onClose} />
      <View className={contentClassName}>
        <Text className="mb-2 text-lg font-semibold text-foreground">
          Move to
        </Text>
        <Text className="mb-4 text-sm text-muted-foreground">
          Choose a folder for "{itemName}"
        </Text>
        <View
          className={dropdownWrapperClassName}
          onLayout={(e) => setDropdownTriggerWidth(e.nativeEvent.layout.width)}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Pressable className={triggerClassName}>
                <Text className="text-sm text-foreground">
                  {selectedFolderId == null
                    ? "No folder"
                    : folders.find((f) => f.id === selectedFolderId)?.name ??
                      "Select folder"}
                </Text>
                <ChevronDown color={colors.mutedForeground} size={16} />
              </Pressable>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              style={
                dropdownTriggerWidth > 0 ? { width: dropdownTriggerWidth } : undefined
              }
            >
              <DropdownMenuItem onPress={() => onSelectFolder(null)}>
                <Text className="text-foreground">No folder</Text>
              </DropdownMenuItem>
              {folders.map((folder) => (
                <DropdownMenuItem
                  key={folder.id}
                  onPress={() => onSelectFolder(folder.id)}
                >
                  <Text className="text-foreground">{folder.name}</Text>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </View>
        <View className={actionsClassName}>
          <Pressable className="px-4 py-2" onPress={onClose}>
            <Text className="text-foreground">Cancel</Text>
          </Pressable>
          <Pressable
            className="rounded-md px-4 py-2"
            onPress={onMoveConfirm}
            disabled={isPending}
          >
            <Text className="font-semibold text-blue-500">
              {isPending ? "Moving…" : "Move"}
            </Text>
          </Pressable>
        </View>
      </View>
    </>
  );

  if (Platform.OS === "web") {
    if (!visible) return null;
    return (
      <View className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
        {content}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className={overlayClassName}>{content}</View>
    </Modal>
  );
}

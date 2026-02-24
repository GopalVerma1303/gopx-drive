"use client";

import { Text } from "@/components/ui/text";
import { Modal, Platform, Pressable, View } from "react-native";

export interface LongPressOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  /** Title shown in the header (e.g. note title or file name). */
  title: string;
  onMove: () => void;
  onArchive: () => void;
}

/**
 * Reusable iOS-style action sheet for long-press on note/file cards.
 * Use on notes/, files/, folder/[id], or anywhere note/file cards are shown.
 * Styling is via className only (no inline styles).
 */
export function LongPressOptionsModal({
  visible,
  onClose,
  title,
  onMove,
  onArchive,
}: LongPressOptionsModalProps) {
  const overlayClassName = "flex-1 justify-center items-center bg-black/50";
  const backdropClassName = "absolute inset-0";
  const contentWrapperClassName = "w-full max-w-[280px]";
  const containerClassName =
    "w-full overflow-hidden rounded-xl border border-border bg-muted shadow-sm";
  const headerClassName =
    "w-full items-center justify-center border-b border-border px-4 py-3.5";
  const optionRowClassName =
    "w-full items-center justify-center border-t border-border py-3.5 active:bg-accent";

  const content = (
    <>
      <Pressable className={backdropClassName} onPress={onClose} />
      <View className={contentWrapperClassName}>
        <View className={containerClassName}>
          <View className={headerClassName}>
            <Text
              className="text-center text-base font-medium text-muted-foreground"
              numberOfLines={1}
            >
              {title}
            </Text>
          </View>
          <Pressable className={optionRowClassName} onPress={onMove}>
            <Text className="text-base font-medium text-blue-500">Move to</Text>
          </Pressable>
          <Pressable className={optionRowClassName} onPress={onArchive}>
            <Text className="text-base font-semibold text-red-500">Archive</Text>
          </Pressable>
          <Pressable className={optionRowClassName} onPress={onClose}>
            <Text className="text-base font-semibold text-foreground">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </>
  );

  if (Platform.OS === "web") {
    if (!visible) return null;
    return (
      <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
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

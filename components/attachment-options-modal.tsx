"use client";

import { Text } from "@/components/ui/text";
import { Modal, Platform, Pressable, View } from "react-native";

interface AttachmentOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  onDelete: () => void;
  onCopyUrl: () => void;
  isDeleting?: boolean;
}

/**
 * iOS-style action sheet for attachment cards (Delete / Copy URL / Cancel),
 * visually matching the long-press options modal used for notes/files.
 */
export function AttachmentOptionsModal({
  visible,
  onClose,
  title,
  onDelete,
  onCopyUrl,
  isDeleting,
}: AttachmentOptionsModalProps) {
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
          <Pressable
            className={optionRowClassName}
            onPress={onDelete}
            disabled={isDeleting}
          >
            <Text className="text-base font-semibold text-red-500">
              {isDeleting ? "Deleting..." : "Delete"}
            </Text>
          </Pressable>
          <Pressable className={optionRowClassName} onPress={onCopyUrl}>
            <Text className="text-base font-medium text-blue-500">
              Copy URL
            </Text>
          </Pressable>
          <Pressable className={optionRowClassName} onPress={onClose}>
            <Text className="text-base font-semibold text-foreground">
              Cancel
            </Text>
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
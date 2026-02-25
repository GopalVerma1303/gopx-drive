"use client";

import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/use-theme-colors";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  View,
} from "react-native";

export type AlertModalVariant = "default" | "destructive" | "primary";

export interface AlertModalProps {
  visible: boolean;
  title: string;
  description?: string;
  /**
   * Optional custom body. When provided, it replaces `description`.
   */
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * Called when the confirm action is pressed.
   */
  onConfirm?: () => void;
  /**
   * Called when the cancel action is pressed or the backdrop is tapped.
   */
  onCancel?: () => void;
  /**
   * Visual style for the confirm action.
   * `destructive` is a good fit for delete/archive confirmations.
   */
  variant?: AlertModalVariant;
  /**
   * When true, disables buttons and shows a small spinner next to confirm.
   */
  isPending?: boolean;
  /**
   * When false, only the confirm button is shown (e.g. for single-button "OK" alerts).
   * Default true when both cancel and confirm are relevant.
   */
  showCancelButton?: boolean;
}

export function AlertModal({
  visible,
  title,
  description,
  children,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  variant = "default",
  isPending = false,
  showCancelButton = true,
}: AlertModalProps) {
  const { colors } = useThemeColors();

  const handleCancel = () => {
    if (isPending) return;
    onCancel?.();
  };

  const handleConfirm = () => {
    if (isPending) return;
    onConfirm?.();
  };

  const lowerLabel = confirmLabel.toLowerCase();
  const isDestructiveLabel =
    lowerLabel.includes("delete") || lowerLabel.includes("archive");
  const confirmTextClass =
    variant === "destructive" || isDestructiveLabel
      ? "text-red-500"
      : "text-foreground";

  const content = (
    <View className="w-full max-w-[400px] rounded-lg border border-border bg-muted p-6 shadow-lg">
      <Text className="mb-2 text-lg font-semibold text-foreground">
        {title}
      </Text>

      {children ? (
        children
      ) : description ? (
        <Text className="mb-6 text-sm text-muted-foreground">
          {description}
        </Text>
      ) : null}

      <View className="flex-row justify-end gap-3">
        {showCancelButton ? (
          <Pressable
            className="px-4 py-2"
            onPress={handleCancel}
            disabled={isPending}
          >
            <Text className="text-foreground">{cancelLabel}</Text>
          </Pressable>
        ) : null}
        <Pressable
          className="flex-row items-center rounded-md px-4 py-2"
          onPress={handleConfirm}
          disabled={isPending}
        >
          {isPending ? (
            <ActivityIndicator
              size="small"
              color={colors.foreground}
              style={{ marginRight: 8 }}
            />
          ) : null}
          <Text className={`font-semibold ${confirmTextClass}`}>
            {confirmLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  if (Platform.OS === "web") {
    if (!visible) return null;

    return (
      <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <Pressable className="absolute inset-0" onPress={handleCancel} />
        {content}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View className="flex-1 items-center justify-center bg-black/50 p-4">
        <Pressable className="absolute inset-0" onPress={handleCancel} />
        {content}
      </View>
    </Modal>
  );
}


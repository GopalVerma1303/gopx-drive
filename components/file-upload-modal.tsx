"use client";

import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/use-theme-colors";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { FileUp } from "lucide-react-native";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  View,
} from "react-native";

export type PickedFileAsset = {
  uri: string | globalThis.File;
  name: string;
  mimeType: string | null;
  size: number;
};

export interface FileUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onUpload: (params: {
    file: { uri: string | globalThis.File; name: string; type: string; size: number };
  }) => Promise<void>;
  /** Optional label for context, e.g. "Upload to folder" */
  title?: string;
}

export function FileUploadModal({
  visible,
  onClose,
  onUpload,
  title = "Upload file",
}: FileUploadModalProps) {
  const { colors } = useThemeColors();
  const [pickedFile, setPickedFile] = useState<PickedFileAsset | null>(null);
  const [fileNameInput, setFileNameInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPickedFile(null);
    setFileNameInput("");
    setError(null);
    setUploading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSelectFile = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      setPickedFile({
        uri: Platform.OS === "web" && (file as any).file ? (file as any).file : file.uri,
        name: file.name,
        mimeType: file.mimeType ?? null,
        size: file.size ?? 0,
      });
      setFileNameInput(file.name);
    } catch (e: any) {
      setError(e?.message ?? "Failed to select file");
    }
  };

  const getDisplayName = (): string => {
    const trimmed = fileNameInput.trim();
    if (trimmed) return trimmed;
    return pickedFile?.name ?? "";
  };

  const ensureExtension = (displayName: string): string => {
    if (!pickedFile?.name) return displayName;
    if (displayName.includes(".")) return displayName;
    const ext = pickedFile.name.split(".").pop();
    if (ext) return `${displayName}.${ext}`;
    return displayName;
  };

  const handleUpload = async () => {
    if (!pickedFile) {
      setError("Please select a file first.");
      return;
    }
    const displayName = getDisplayName();
    if (!displayName) {
      setError("Please enter a file name.");
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setError(null);
    setUploading(true);
    try {
      const finalName = ensureExtension(displayName);
      await onUpload({
        file: {
          uri: pickedFile.uri,
          name: finalName,
          type: pickedFile.mimeType ?? "application/octet-stream",
          size: pickedFile.size,
        },
      });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      handleClose();
    } catch (e: any) {
      setError(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (!visible) return null;

  const content = (
    <View
      className="w-full max-w-[480px] rounded-xl border border-border bg-muted p-6 shadow-lg"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
      }}
    >
      <Text className="mb-5 text-lg font-semibold text-foreground">
        {title}
      </Text>

      <View className="mb-4">
        <Text className="mb-2 text-sm font-medium text-foreground">File name</Text>
        <Input
          className="border-border bg-background text-foreground"
          value={fileNameInput}
          onChangeText={setFileNameInput}
          placeholder="Enter a name for this file"
          placeholderTextColor={colors.mutedForeground}
          editable={!!pickedFile}
        />
      </View>

      <Pressable
        onPress={handleSelectFile}
        className="mb-5 flex-row items-center justify-center rounded-xl border border-dashed border-border bg-background px-5 py-4"
        style={{
          borderStyle: "dashed",
        }}
      >
        <FileUp color={colors.mutedForeground} size={20} style={{ marginRight: 8 }} />
        <Text className="text-sm text-muted-foreground">
          {pickedFile ? pickedFile.name : "Select file"}
        </Text>
      </Pressable>

      {error ? (
        <Text className="mb-3 text-xs text-destructive">{error}</Text>
      ) : null}

      <View className="flex-row items-center justify-end gap-3">
        <Pressable onPress={handleClose} className="px-4 py-2">
          <Text className="text-base text-foreground">Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleUpload}
          disabled={uploading || !pickedFile}
          className="rounded-lg px-4 py-2"
        >
          <Text className="text-base font-semibold text-blue-500">
            {uploading ? "Uploading..." : "Upload"}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  if (Platform.OS === "web") {
    return (
      <View
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <Pressable
          className="absolute inset-0"
          onPress={handleClose}
        />
        <Pressable
          className="w-full max-w-[480px]"
          onPress={(e) => e.stopPropagation()}
        >
          {content}
        </Pressable>
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      > 
        <View className="flex-1 items-center justify-center bg-black/50 p-4">
          <Pressable
            className="absolute inset-0"
            onPress={handleClose}
          />
          <Pressable
            className="w-full max-w-[480px]"
            onPress={(e) => e.stopPropagation()}
          >
            {content}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

"use client";

import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/use-theme-colors";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { FileUp } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
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
      style={{
        width: "100%",
        maxWidth: 400,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.muted,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
      }}
    >
      <Text
        style={{
          fontSize: 20,
          fontWeight: "600",
          color: colors.foreground,
          marginBottom: 20,
        }}
      >
        {title}
      </Text>

      <View style={{ marginBottom: 16 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: "500",
            color: colors.foreground,
            marginBottom: 8,
          }}
        >
          File name
        </Text>
        <Input
          value={fileNameInput}
          onChangeText={setFileNameInput}
          placeholder="Enter a name for this file"
          placeholderTextColor={colors.mutedForeground}
          editable={!!pickedFile}
          style={{
            borderColor: colors.border,
            backgroundColor: colors.background,
            color: colors.foreground,
          }}
        />
      </View>

      <Pressable
        onPress={handleSelectFile}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 16,
          paddingHorizontal: 20,
          borderRadius: 10,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: colors.border,
          backgroundColor: colors.background,
          marginBottom: 20,
        }}
      >
        <FileUp color={colors.mutedForeground} size={20} style={{ marginRight: 8 }} />
        <Text style={{ fontSize: 15, color: colors.mutedForeground }}>
          {pickedFile ? pickedFile.name : "Select file"}
        </Text>
      </Pressable>

      {error ? (
        <Text
          style={{
            fontSize: 13,
            color: colors.destructive,
            marginBottom: 12,
          }}
        >
          {error}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 12,
        }}
      >
        <Pressable onPress={handleClose} style={{ paddingVertical: 10, paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 16, color: colors.foreground }}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleUpload}
          disabled={uploading || !pickedFile}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 8,
          }}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#3b82f6" }}>Upload</Text>
          )}
        </Pressable>
      </View>
    </View>
  );

  if (Platform.OS === "web") {
    return (
      <View
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
          padding: 16,
        }}
      >
        <Pressable
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
          onPress={handleClose}
        />
        <Pressable style={{ width: "100%", maxWidth: 400 }} onPress={(e) => e.stopPropagation()}>
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
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)", padding: 16 }}>
          <Pressable style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} onPress={handleClose} />
          <Pressable onPress={(e) => e.stopPropagation()}>{content}</Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
